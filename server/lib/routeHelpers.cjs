"use strict";

const {
  getCookieName,
  getCookieSameSite,
  isDevAuthEnabled,
  shouldUseSecureCookies,
} = require("../config.cjs");
const { getUser } = require("../db/repositories/userStore.cjs");
const { canAccessOrganizerSession } = require("../db/repositories/userStore.cjs");

// ---------------------------------------------------------------------------
// HTTP error factory
// ---------------------------------------------------------------------------

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

// ---------------------------------------------------------------------------
// Async handler wrapper
// ---------------------------------------------------------------------------

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

// ---------------------------------------------------------------------------
// Cookie helpers
// ---------------------------------------------------------------------------

function parseCookies(header = "") {
  return String(header || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const separatorIndex = part.indexOf("=");
      if (separatorIndex === -1) {
        return cookies;
      }
      const key = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();
      if (key) {
        cookies[key] = decodeURIComponent(value);
      }
      return cookies;
    }, {});
}

function getAuthCookie(req) {
  return parseCookies(req.headers.cookie)[getCookieName()] || "";
}

function serializeAuthCookie(value, { maxAge } = {}) {
  const parts = [
    `${getCookieName()}=${encodeURIComponent(value || "")}`,
    "Path=/",
    "HttpOnly",
    `SameSite=${getCookieSameSite()}`,
  ];

  if (maxAge !== undefined) {
    parts.push(`Max-Age=${maxAge}`);
  }

  if (shouldUseSecureCookies()) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

function setAuthCookie(res, token, expiresAt) {
  const maxAge = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  res.setHeader("Set-Cookie", serializeAuthCookie(token, { maxAge }));
}

function clearAuthCookie(res) {
  res.setHeader("Set-Cookie", serializeAuthCookie("", { maxAge: 0 }));
}

// ---------------------------------------------------------------------------
// Viewer resolution helpers
// ---------------------------------------------------------------------------

function getViewerId(req) {
  if (req.authUser?.id) {
    return req.authUser.id;
  }

  if (!isDevAuthEnabled()) {
    return null;
  }

  return req.header("x-viewer-id") || req.query.viewerId;
}

async function resolveViewer(req) {
  if (req.authUser) {
    return req.authUser;
  }

  const viewerId = getViewerId(req);
  return viewerId ? getUser(viewerId) : null;
}

function hasActiveAssignmentRole(viewer, role) {
  return Array.isArray(viewer?.assignments)
    ? viewer.assignments.some(
        (assignment) => assignment.role === role && assignment.status !== "disabled",
      )
    : false;
}

function isAdminViewer(viewer) {
  return viewer?.role === "admin" || viewer?.baseRole === "admin";
}

function isOrganizerViewer(viewer) {
  return (
    viewer?.role === "organizer" ||
    viewer?.baseRole === "organizer" ||
    hasActiveAssignmentRole(viewer, "organizer")
  );
}

// ---------------------------------------------------------------------------
// Route middleware: requireAdmin / requireOrganizer
// ---------------------------------------------------------------------------

function requireAdmin(req, _res, next) {
  Promise.resolve()
    .then(async () => {
      const viewer = await resolveViewer(req);

      if (!viewer || !isAdminViewer(viewer) || viewer.status === "disabled") {
        throw createHttpError(403, "Недостаточно прав для панели администратора");
      }

      req.viewer = viewer;
      next();
    })
    .catch(next);
}

function requireOrganizer(req, _res, next) {
  Promise.resolve()
    .then(async () => {
      const viewerId = getViewerId(req);
      const viewer = viewerId
        ? await canAccessOrganizerSession(viewerId, req.params.sessionId)
        : null;

      if (!viewer) {
        throw createHttpError(403, "Недостаточно прав для управления этим заездом");
      }

      req.viewer = viewer;
      next();
    })
    .catch(next);
}

module.exports = {
  asyncHandler,
  clearAuthCookie,
  createHttpError,
  getAuthCookie,
  getViewerId,
  isAdminViewer,
  isOrganizerViewer,
  requireAdmin,
  requireOrganizer,
  resolveViewer,
  setAuthCookie,
};
