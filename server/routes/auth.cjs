"use strict";

const { Router } = require("express");
const { getClientFeatures } = require("../config.cjs");
const { consumeMagicLink, revokeAuthSession } = require("../db/repositories/authStore.cjs");
const { validateBody } = require("../validation/middleware.cjs");
const { consumeMagicLinkSchema, createMagicLinkSchema } = require("../validation/schemas.cjs");
const {
  asyncHandler,
  clearAuthCookie,
  getAuthCookie,
  resolveViewer,
  setAuthCookie,
} = require("../lib/routeHelpers.cjs");
const { clearCsrfCookie, generateCsrfToken, setCsrfCookie } = require("../lib/csrf.cjs");
const { issueMagicLink } = require("../services/magicLinkService.cjs");

const router = Router();

// GET /api/auth/me
// Side-effect: rotate the CSRF cookie on every /me hit. The token is opaque
// random (32 bytes) — it carries no identity, only proves same-origin in the
// double-submit check. We rotate unconditionally so this endpoint becomes
// the universal CSRF-recovery path for *all* viewer flavours:
//   • magic-link / registration / setup auth (req.authUser populated)
//   • dev user-switcher (no auth cookie, viewer comes from x-viewer-id)
//   • cleared / stale / mismatched cookie state
// Without rotation here, a dev-switched admin would have no CSRF cookie at
// all and every mutating request would 403.
router.get(
  "/me",
  asyncHandler(async (req, res) => {
    setCsrfCookie(res, generateCsrfToken());
    res.json({
      user: req.authUser || null,
      features: getClientFeatures(),
    });
  }),
);

// POST /api/auth/logout
router.post(
  "/logout",
  asyncHandler(async (req, res) => {
    await revokeAuthSession(getAuthCookie(req));
    clearAuthCookie(res);
    clearCsrfCookie(res);
    res.json({ ok: true, features: getClientFeatures() });
  }),
);

// POST /api/auth/magic-links
router.post(
  "/magic-links",
  validateBody(createMagicLinkSchema),
  asyncHandler(async (req, res) => {
    const viewer = await resolveViewer(req);
    const link = await issueMagicLink(viewer, req.body || {});
    res.status(201).json(link);
  }),
);

// POST /api/auth/magic-links/consume
router.post(
  "/magic-links/consume",
  validateBody(consumeMagicLinkSchema),
  asyncHandler(async (req, res) => {
    const result = await consumeMagicLink({
      token: req.body?.token,
      userAgent: req.header("user-agent") || "",
      ipAddress: req.ip || "",
    });
    setAuthCookie(res, result.session.token, result.session.expiresAt);
    setCsrfCookie(res, generateCsrfToken(), result.session.expiresAt);
    res.json({
      user: result.user,
      link: result.link,
      features: getClientFeatures(),
    });
  }),
);

module.exports = router;
