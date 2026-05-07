"use strict";

const { Router } = require("express");
const { getCuratorDashboard } = require("../db/repositories/analyticsStore.cjs");
const { getCuratorNarrativeBrief } = require("../services/narrativeBriefService.cjs");
const { asyncHandler, getViewerId } = require("../lib/routeHelpers.cjs");

const router = Router();

// GET /api/curator/sessions/:sessionId/groups/:groupId/dashboard
router.get(
  "/sessions/:sessionId/groups/:groupId/dashboard",
  asyncHandler(async (req, res) => {
    res.json(
      await getCuratorDashboard({
        viewerId: getViewerId(req),
        sessionId: req.params.sessionId,
        groupId: req.params.groupId,
      }),
    );
  }),
);

// GET /api/curator/sessions/:sessionId/groups/:groupId/brief
// Phase 4.1 — методическая «записка к вечерней рефлексии».
// См. docs/architecture/methodology-mapping.md §2.5.
router.get(
  "/sessions/:sessionId/groups/:groupId/brief",
  asyncHandler(async (req, res) => {
    res.json(
      await getCuratorNarrativeBrief({
        viewerId: getViewerId(req),
        sessionId: req.params.sessionId,
        groupId: req.params.groupId,
        dayId: req.query.dayId || null,
      }),
    );
  }),
);

module.exports = router;
