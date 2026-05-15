"use strict";

const { Router } = require("express");
const {
  getParticipantDiary,
  updateParticipantEntry,
  updateParticipantReflection,
  updateParticipantParallelSelection,
} = require("../db/repositories/diaryStore.cjs");
const { validateBody } = require("../validation/middleware.cjs");
const {
  updateDiaryEntrySchema,
  updateReflectionSchema,
  updateJourneyStageSchema,
  updateParallelSelectionSchema,
  submitReturnEntrySchema,
} = require("../validation/schemas.cjs");
const { asyncHandler, getViewerId } = require("../lib/routeHelpers.cjs");
const { updateParticipantJourneyStage } = require("../services/journeyStageService.cjs");
const {
  getReturnPointsForViewer,
  submitReturnEntry,
} = require("../services/returnPointsService.cjs");

const router = Router();

// GET /api/participant/sessions/:sessionId/diary
router.get(
  "/sessions/:sessionId/diary",
  asyncHandler(async (req, res) => {
    res.json(
      await getParticipantDiary({
        viewerId: getViewerId(req),
        sessionId: req.params.sessionId,
      }),
    );
  }),
);

// PATCH /api/participant/sessions/:sessionId/diary/:entryId
router.patch(
  "/sessions/:sessionId/diary/:entryId",
  validateBody(updateDiaryEntrySchema),
  asyncHandler(async (req, res) => {
    const { dayId, ...patch } = req.body || {};
    res.json(
      await updateParticipantEntry({
        viewerId: getViewerId(req),
        sessionId: req.params.sessionId,
        dayId,
        entryId: req.params.entryId,
        patch,
      }),
    );
  }),
);

// PATCH /api/participant/sessions/:sessionId/reflections/:dayId
router.patch(
  "/sessions/:sessionId/reflections/:dayId",
  validateBody(updateReflectionSchema),
  asyncHandler(async (req, res) => {
    res.json(
      await updateParticipantReflection({
        viewerId: getViewerId(req),
        sessionId: req.params.sessionId,
        dayId: req.params.dayId,
        patch: req.body || {},
      }),
    );
  }),
);

// POST /api/participant/sessions/:sessionId/parallel-selection
// body: { dayId, slotKey, eventId } — выбор параллельного блока.
router.post(
  "/sessions/:sessionId/parallel-selection",
  validateBody(updateParallelSelectionSchema),
  asyncHandler(async (req, res) => {
    const { dayId, slotKey, eventId } = req.body || {};
    res.json(
      await updateParticipantParallelSelection({
        viewerId: getViewerId(req),
        sessionId: req.params.sessionId,
        dayId,
        slotKey,
        eventId,
      }),
    );
  }),
);

// PATCH /api/participant/sessions/:sessionId/journey-stage
// Methodology v4: участник выбирает этап пути и/или ставит careful_mode.
// См. docs/architecture/methodology-mapping.md §2.4.
router.patch(
  "/sessions/:sessionId/journey-stage",
  validateBody(updateJourneyStageSchema),
  asyncHandler(async (req, res) => {
    res.json(
      await updateParticipantJourneyStage({
        viewerId: getViewerId(req),
        sessionId: req.params.sessionId,
        patch: req.body || {},
      }),
    );
  }),
);

// GET /api/participant/diary/return-points
// Phase 5.1 — точки возврата для всех смен, в которых участник был.
// См. docs/architecture/methodology-mapping.md §2.6.
router.get(
  "/diary/return-points",
  asyncHandler(async (req, res) => {
    res.json({
      points: await getReturnPointsForViewer(getViewerId(req)),
    });
  }),
);

// POST /api/participant/diary/return-points/:sessionId/:touchpointIndex
router.post(
  "/diary/return-points/:sessionId/:touchpointIndex",
  validateBody(submitReturnEntrySchema),
  asyncHandler(async (req, res) => {
    const touchpointIndex = Number.parseInt(req.params.touchpointIndex, 10);
    res.json(
      await submitReturnEntry({
        viewerId: getViewerId(req),
        sessionId: req.params.sessionId,
        touchpointIndex,
        patch: req.body || {},
      }),
    );
  }),
);

module.exports = router;
