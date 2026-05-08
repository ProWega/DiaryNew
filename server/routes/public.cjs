"use strict";

const { Router } = require("express");
const { getClientFeatures, getSetupToken, isDevAuthEnabled } = require("../config.cjs");
const { createAuthSession, createFirstAdmin } = require("../db/repositories/authStore.cjs");
const { hasPostgresConfig, query } = require("../db/postgres.cjs");
const { listPublicEvents } = require("../db/repositories/sessionStore.cjs");
const {
  getBootstrap,
  listUsers,
  registerParticipant,
} = require("../db/repositories/userStore.cjs");
const {
  listRegions: listIstokiRegions,
  getRegionByCode: getIstokiRegionByCode,
} = require("../db/repositories/istokiStore.cjs");
const { insertEvents: insertIstokiEvents } = require("../db/repositories/istokiAnalyticsStore.cjs");
const {
  createSubmission: createIstokiSubmission,
  getSubmissionByToken: getIstokiSubmissionByToken,
  publicSubmissionView,
} = require("../db/repositories/istokiSubmissionsStore.cjs");
const { hashIp } = require("../lib/ipHash.cjs");
const rateLimit = require("express-rate-limit");
const { validateBody } = require("../validation/middleware.cjs");
const {
  registerParticipantSchema,
  setupAdminSchema,
  istokiEventsBatchSchema,
  createIstokiSubmissionSchema,
} = require("../validation/schemas.cjs");

// 60 events POSTs per minute per IP. The frontend batches up to 50
// events per call, so this comfortably covers normal interaction even
// during rapid scroll-driven story.viewed bursts.
const istokiEventsRateLimit = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Слишком много событий. Попробуйте через минуту." },
});

// 5 submissions per hour per IP — moderation queue would drown otherwise
// and a real submitter never needs more than two attempts.
const istokiSubmissionsRateLimit = rateLimit({
  windowMs: 60 * 60_000,
  max: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Слишком много заявок. Попробуйте через час." },
});
const {
  asyncHandler,
  createHttpError,
  getViewerId,
  isAdminViewer,
  resolveViewer,
  setAuthCookie,
} = require("../lib/routeHelpers.cjs");
const { generateCsrfToken, setCsrfCookie } = require("../lib/csrf.cjs");

const router = Router();

// POST /api/setup/admin  (mounted under /api so full path is /api/setup/admin)
router.post(
  "/setup/admin",
  validateBody(setupAdminSchema),
  asyncHandler(async (req, res) => {
    const setupToken = getSetupToken();
    if (!setupToken || req.body?.setupToken !== setupToken) {
      throw createHttpError(403, "Некорректный setup token");
    }

    const user = await createFirstAdmin({
      fullName: req.body?.fullName,
      email: req.body?.email,
      phone: req.body?.phone,
    });
    const session = await createAuthSession({
      userId: user.id,
      userAgent: req.header("user-agent") || "",
      ipAddress: req.ip || "",
      meta: { source: "setup" },
    });
    setAuthCookie(res, session.token, session.expiresAt);
    setCsrfCookie(res, generateCsrfToken(), session.expiresAt);
    res.status(201).json({ user, features: getClientFeatures() });
  }),
);

// GET /api/health
router.get(
  "/health",
  asyncHandler(async (_req, res) => {
    const postgresConfigured = hasPostgresConfig();
    let postgresOk = false;
    let postgresError = null;

    if (postgresConfigured) {
      try {
        await query("select 1");
        postgresOk = true;
      } catch (error) {
        postgresError = error.message;
      }
    }

    res.status(postgresConfigured && !postgresOk ? 503 : 200).json({
      ok: true,
      time: new Date().toISOString(),
      dataMode: postgresOk ? "postgres" : "memory",
      postgresConfigured,
      postgresOk,
      postgresError,
    });
  }),
);

// GET /api/users  (dev/admin convenience endpoint)
router.get(
  "/users",
  asyncHandler(async (req, res) => {
    if (!isDevAuthEnabled()) {
      const viewer = await resolveViewer(req);
      if (!viewer || !isAdminViewer(viewer) || viewer.status === "disabled") {
        throw createHttpError(403, "Список пользователей доступен только администратору");
      }
    }
    res.json(await listUsers());
  }),
);

// GET /api/public/events
router.get(
  "/public/events",
  asyncHandler(async (_req, res) => {
    res.json(await listPublicEvents());
  }),
);

// POST /api/participants/register
router.post(
  "/participants/register",
  validateBody(registerParticipantSchema),
  asyncHandler(async (req, res) => {
    const result = await registerParticipant(req.body || {});
    const session = await createAuthSession({
      userId: result.user.id,
      userAgent: req.header("user-agent") || "",
      ipAddress: req.ip || "",
      meta: { source: "public-registration" },
    });
    setAuthCookie(res, session.token, session.expiresAt);
    setCsrfCookie(res, generateCsrfToken(), session.expiresAt);
    res.status(201).json(result);
  }),
);

// GET /api/public/istoki/regions
router.get(
  "/public/istoki/regions",
  asyncHandler(async (_req, res) => {
    const regions = await listIstokiRegions({ publishedOnly: true });
    res.json({ regions });
  }),
);

// GET /api/public/istoki/regions/:code
router.get(
  "/public/istoki/regions/:code",
  asyncHandler(async (req, res) => {
    const code = String(req.params.code || "").trim();
    if (!code) {
      throw createHttpError(400, "Не указан код региона");
    }

    const region = await getIstokiRegionByCode(code, { publishedOnly: true });
    if (!region) {
      throw createHttpError(404, "Регион не найден");
    }

    res.json(region);
  }),
);

// POST /api/public/istoki/events — anonymous batched analytics ingestion
router.post(
  "/public/istoki/events",
  istokiEventsRateLimit,
  validateBody(istokiEventsBatchSchema),
  asyncHandler(async (req, res) => {
    const ipHash = hashIp(req.ip);
    const userAgent = req.get("user-agent") || null;
    const inserted = await insertIstokiEvents({
      events: req.body.events,
      ipHash,
      userAgent,
    });
    res.status(202).json({ inserted });
  }),
);

// POST /api/public/istoki/submissions — anonymous content submission
router.post(
  "/public/istoki/submissions",
  istokiSubmissionsRateLimit,
  validateBody(createIstokiSubmissionSchema),
  asyncHandler(async (req, res) => {
    const submission = await createIstokiSubmission(req.body);
    // Build a relative status URL — the host is whatever served this
    // request (works behind proxy + same-origin frontend).
    res.status(201).json({
      id: submission.id,
      statusToken: submission.statusToken,
      statusUrl: `/istoki/submission/${submission.statusToken}`,
    });
  }),
);

// GET /api/public/istoki/submissions/by-token/:token
router.get(
  "/public/istoki/submissions/by-token/:token",
  asyncHandler(async (req, res) => {
    const token = String(req.params.token || "").trim();
    if (!token) throw createHttpError(400, "Не указан токен заявки");
    const submission = await getIstokiSubmissionByToken(token);
    if (!submission) throw createHttpError(404, "Заявка не найдена");
    res.json(publicSubmissionView(submission));
  }),
);

// GET /api/bootstrap
router.get(
  "/bootstrap",
  asyncHandler(async (req, res) => {
    const viewerId = getViewerId(req);
    res.json(await getBootstrap(viewerId));
  }),
);

module.exports = router;
