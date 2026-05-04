"use strict";

/**
 * Admin CMS for the «Истоки» content store (Phase B).
 *
 * Mounted at /api/admin/istoki. Every endpoint is `requireAdmin`-protected
 * and writes an audit_log row through `logAuditEvent`.
 */

const { Router } = require("express");
const {
  listRegions,
  getRegionByCode,
  upsertRegion,
  upsertPodcast,
  upsertStory,
  upsertChronicleEntry,
  deleteRegion,
  deletePodcast,
  deleteStory,
  deleteChronicleEntry,
} = require("../db/repositories/istokiStore.cjs");
const { validateBody } = require("../validation/middleware.cjs");
const {
  upsertIstokiRegionSchema,
  upsertIstokiPodcastSchema,
  upsertIstokiStorySchema,
  upsertIstokiChronicleSchema,
} = require("../validation/schemas.cjs");
const { asyncHandler, createHttpError, requireAdmin } = require("../lib/routeHelpers.cjs");
const { logAuditEvent } = require("../services/auditLog.cjs");
const { audioUploader, photoUploader, persistUpload } = require("../lib/uploads.cjs");

const router = Router();

// All routes here require admin role.
router.use(requireAdmin);

// ── Regions ────────────────────────────────────────────────────────

// GET /api/admin/istoki/regions — list everything (including unpublished)
router.get(
  "/regions",
  asyncHandler(async (_req, res) => {
    const regions = await listRegions({ publishedOnly: false });
    res.json({ regions });
  }),
);

// GET /api/admin/istoki/regions/:code
router.get(
  "/regions/:code",
  asyncHandler(async (req, res) => {
    const region = await getRegionByCode(req.params.code, { publishedOnly: false });
    if (!region) {
      throw createHttpError(404, "Регион не найден");
    }
    res.json(region);
  }),
);

// POST /api/admin/istoki/regions — create or replace by code (idempotent upsert)
router.post(
  "/regions",
  validateBody(upsertIstokiRegionSchema),
  asyncHandler(async (req, res) => {
    const code = await upsertRegion(req.body);
    logAuditEvent({
      actorId: req.viewer.id,
      action: "istoki.region.upsert",
      entityType: "istoki_region",
      entityId: code,
      payload: { name: req.body?.name },
    });
    res.status(201).json({ code });
  }),
);

// PUT /api/admin/istoki/regions/:code
router.put(
  "/regions/:code",
  validateBody(upsertIstokiRegionSchema),
  asyncHandler(async (req, res) => {
    if (req.body.code !== req.params.code) {
      throw createHttpError(400, "Код в URL и теле не совпадают");
    }
    const code = await upsertRegion(req.body);
    logAuditEvent({
      actorId: req.viewer.id,
      action: "istoki.region.update",
      entityType: "istoki_region",
      entityId: code,
      payload: { name: req.body?.name },
    });
    res.json({ code });
  }),
);

// DELETE /api/admin/istoki/regions/:code
router.delete(
  "/regions/:code",
  asyncHandler(async (req, res) => {
    const ok = await deleteRegion(req.params.code);
    if (!ok) {
      throw createHttpError(404, "Регион не найден");
    }
    logAuditEvent({
      actorId: req.viewer.id,
      action: "istoki.region.delete",
      entityType: "istoki_region",
      entityId: req.params.code,
      payload: {},
    });
    res.status(204).end();
  }),
);

// ── Podcasts ───────────────────────────────────────────────────────

router.post(
  "/regions/:code/podcasts",
  validateBody(upsertIstokiPodcastSchema),
  asyncHandler(async (req, res) => {
    const id = await upsertPodcast({ ...req.body, regionCode: req.params.code });
    logAuditEvent({
      actorId: req.viewer.id,
      action: "istoki.podcast.upsert",
      entityType: "istoki_podcast",
      entityId: id,
      payload: { regionCode: req.params.code, title: req.body?.title },
    });
    res.status(201).json({ id });
  }),
);

router.put(
  "/podcasts/:id",
  validateBody(upsertIstokiPodcastSchema),
  asyncHandler(async (req, res) => {
    if (req.body.id && req.body.id !== req.params.id) {
      throw createHttpError(400, "ID в URL и теле не совпадают");
    }
    const existing = await getRegionByCodeForPodcast(req.params.id);
    if (!existing) {
      throw createHttpError(404, "Подкаст не найден");
    }
    const id = await upsertPodcast({
      ...req.body,
      id: req.params.id,
      regionCode: existing.region_code,
    });
    logAuditEvent({
      actorId: req.viewer.id,
      action: "istoki.podcast.update",
      entityType: "istoki_podcast",
      entityId: id,
      payload: { title: req.body?.title },
    });
    res.json({ id });
  }),
);

router.delete(
  "/podcasts/:id",
  asyncHandler(async (req, res) => {
    const ok = await deletePodcast(req.params.id);
    if (!ok) {
      throw createHttpError(404, "Подкаст не найден");
    }
    logAuditEvent({
      actorId: req.viewer.id,
      action: "istoki.podcast.delete",
      entityType: "istoki_podcast",
      entityId: req.params.id,
      payload: {},
    });
    res.status(204).end();
  }),
);

// ── Stories ────────────────────────────────────────────────────────

router.post(
  "/regions/:code/stories",
  validateBody(upsertIstokiStorySchema),
  asyncHandler(async (req, res) => {
    const id = await upsertStory({ ...req.body, regionCode: req.params.code });
    logAuditEvent({
      actorId: req.viewer.id,
      action: "istoki.story.upsert",
      entityType: "istoki_story",
      entityId: id,
      payload: { regionCode: req.params.code, participantName: req.body?.participantName },
    });
    res.status(201).json({ id });
  }),
);

router.put(
  "/stories/:id",
  validateBody(upsertIstokiStorySchema),
  asyncHandler(async (req, res) => {
    if (req.body.id && req.body.id !== req.params.id) {
      throw createHttpError(400, "ID в URL и теле не совпадают");
    }
    const existing = await getRegionByCodeForStory(req.params.id);
    if (!existing) {
      throw createHttpError(404, "История не найдена");
    }
    const id = await upsertStory({
      ...req.body,
      id: req.params.id,
      regionCode: existing.region_code,
    });
    logAuditEvent({
      actorId: req.viewer.id,
      action: "istoki.story.update",
      entityType: "istoki_story",
      entityId: id,
      payload: { participantName: req.body?.participantName },
    });
    res.json({ id });
  }),
);

router.delete(
  "/stories/:id",
  asyncHandler(async (req, res) => {
    const ok = await deleteStory(req.params.id);
    if (!ok) {
      throw createHttpError(404, "История не найдена");
    }
    logAuditEvent({
      actorId: req.viewer.id,
      action: "istoki.story.delete",
      entityType: "istoki_story",
      entityId: req.params.id,
      payload: {},
    });
    res.status(204).end();
  }),
);

// ── Chronicle ──────────────────────────────────────────────────────

router.post(
  "/regions/:code/chronicle",
  validateBody(upsertIstokiChronicleSchema),
  asyncHandler(async (req, res) => {
    const id = await upsertChronicleEntry({ ...req.body, regionCode: req.params.code });
    logAuditEvent({
      actorId: req.viewer.id,
      action: "istoki.chronicle.upsert",
      entityType: "istoki_chronicle",
      entityId: id,
      payload: { regionCode: req.params.code, eventTitle: req.body?.eventTitle },
    });
    res.status(201).json({ id });
  }),
);

router.put(
  "/chronicle/:id",
  validateBody(upsertIstokiChronicleSchema),
  asyncHandler(async (req, res) => {
    if (req.body.id && req.body.id !== req.params.id) {
      throw createHttpError(400, "ID в URL и теле не совпадают");
    }
    const existing = await getRegionByCodeForChronicle(req.params.id);
    if (!existing) {
      throw createHttpError(404, "Событие не найдено");
    }
    const id = await upsertChronicleEntry({
      ...req.body,
      id: req.params.id,
      regionCode: existing.region_code,
    });
    logAuditEvent({
      actorId: req.viewer.id,
      action: "istoki.chronicle.update",
      entityType: "istoki_chronicle",
      entityId: id,
      payload: { eventTitle: req.body?.eventTitle },
    });
    res.json({ id });
  }),
);

router.delete(
  "/chronicle/:id",
  asyncHandler(async (req, res) => {
    const ok = await deleteChronicleEntry(req.params.id);
    if (!ok) {
      throw createHttpError(404, "Событие не найдено");
    }
    logAuditEvent({
      actorId: req.viewer.id,
      action: "istoki.chronicle.delete",
      entityType: "istoki_chronicle",
      entityId: req.params.id,
      payload: {},
    });
    res.status(204).end();
  }),
);

// ── Uploads ────────────────────────────────────────────────────────

router.post(
  "/uploads/audio",
  audioUploader,
  asyncHandler(async (req, res) => {
    if (!req.file) throw createHttpError(400, "Файл не получен");
    const result = persistUpload({ kind: "audio", file: req.file });
    logAuditEvent({
      actorId: req.viewer.id,
      action: "istoki.upload.audio",
      entityType: "istoki_upload",
      entityId: result.filename,
      payload: { sizeBytes: result.sizeBytes, mime: result.mime },
    });
    res.status(201).json(result);
  }),
);

router.post(
  "/uploads/photo",
  photoUploader,
  asyncHandler(async (req, res) => {
    if (!req.file) throw createHttpError(400, "Файл не получен");
    const result = persistUpload({ kind: "photo", file: req.file });
    logAuditEvent({
      actorId: req.viewer.id,
      action: "istoki.upload.photo",
      entityType: "istoki_upload",
      entityId: result.filename,
      payload: { sizeBytes: result.sizeBytes, mime: result.mime },
    });
    res.status(201).json(result);
  }),
);

// ── Helpers ────────────────────────────────────────────────────────

const { query } = require("../db/postgres.cjs");

async function getRegionByCodeForPodcast(podcastId) {
  const result = await query(`select region_code from istoki_podcasts where id = $1 limit 1`, [
    podcastId,
  ]);
  return result.rows[0] || null;
}

async function getRegionByCodeForStory(storyId) {
  const result = await query(`select region_code from istoki_stories where id = $1 limit 1`, [
    storyId,
  ]);
  return result.rows[0] || null;
}

async function getRegionByCodeForChronicle(chronicleId) {
  const result = await query(`select region_code from istoki_chronicle where id = $1 limit 1`, [
    chronicleId,
  ]);
  return result.rows[0] || null;
}

module.exports = router;
