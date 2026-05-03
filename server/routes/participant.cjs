"use strict";

const { Router } = require("express");
const {
  getParticipantDiary,
  updateParticipantEntry,
  updateParticipantReflection,
} = require("../db/repositories/diaryStore.cjs");
const { validateBody } = require("../validation/middleware.cjs");
const { updateDiaryEntrySchema, updateReflectionSchema } = require("../validation/schemas.cjs");
const { asyncHandler, getViewerId } = require("../lib/routeHelpers.cjs");

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

module.exports = router;
