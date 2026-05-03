"use strict";

const { Router } = require("express");
const { getCuratorDashboard } = require("../db/repositories/analyticsStore.cjs");
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

module.exports = router;
