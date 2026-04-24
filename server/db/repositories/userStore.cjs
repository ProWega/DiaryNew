const { query } = require("../postgres.cjs");
const {
  createId,
  getSession,
  getSessionInfo,
  getStateScale,
  roleLabels,
  toPublicUser,
} = require("./common.cjs");
const { assertRegistrationAvailable } = require("./sessionStore.cjs");

function getAssignmentFromRow(row) {
  if (!row?.session_id) {
    return null;
  }

  return {
    session_id: row.session_id,
    session_name: row.session_name,
    group_id: row.group_id,
    group_name: row.group_name,
    role: row.effective_role || row.role,
    assignment_status: row.assignment_status || "active",
  };
}

function mapUsersWithAssignments(rows) {
  const grouped = new Map();

  for (const row of rows) {
    if (!row?.id) {
      continue;
    }

    const assignment = getAssignmentFromRow(row);
    const existing = grouped.get(row.id);

    if (!existing) {
      grouped.set(row.id, {
        ...row,
        assignments: assignment ? [assignment] : [],
      });
      continue;
    }

    if (assignment) {
      existing.assignments.push(assignment);
    }
  }

  return Array.from(grouped.values()).map(toPublicUser).filter(Boolean);
}

async function listUsers() {
  const result = await query(`
    select
      u.*,
      coalesce(su.role, u.role) as effective_role,
      su.session_id,
      s.name as session_name,
      su.group_id,
      g.name as group_name,
      su.status as assignment_status,
      su.created_at as assignment_created_at,
      su.updated_at as assignment_updated_at
    from users u
    left join session_users su on su.user_id = u.id
    left join sessions s on s.id = su.session_id
    left join groups g on g.id = su.group_id
    order by
      u.full_name,
      case coalesce(su.status, 'active') when 'active' then 0 else 1 end,
      su.updated_at desc nulls last,
      su.created_at desc nulls last,
      case coalesce(su.role, u.role)
        when 'participant' then 1
        when 'curator' then 2
        when 'organizer' then 3
        else 4
      end,
      s.start_date desc nulls last
  `);

  return mapUsersWithAssignments(result.rows);
}

async function getUser(viewerId) {
  const result = await query(
    `
      select
        u.*,
        coalesce(su.role, u.role) as effective_role,
        su.session_id,
        s.name as session_name,
        su.group_id,
        g.name as group_name,
        su.status as assignment_status,
        su.created_at as assignment_created_at,
        su.updated_at as assignment_updated_at
      from users u
      left join session_users su on su.user_id = u.id
      left join sessions s on s.id = su.session_id
      left join groups g on g.id = su.group_id
      where u.id = $1
      order by
        case coalesce(su.status, 'active') when 'active' then 0 else 1 end,
        su.updated_at desc nulls last,
        su.created_at desc nulls last,
        s.start_date desc nulls last
    `,
    [viewerId],
  );

  return mapUsersWithAssignments(result.rows)[0] || null;
}

async function getRawUser(viewerId, sessionId) {
  const result = await query(
    `
      select
        u.*,
        coalesce(su.role, u.role) as effective_role,
        su.session_id,
        s.name as session_name,
        su.group_id,
        g.name as group_name,
        su.status as assignment_status,
        su.created_at as assignment_created_at,
        su.updated_at as assignment_updated_at
      from users u
      left join session_users su on su.user_id = u.id
      left join sessions s on s.id = su.session_id
      left join groups g on g.id = su.group_id
      where u.id = $1 and ($2::text is null or su.session_id = $2 or su.session_id is null)
      order by
        case when su.session_id = $2 then 0 else 1 end,
        case coalesce(su.status, 'active') when 'active' then 0 else 1 end,
        su.updated_at desc nulls last,
        su.created_at desc nulls last
      limit 1
    `,
    [viewerId, sessionId || null],
  );

  return result.rows[0] || null;
}

function getNavigationItems(user) {
  if (!user) {
    return [];
  }

  const items = [];

  if (user.role === "participant") {
    items.push({
      id: "participant-today",
      label: "Состояние",
      to: `/participant/session/${user.sessionId}/today`,
    });
    items.push({
      id: "participant-self",
      label: "Узнать себя",
      to: `/participant/session/${user.sessionId}/self`,
    });
    items.push({
      id: "participant-dynamics",
      label: "Динамика",
      to: `/participant/session/${user.sessionId}/dynamics`,
    });
  }

  if (user.role === "curator" || user.role === "organizer") {
    items.push({
      id: "curator-group",
      label: user.role === "organizer" ? "Группы" : "Моя группа",
      to: `/curator/session/${user.sessionId}/group/${user.groupId || "group-school-1"}`,
    });
  }

  if (user.role === "organizer") {
    items.push({
      id: "organizer-session",
      label: "Заезд",
      to: `/organizer/session/${user.sessionId}`,
    });
  }

  if (user.role === "admin") {
    items.push({
      id: "admin-security",
      label: "Администрирование",
      to: "/admin/security",
    });
  }

  return items;
}

function getScopeBadges(user) {
  if (!user) {
    return [];
  }

  const badges = [`Роль: ${user.roleLabel || roleLabels[user.role] || user.role}`];

  if (user.sessionLabel) {
    badges.push(`Заезд: ${user.sessionLabel}`);
  }

  if (user.groupLabel) {
    badges.push(`Группа: ${user.groupLabel}`);
  }

  return badges;
}

async function getBootstrap(viewerId) {
  const viewer = await getUser(viewerId);

  if (!viewer) {
    const error = new Error("Пользователь не найден");
    error.status = 401;
    throw error;
  }

  if (viewer.status === "disabled") {
    const error = new Error("Пользователь деактивирован");
    error.status = 403;
    throw error;
  }

  const session = viewer.sessionId ? await getSession(viewer.sessionId) : null;
  const stateScale = await getStateScale(viewer.sessionId);
  const settings = session?.settings || {};

  return {
    viewer,
    sessionInfo: session
      ? getSessionInfo(session)
      : {
          name: "Администрирование",
          cycle: "Все заезды",
          dateLabel: "",
          location: "",
          editWindow: "",
          scaleNote: "RBAC и аудит",
          aiPolicy: "Контроль доступа",
        },
    stateScale,
    reflectionPrompts: settings.reflectionPrompts || [
      "Как я себя чувствую в конце дня?",
      "Что сегодня было особенно важным?",
    ],
    navigation: getNavigationItems(viewer),
    scopeBadges: getScopeBadges(viewer),
  };
}

async function registerParticipant({ fullName, sessionId }) {
  const trimmedName = String(fullName || "").trim();

  if (!trimmedName) {
    const error = new Error("Укажите имя участника");
    error.status = 400;
    throw error;
  }

  await assertRegistrationAvailable(sessionId);

  const groupResult = await query(
    `
      select *
      from groups
      where session_id = $1
      order by name
      limit 1
    `,
    [sessionId],
  );
  const group = groupResult.rows[0];

  if (!group) {
    const error = new Error("Для выбранного события ещё не настроены группы");
    error.status = 400;
    throw error;
  }

  const userId = createId("user-participant");
  await query(
    `
      insert into users (id, full_name, role, meta)
      values ($1, $2, 'participant', '{}'::jsonb)
    `,
    [userId, trimmedName],
  );
  await query(
    `
      insert into session_users (session_id, user_id, group_id, role)
      values ($1, $2, $3, 'participant')
    `,
    [sessionId, userId, group.id],
  );

  const user = await getUser(userId);
  return { user };
}

async function createUser({ actorId, payload = {} }) {
  const fullName = String(payload.fullName || payload.full_name || "").trim();
  if (!fullName) {
    const error = new Error("Укажите имя пользователя");
    error.status = 400;
    throw error;
  }

  const role = payload.role || "participant";
  const userId = payload.id || createId(`user-${role}`);
  await query(
    `
      insert into users (id, full_name, role, email, phone, age, gender, status, meta, updated_at)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,now())
      on conflict (id)
      do update set
        full_name = excluded.full_name,
        role = excluded.role,
        email = excluded.email,
        phone = excluded.phone,
        age = excluded.age,
        gender = excluded.gender,
        status = excluded.status,
        meta = excluded.meta,
        updated_at = now()
    `,
    [
      userId,
      fullName,
      role,
      payload.email || null,
      payload.phone || null,
      payload.age === "" || payload.age === undefined ? null : Number(payload.age),
      payload.gender || null,
      payload.status || "active",
      JSON.stringify(payload.meta || {}),
    ],
  );

  await query(
    `
      insert into audit_log (id, actor_id, action, entity_type, entity_id, payload)
      values ($1,$2,'create user','user',$3,$4::jsonb)
    `,
    [createId("audit"), actorId || null, userId, JSON.stringify({ role })],
  );

  return getUser(userId);
}

async function updateUser({ actorId, userId, payload = {} }) {
  await query(
    `
      update users
      set
        full_name = coalesce($2, full_name),
        role = coalesce($3, role),
        email = $4,
        phone = $5,
        age = $6,
        gender = $7,
        updated_at = now()
      where id = $1
    `,
    [
      userId,
      payload.fullName ?? payload.full_name ?? null,
      payload.role ?? null,
      payload.email ?? null,
      payload.phone ?? null,
      payload.age === "" || payload.age === undefined ? null : Number(payload.age),
      payload.gender ?? null,
    ],
  );

  await query(
    `
      insert into audit_log (id, actor_id, action, entity_type, entity_id, payload)
      values ($1,$2,'update user','user',$3,$4::jsonb)
    `,
    [createId("audit"), actorId || null, userId, JSON.stringify(payload)],
  );

  return getUser(userId);
}

async function updateUserStatus({ actorId, userId, status }) {
  const nextStatus = status === "disabled" ? "disabled" : "active";
  await query("update users set status = $2, updated_at = now() where id = $1", [userId, nextStatus]);
  await query(
    `
      insert into audit_log (id, actor_id, action, entity_type, entity_id, payload)
      values ($1,$2,'update user status','user',$3,$4::jsonb)
    `,
    [createId("audit"), actorId || null, userId, JSON.stringify({ status: nextStatus })],
  );
  return getUser(userId);
}

async function upsertUserAssignment({ actorId, userId, payload = {} }) {
  if (!payload.sessionId) {
    const error = new Error("Укажите заезд для назначения");
    error.status = 400;
    throw error;
  }

  const role = payload.role || "participant";
  const status = payload.status || "active";
  const groupId = ["participant", "curator"].includes(role) ? payload.groupId || null : null;

  await query(
    `
      insert into session_users (session_id, user_id, group_id, role, status, updated_at)
      values ($1,$2,$3,$4,$5,now())
      on conflict (session_id, user_id)
      do update set
        group_id = excluded.group_id,
        role = excluded.role,
        status = excluded.status,
        updated_at = now()
    `,
    [
      payload.sessionId,
      userId,
      groupId,
      role,
      status,
    ],
  );

  if (role === "curator" && groupId && status === "active") {
    await query(
      "update groups set curator_id = $1, updated_at = now() where id = $2 and session_id = $3",
      [userId, groupId, payload.sessionId],
    );
  }

  await query(
    `
      update groups
      set curator_id = null, updated_at = now()
      where session_id = $1
        and curator_id = $2
        and ($3::text is null or id <> $3)
    `,
    [
      payload.sessionId,
      userId,
      role === "curator" && groupId && status === "active" ? groupId : null,
    ],
  );

  await query(
    `
      insert into audit_log (id, actor_id, session_id, action, entity_type, entity_id, payload)
      values ($1,$2,$3,'upsert assignment','session_user',$4,$5::jsonb)
    `,
    [
      createId("audit"),
      actorId || null,
      payload.sessionId,
      `${payload.sessionId}:${userId}`,
      JSON.stringify({ userId, role, groupId, status }),
    ],
  );

  return getUser(userId);
}

async function canAccessOrganizerSession(viewerId, sessionId) {
  const row = await getRawUser(viewerId, sessionId);
  if (!row) {
    return null;
  }

  const user = toPublicUser(row);
  if (user.status === "disabled") {
    return null;
  }

  if (row.role === "admin" || user.role === "admin" || user.baseRole === "admin") {
    return user;
  }

  const hasOrganizerAssignment =
    user.role === "organizer" &&
    user.sessionId === sessionId &&
    (row.assignment_status || "active") === "active";

  return hasOrganizerAssignment ? user : null;
}

module.exports = {
  canAccessOrganizerSession,
  getBootstrap,
  getRawUser,
  getUser,
  createUser,
  listUsers,
  registerParticipant,
  updateUser,
  updateUserStatus,
  upsertUserAssignment,
};
