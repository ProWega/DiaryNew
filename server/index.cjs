"use strict";

// MUST be required FIRST — OpenTelemetry auto-instrumentation patches
// modules at import time. Any require() before this line is invisible to OTel.
require("./lib/telemetry.cjs");

const cors = require("cors");
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const pinoHttp = require("pino-http");
const fs = require("node:fs");
const path = require("node:path");
const logger = require("./logger.cjs");
const { getAuthRateLimit, getCorsAllowedOrigins, isProductionMode } = require("./config.cjs");
const { getUserBySessionToken } = require("./db/repositories/authStore.cjs");
const { asyncHandler, getAuthCookie } = require("./lib/routeHelpers.cjs");
const { csrfGuard } = require("./lib/csrf.cjs");

const PORT = Number(process.env.PORT || 4000);
const HOST = process.env.HOST || "0.0.0.0";
const CLIENT_DIST_DIR = path.join(__dirname, "..", "dist");

const app = express();

// Trust the first proxy in production so rate-limit and req.ip work behind a load balancer.
if (isProductionMode()) {
  app.set("trust proxy", 1);
}

app.use(
  pinoHttp({
    logger,
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    },
  }),
);

// Helmet adds standard security headers. CSP is left for a separate PR — the
// current SPA relies on inline styles and server-injected runtime values, so
// configuring it correctly needs its own pass.
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

const allowedOrigins = getCorsAllowedOrigins();
if (!allowedOrigins.length && isProductionMode()) {
  logger.warn(
    "CORS_ALLOWED_ORIGINS is empty in production — cross-origin requests with credentials will be rejected.",
  );
}

app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      // Same-origin / non-browser tools (curl, server-to-server) send no Origin — let them through.
      if (!origin) {
        callback(null, true);
        return;
      }
      // Dev-mode shortcut: разрешаем любой origin, чтобы Vite-dev на меняющемся
      // LAN-IP (или через Caddy reverse proxy) не упирался в allowlist каждый
      // раз. В production проверка allowlist обязательна.
      if (!isProductionMode()) {
        callback(null, true);
        return;
      }
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      // Disallowed: respond without CORS headers so the browser blocks the
      // request. Avoids surfacing as a 500 from the global error handler.
      logger.warn({ origin }, "CORS request rejected: origin not in allowlist");
      callback(null, false);
    },
  }),
);

const authRateLimit = getAuthRateLimit();
app.use(
  "/api/auth",
  rateLimit({
    windowMs: authRateLimit.windowMs,
    max: authRateLimit.max,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { message: "Слишком много попыток входа. Подождите немного и повторите." },
  }),
);

app.use(express.json({ limit: "1mb" }));

// ---------------------------------------------------------------------------
// Auth middleware — resolves session token to req.authUser for all routes
// ---------------------------------------------------------------------------

app.use(
  asyncHandler(async (req, _res, next) => {
    const token = getAuthCookie(req);
    if (token) {
      req.authUser = await getUserBySessionToken(token);
    }
    next();
  }),
);

// ---------------------------------------------------------------------------
// CSRF Double Submit Cookie guard — applied globally; non-mutating methods
// and the session-establishing endpoints are skipped inside the middleware
// ---------------------------------------------------------------------------

app.use(csrfGuard);

// ---------------------------------------------------------------------------
// Domain routers
// ---------------------------------------------------------------------------

app.use("/api/auth", require("./routes/auth.cjs"));
app.use("/api", require("./routes/public.cjs"));
app.use("/api/participant", require("./routes/participant.cjs"));
app.use("/api/curator", require("./routes/curator.cjs"));
app.use("/api/organizer", require("./routes/organizer.cjs"));
app.use("/api/admin", require("./routes/admin.cjs"));
app.use("/api/admin/istoki", require("./routes/istokiAdmin.cjs"));

// User-uploaded media for the «Истоки» CMS. Served publicly so the audio
// player + story photos can fetch by URL without auth.
const { ensureUploadDirs, uploadsRoot } = require("./lib/uploads.cjs");
ensureUploadDirs();
app.use("/uploads", express.static(uploadsRoot, { fallthrough: false, maxAge: "1d" }));

// ---------------------------------------------------------------------------
// Static SPA serving
// ---------------------------------------------------------------------------

if (fs.existsSync(CLIENT_DIST_DIR)) {
  app.use(express.static(CLIENT_DIST_DIR, { index: false }));
  app.use((req, res, next) => {
    if ((req.method !== "GET" && req.method !== "HEAD") || req.path.startsWith("/api")) {
      next();
      return;
    }

    res.sendFile(path.join(CLIENT_DIST_DIR, "index.html"));
  });
}

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------

app.use((error, req, res, _next) => {
  const status = error.status || 500;
  if (status >= 500) {
    req.log?.error({ err: error }, "Unhandled error");
  } else {
    req.log?.warn({ err: error, status }, "Request failed");
  }
  res.status(status).json({
    message: error.message || "Внутренняя ошибка сервера",
  });
});

// ---------------------------------------------------------------------------
// Server startup
// ---------------------------------------------------------------------------

function startServer() {
  return app.listen(PORT, HOST, () => {
    logger.info({ host: HOST, port: PORT }, "Organizer API listening");
  });
}

if (require.main === module) {
  startServer();
}

module.exports = {
  app,
  startServer,
};
