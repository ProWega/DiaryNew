"use strict";

const { createMagicLink } = require("../db/repositories/authStore.cjs");
const { canAccessOrganizerSession } = require("../db/repositories/userStore.cjs");
const { createHttpError, isAdminViewer, isOrganizerViewer } = require("../lib/routeHelpers.cjs");

/**
 * Authorize and issue a magic link on behalf of the given viewer.
 * Throws an HttpError when the viewer lacks permission for the requested purpose.
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

  return createMagicLink({
    creatorId: viewer.id,
    purpose,
    targetUserId: body.targetUserId || null,
    sessionId: body.sessionId || null,
    role: body.role || "participant",
    groupId: body.groupId || null,
    fullName: body.fullName || "",
    ttlMinutes: body.ttlMinutes,
  });
}

module.exports = { issueMagicLink };
