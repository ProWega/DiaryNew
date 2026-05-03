"use strict";

const { Router } = require("express");
const { getAdminWorkspace } = require("../db/repositories/adminStore.cjs");
const { getAdminDashboard } = require("../db/repositories/analyticsStore.cjs");
const {
  createSession,
  updateRegistration,
  updateSession,
} = require("../db/repositories/sessionStore.cjs");
const {
  createUser,
  updateUser,
  updateUserStatus,
  upsertUserAssignment,
} = require("../db/repositories/userStore.cjs");
const { validateBody } = require("../validation/middleware.cjs");
const {
  createUserSchema,
  updateUserSchema,
  updateUserStatusSchema,
  upsertUserAssignmentSchema,
} = require("../validation/schemas.cjs");
const { asyncHandler, requireAdmin } = require("../lib/routeHelpers.cjs");
const { logAuditEvent } = require("../services/auditLog.cjs");

const router = Router();

// All routes in this file are protected by requireAdmin middleware applied per-route.

// GET /api/admin/dashboard
router.get(
  "/dashboard",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    res.json(await getAdminDashboard());
  }),
);

// GET /api/admin/workspace
router.get(
  "/workspace",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    res.json(await getAdminWorkspace());
  }),
);

// POST /api/admin/users
router.post(
  "/users",
  requireAdmin,
  validateBody(createUserSchema),
  asyncHandler(async (req, res) => {
    const result = await createUser({ actorId: req.viewer.id, payload: req.body || {} });
    logAuditEvent({
      actorId: req.viewer.id,
      action: "user.create",
      entityType: "user",
      entityId: result?.user?.id,
      payload: { role: req.body?.role },
    });
    res.status(201).json(result);
  }),
);

// PATCH /api/admin/users/:userId
router.patch(
  "/users/:userId",
  requireAdmin,
  validateBody(updateUserSchema),
  asyncHandler(async (req, res) => {
    const result = await updateUser({
      actorId: req.viewer.id,
      userId: req.params.userId,
      payload: req.body || {},
    });
    logAuditEvent({
      actorId: req.viewer.id,
      action: "user.update",
      entityType: "user",
      entityId: req.params.userId,
      payload: req.body || {},
    });
    res.json(result);
  }),
);

// PATCH /api/admin/users/:userId/status
router.patch(
  "/users/:userId/status",
  requireAdmin,
  validateBody(updateUserStatusSchema),
  asyncHandler(async (req, res) => {
    const result = await updateUserStatus({
      actorId: req.viewer.id,
      userId: req.params.userId,
      status: req.body?.status,
    });
    logAuditEvent({
      actorId: req.viewer.id,
      action: "user.status_change",
      entityType: "user",
      entityId: req.params.userId,
      payload: { status: req.body?.status },
    });
    res.json(result);
  }),
);

// POST /api/admin/users/:userId/assignments
router.post(
  "/users/:userId/assignments",
  requireAdmin,
  validateBody(upsertUserAssignmentSchema),
  asyncHandler(async (req, res) => {
    const result = await upsertUserAssignment({
      actorId: req.viewer.id,
      userId: req.params.userId,
      payload: req.body || {},
    });
    logAuditEvent({
      actorId: req.viewer.id,
      action: "user.assignment",
      entityType: "user",
      entityId: req.params.userId,
      payload: req.body || {},
    });
    res.status(201).json(result);
  }),
);

// PATCH /api/admin/users/:userId/assignments/:sessionId
router.patch(
  "/users/:userId/assignments/:sessionId",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const payload = { ...(req.body || {}), sessionId: req.params.sessionId };
    const result = await upsertUserAssignment({
      actorId: req.viewer.id,
      userId: req.params.userId,
      payload,
    });
    logAuditEvent({
      actorId: req.viewer.id,
      action: "user.assignment",
      entityType: "user",
      entityId: req.params.userId,
      payload,
    });
    res.json(result);
  }),
);

// POST /api/admin/sessions
router.post(
  "/sessions",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const session = await createSession({
      actorId: req.viewer.id,
      payload: req.body || {},
      assignOrganizerId: req.body?.organizerId || null,
    });
    logAuditEvent({
      actorId: req.viewer.id,
      action: "session.create",
      entityType: "session",
      entityId: session?.session?.id,
    });
    res.status(201).json(session);
  }),
);

// PATCH /api/admin/sessions/:sessionId
router.patch(
  "/sessions/:sessionId",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const result = await updateSession({
      actorId: req.viewer.id,
      sessionId: req.params.sessionId,
      payload: req.body || {},
    });
    logAuditEvent({
      actorId: req.viewer.id,
      action: "session.update",
      entityType: "session",
      entityId: req.params.sessionId,
      payload: req.body || {},
    });
    res.json(result);
  }),
);

// PATCH /api/admin/sessions/:sessionId/registration
router.patch(
  "/sessions/:sessionId/registration",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const result = await updateRegistration({
      actorId: req.viewer.id,
      sessionId: req.params.sessionId,
      payload: req.body || {},
    });
    logAuditEvent({
      actorId: req.viewer.id,
      action: "session.registration_update",
      entityType: "session",
      entityId: req.params.sessionId,
      payload: req.body || {},
    });
    res.json(result);
  }),
);

module.exports = router;
