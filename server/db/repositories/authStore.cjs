const { createHash, createHmac, randomBytes } = require("node:crypto");
const { getAppBaseUrl, getAuthSessionSecret, getAuthSessionTtlDays, getMagicLinkTtlMinutes } = require("../../config.cjs");
const { query } = require("../postgres.cjs");
const { createId } = require("./common.cjs");
const { createUser, getUser, upsertUserAssignment } = require("./userStore.cjs");

const MAGIC_PURPOSES = new Set(["login", "invite"]);
const INVITE_ROLES = new Set(["participant", "curator", "organizer"]);

function createToken() {
  return randomBytes(32).toString("base64url");
}

function hashToken(token) {
  return createHmac("sha256", getAuthSessionSecret()).update(String(token || "")).digest("hex");
}

function shortHash(value) {
  return createHash("sha256").update(String(value || "")).digest("hex").slice(0, 12);
}

function addMinutes(minutes) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

function addDays(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function normalizeMagicPurpose(purpose) {
  return MAGIC_PURPOSES.has(purpose) ? purpose : "login";
}

async function createAuthSession({ userId, userAgent = "", ipAddress = "", meta = {} } = {}) {
  if (!userId) {
    const error = new Error("User is required for auth session");
    error.status = 400;
    throw error;
  }

  const token = createToken();
  const expiresAt = addDays(getAuthSessionTtlDays());
  await query(
    `
      insert into auth_sessions (id, user_id, token_hash, user_agent, ip_address, expires_at, meta)
      values ($1,$2,$3,$4,$5,$6,$7::jsonb)
    `,
    [
      createId("auth-session"),
      userId,
      hashToken(token),
      userAgent || "",
      ipAddress || "",
      expiresAt,
      JSON.stringify(meta || {}),
    ],
  );

  return { token, expiresAt };
}

async function getUserBySessionToken(token) {
  if (!token) {
    return null;
  }

  const result = await query(
    `
      select user_id
      from auth_sessions
      where token_hash = $1
        and revoked_at is null
        and expires_at > now()
      limit 1
    `,
    [hashToken(token)],
  );

  const userId = result.rows[0]?.user_id;
  return userId ? getUser(userId) : null;
}

async function revokeAuthSession(token) {
  if (!token) {
    return;
  }

  await query(
    "update auth_sessions set revoked_at = now() where token_hash = $1 and revoked_at is null",
    [hashToken(token)],
  );
}

async function getFirstGroupForSession(sessionId) {
  const result = await query(
    `
      select id
      from groups
      where session_id = $1
      order by name
      limit 1
    `,
    [sessionId],
  );
  return result.rows[0]?.id || null;
}

async function createMagicLink({
  creatorId,
  purpose = "login",
  targetUserId = null,
  sessionId = null,
  role = "participant",
  groupId = null,
  fullName = "",
  ttlMinutes = getMagicLinkTtlMinutes(),
  meta = {},
} = {}) {
  const nextPurpose = normalizeMagicPurpose(purpose);
  const nextRole = INVITE_ROLES.has(role) ? role : "participant";

  if (nextPurpose === "login" && !targetUserId) {
    const error = new Error("Выберите пользователя для magic link");
    error.status = 400;
    throw error;
  }

  if (nextPurpose === "invite" && !sessionId) {
    const error = new Error("Выберите заезд для приглашения");
    error.status = 400;
    throw error;
  }

  const token = createToken();
  const expiresAt = addMinutes(Number(ttlMinutes) || getMagicLinkTtlMinutes());
  const id = createId("magic-link");
  await query(
    `
      insert into auth_magic_links (
        id, token_hash, purpose, target_user_id, session_id, role, group_id,
        full_name, created_by, expires_at, meta
      )
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)
    `,
    [
      id,
      hashToken(token),
      nextPurpose,
      targetUserId || null,
      sessionId || null,
      nextPurpose === "invite" ? nextRole : null,
      groupId || null,
      String(fullName || "").trim() || null,
      creatorId || null,
      expiresAt,
      JSON.stringify(meta || {}),
    ],
  );

  const url = new URL("/magic", getAppBaseUrl());
  url.searchParams.set("token", token);
  return {
    id,
    purpose: nextPurpose,
    expiresAt,
    tokenPreview: shortHash(token),
    url: url.toString(),
  };
}

async function consumeMagicLink({ token, userAgent = "", ipAddress = "" } = {}) {
  if (!token) {
    const error = new Error("Magic link token is required");
    error.status = 400;
    throw error;
  }

  const result = await query(
    `
      update auth_magic_links
      set consumed_at = now()
      where token_hash = $1
        and consumed_at is null
        and expires_at > now()
      returning *
    `,
    [hashToken(token)],
  );
  const link = result.rows[0];

  if (!link) {
    const error = new Error("Magic link is invalid or expired");
    error.status = 410;
    throw error;
  }

  let userId = link.target_user_id;
  if (link.purpose === "invite") {
    const role = INVITE_ROLES.has(link.role) ? link.role : "participant";
    const fullName = String(link.full_name || "").trim() || "Участник";
    const groupId = ["participant", "curator"].includes(role)
      ? link.group_id || (await getFirstGroupForSession(link.session_id))
      : null;

    if (!userId) {
      const user = await createUser({
        actorId: link.created_by,
        payload: {
          fullName,
          role,
          status: "active",
          meta: { source: "magic-invite", linkId: link.id },
        },
      });
      userId = user.id;
    }

    await upsertUserAssignment({
      actorId: link.created_by,
      userId,
      payload: {
        sessionId: link.session_id,
        groupId,
        role,
        status: "active",
      },
    });
  }

  const user = await getUser(userId);
  if (!user || user.status === "disabled") {
    const error = new Error("User is not available");
    error.status = 403;
    throw error;
  }

  await query("update auth_magic_links set consumed_by = $2 where id = $1", [link.id, user.id]);
  const session = await createAuthSession({
    userId: user.id,
    userAgent,
    ipAddress,
    meta: { source: "magic-link", linkId: link.id, purpose: link.purpose },
  });

  return { user, session, link: { id: link.id, purpose: link.purpose } };
}

async function hasAdminUsers() {
  const result = await query("select 1 from users where role = 'admin' limit 1");
  return Boolean(result.rows[0]);
}

async function createFirstAdmin({ fullName, email, phone } = {}) {
  if (await hasAdminUsers()) {
    const error = new Error("System administrator already exists");
    error.status = 409;
    throw error;
  }

  return createUser({
    actorId: null,
    payload: {
      fullName: String(fullName || "").trim() || "Системный администратор",
      email: email || null,
      phone: phone || null,
      role: "admin",
      status: "active",
      meta: { source: "setup" },
    },
  });
}

module.exports = {
  createAuthSession,
  createFirstAdmin,
  createMagicLink,
  consumeMagicLink,
  getUserBySessionToken,
  hasAdminUsers,
  revokeAuthSession,
};
