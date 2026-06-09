"use strict";

const { createMagicLink } = require("../db/repositories/authStore.cjs");
const { canAccessOrganizerSession } = require("../db/repositories/userStore.cjs");
const { createHttpError, isAdminViewer, isOrganizerViewer } = require("../lib/routeHelpers.cjs");
const { persistInviteBatch } = require("../db/repositories/inviteBatchesStore.cjs");
const { query } = require("../db/postgres.cjs");

/**
 * Authorize and issue a magic link on behalf of the given viewer.
 * Throws an HttpError when the viewer lacks permission for the requested purpose.
 *
 * Для purpose=invite с заполненным sessionId+groupId+fullName результат
 * дополнительно записывается одной строкой в `invite_batches`, чтобы куратор
 * группы видел эту ссылку в своём кабинете «Состав группы».
 */
async function issueMagicLink(viewer, body = {}) {
  if (!viewer || viewer.status === "disabled") {
    throw createHttpError(401, "Необходимо войти в систему");
  }

  const purpose = body.purpose || "login";

  if (purpose === "login" && !isAdminViewer(viewer)) {
    throw createHttpError(403, "Magic links для входа может создавать только администратор");
  }

  if (purpose === "invite" && !isAdminViewer(viewer)) {
    const access = body.sessionId
      ? await canAccessOrganizerSession(viewer.id, body.sessionId)
      : null;
    if (!access || !isOrganizerViewer(access)) {
      throw createHttpError(403, "Недостаточно прав для создания приглашения на этот заезд");
    }
  }

  const link = await createMagicLink({
    creatorId: viewer.id,
    purpose,
    targetUserId: body.targetUserId || null,
    sessionId: body.sessionId || null,
    role: body.role || "participant",
    groupId: body.groupId || null,
    fullName: body.fullName || "",
    ttlMinutes: body.ttlMinutes,
  });

  // Делаем admin/organizer одиночные invites видимыми куратору в его
  // кабинете — кладём в invite_batches как 1-row batch.
  if (
    purpose === "invite" &&
    body.sessionId &&
    body.groupId &&
    body.fullName &&
    (body.role || "participant") === "participant"
  ) {
    try {
      let groupName = null;
      if (body.groupId) {
        const r = await query(`select name from groups where id = $1 limit 1`, [body.groupId]);
        groupName = r.rows[0]?.name || null;
      }
      await persistInviteBatch({
        sessionId: body.sessionId,
        actorId: viewer.id,
        invites: [
          {
            groupId: body.groupId,
            groupName,
            role: body.role || "participant",
            fullName: body.fullName,
            url: link.url,
            expiresAt: link.expiresAt,
            magicLinkId: link.id,
          },
        ],
        layout: "card",
        title: null,
        footer: null,
        ttlMinutes: body.ttlMinutes,
      });
    } catch (error) {
      // Persist в invite_batches — не критичен для самой выдачи ссылки.
      console.warn("[magicLinkService] invite batch persist failed:", error?.message || error);
    }
  }

  return link;
}

module.exports = { issueMagicLink };
