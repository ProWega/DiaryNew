"use strict";

const { randomBytes } = require("crypto");
const { getCsrfCookieName, getCookieSameSite, shouldUseSecureCookies } = require("../config.cjs");
const { createHttpError } = require("./routeHelpers.cjs");

const CSRF_HEADER = "x-csrf-token";

// Endpoints that establish the session itself — the client cannot have a
// CSRF cookie yet on the first call. They are otherwise protected:
// rate-limited (auth/*), gated by setupToken (setup/admin), or open by design
// (public participant registration with zod + rate-limit).
const CSRF_EXEMPT_PATHS = new Set([
  "/api/auth/magic-links/consume",
  "/api/setup/admin",
  "/api/participants/register",
  // Public anonymous endpoints — no session, no cookie. Protected by
  // their own rate-limits, Zod validation, and per-request hashing.
  "/api/public/istoki/events",
  "/api/public/istoki/submissions",
]);

function generateCsrfToken() {
  return randomBytes(32).toString("hex");
}

function serializeCsrfCookie(value, { maxAge } = {}) {
  const parts = [
    `${getCsrfCookieName()}=${encodeURIComponent(value || "")}`,
    "Path=/",
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

function appendSetCookie(res, cookie) {
  const existing = res.getHeader("Set-Cookie");
  if (Array.isArray(existing)) {
    res.setHeader("Set-Cookie", [...existing, cookie]);
  } else if (typeof existing === "string") {
    res.setHeader("Set-Cookie", [existing, cookie]);
  } else {
    res.setHeader("Set-Cookie", cookie);
  }
}

function setCsrfCookie(res, token, expiresAt) {
  const maxAge = expiresAt
    ? Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
    : undefined;
  appendSetCookie(res, serializeCsrfCookie(token, { maxAge }));
}

function clearCsrfCookie(res) {
  appendSetCookie(res, serializeCsrfCookie("", { maxAge: 0 }));
}

function getCsrfCookieValue(req) {
  const header = String(req.headers.cookie || "");
  const name = getCsrfCookieName().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : "";
}

function csrfGuard(req, _res, next) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    return next();
  }

  if (CSRF_EXEMPT_PATHS.has(req.path)) {
    return next();
  }

  const cookieToken = getCsrfCookieValue(req);
  const headerToken = req.header(CSRF_HEADER) || "";

  if (!cookieToken || cookieToken !== headerToken) {
    return next(createHttpError(403, "CSRF token mismatch"));
  }

  return next();
}

module.exports = {
  CSRF_HEADER,
  clearCsrfCookie,
  csrfGuard,
  generateCsrfToken,
  getCsrfCookieValue,
  setCsrfCookie,
};
