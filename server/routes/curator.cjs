"use strict";

const { Router } = require("express");
const { getCuratorDashboard } = require("../db/repositories/analyticsStore.cjs");
const {
  getCuratorNarrativeBrief,
  listSessionDaysForCurator,
} = require("../services/narrativeBriefService.cjs");
const { getSessionLlmSettings } = require("../db/repositories/sessionStore.cjs");
const { getCuratorUsageReport } = require("../services/curatorLlmGuard.cjs");
const {
  listChatThread,
  sendChatMessage,
  resetChatThread,
  previewChatContext,
} = require("../services/curatorChatService.cjs");
const { listContextOptions } = require("../services/curatorChatContext.cjs");
const presetsStore = require("../db/repositories/curatorChatPresetsStore.cjs");
const { ensureCuratorAccess } = require("../db/repositories/analyticsStore.cjs");
const { asyncHandler, getViewerId, createHttpError } = require("../lib/routeHelpers.cjs");

const router = Router();

/**
 * Резолвит модель/maxTokens с учётом sessions.llm_settings и опционального
 * requested-параметра из тела/query. Если требуемая модель не входит в
 * `allowedModels` сессии — мягко падает обратно на default.
 */
async function resolveModelFor(sessionId, requested) {
  const settings = await getSessionLlmSettings(sessionId);
  const model =
    requested && settings.allowedModels.includes(requested) ? requested : settings.defaultModel;
  return { model, maxTokens: settings.maxTokensPerCall, settings };
}

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
    const { model, maxTokens } = await resolveModelFor(req.params.sessionId, null);
    res.json(
      await getCuratorNarrativeBrief({
        viewerId: getViewerId(req),
        sessionId: req.params.sessionId,
        groupId: req.params.groupId,
        dayId: req.query.dayId || null,
        model,
        maxTokens,
      }),
    );
  }),
);

// POST /api/curator/sessions/:sessionId/groups/:groupId/brief/regenerate
// Кнопка «Перегенерировать» — обходит кеш, помечает старые версии stale,
// делает свежий LLM-вызов и сохраняет результат. body: { dayId, model? }.
router.post(
  "/sessions/:sessionId/groups/:groupId/brief/regenerate",
  asyncHandler(async (req, res) => {
    const requested = req.body || {};
    const { model, maxTokens } = await resolveModelFor(
      req.params.sessionId,
      requested.model || null,
    );
    const brief = await getCuratorNarrativeBrief({
      viewerId: getViewerId(req),
      sessionId: req.params.sessionId,
      groupId: req.params.groupId,
      dayId: requested.dayId || null,
      force: true,
      model,
      maxTokens,
    });
    res.status(201).json(brief);
  }),
);

// GET /api/curator/sessions/:sessionId/groups/:groupId/days
// Список дней сессии для day-picker'а с флагом hasEntries по этой группе.
router.get(
  "/sessions/:sessionId/groups/:groupId/days",
  asyncHandler(async (req, res) => {
    res.json(
      await listSessionDaysForCurator({
        viewerId: getViewerId(req),
        sessionId: req.params.sessionId,
        groupId: req.params.groupId,
      }),
    );
  }),
);

// GET /api/curator/sessions/:sessionId/usage/me
// Личный отчёт куратора: расход токенов сегодня, бюджет, разбивка по kind.
router.get(
  "/sessions/:sessionId/usage/me",
  asyncHandler(async (req, res) => {
    res.json(
      await getCuratorUsageReport({
        sessionId: req.params.sessionId,
        curatorId: getViewerId(req),
      }),
    );
  }),
);

// ---------------------------------------------------------------------------
// Chat «Разговор с ИИ» — Curator AI v2 Phase 5
// ---------------------------------------------------------------------------

// GET /api/curator/sessions/:sessionId/groups/:groupId/chat/thread
// Возвращает активный thread + его сообщения (создаёт пустой если ещё нет).
router.get(
  "/sessions/:sessionId/groups/:groupId/chat/thread",
  asyncHandler(async (req, res) => {
    res.json(
      await listChatThread({
        viewerId: getViewerId(req),
        sessionId: req.params.sessionId,
        groupId: req.params.groupId,
      }),
    );
  }),
);

// POST /api/curator/sessions/:sessionId/groups/:groupId/chat/messages
// body: { text: string, model?: string, filter?: ContextFilter }
router.post(
  "/sessions/:sessionId/groups/:groupId/chat/messages",
  asyncHandler(async (req, res) => {
    const result = await sendChatMessage({
      viewerId: getViewerId(req),
      sessionId: req.params.sessionId,
      groupId: req.params.groupId,
      text: req.body?.text || "",
      requestedModel: req.body?.model || null,
      filter: req.body?.filter,
    });
    res.status(201).json(result);
  }),
);

// POST /api/curator/sessions/:sessionId/groups/:groupId/chat/reset
// Архивирует текущий thread, создаёт новый пустой.
router.post(
  "/sessions/:sessionId/groups/:groupId/chat/reset",
  asyncHandler(async (req, res) => {
    res.status(201).json(
      await resetChatThread({
        viewerId: getViewerId(req),
        sessionId: req.params.sessionId,
        groupId: req.params.groupId,
      }),
    );
  }),
);

// POST /api/curator/sessions/:sessionId/groups/:groupId/chat/preview
// body: { filter? }  → собранный preamble без LLM-вызова
router.post(
  "/sessions/:sessionId/groups/:groupId/chat/preview",
  asyncHandler(async (req, res) => {
    const result = await previewChatContext({
      viewerId: getViewerId(req),
      sessionId: req.params.sessionId,
      groupId: req.params.groupId,
      filter: req.body?.filter,
    });
    res.json(result);
  }),
);

// GET /api/curator/sessions/:sessionId/groups/:groupId/chat/context-options
// Чек-листы для picker'а: участники группы, события сессии (дни — отдельным endpoint'ом).
router.get(
  "/sessions/:sessionId/groups/:groupId/chat/context-options",
  asyncHandler(async (req, res) => {
    const viewerId = getViewerId(req);
    await ensureCuratorAccess(viewerId, req.params.sessionId, req.params.groupId);
    res.json(
      await listContextOptions({
        sessionId: req.params.sessionId,
        groupId: req.params.groupId,
      }),
    );
  }),
);

// ---------------------------------------------------------------------------
// Chat context presets (Curator AI v2.1)
// ---------------------------------------------------------------------------

// GET /api/curator/sessions/:sessionId/groups/:groupId/chat/presets
router.get(
  "/sessions/:sessionId/groups/:groupId/chat/presets",
  asyncHandler(async (req, res) => {
    const viewerId = getViewerId(req);
    await ensureCuratorAccess(viewerId, req.params.sessionId, req.params.groupId);
    res.json(
      await presetsStore.listByCuratorGroup({
        sessionId: req.params.sessionId,
        groupId: req.params.groupId,
        curatorId: viewerId,
      }),
    );
  }),
);

// POST /api/curator/sessions/:sessionId/groups/:groupId/chat/presets
// body: { label, filter, isDefault? }
router.post(
  "/sessions/:sessionId/groups/:groupId/chat/presets",
  asyncHandler(async (req, res) => {
    const viewerId = getViewerId(req);
    await ensureCuratorAccess(viewerId, req.params.sessionId, req.params.groupId);
    const label = String(req.body?.label || "").trim();
    if (!label) throw createHttpError(400, "Название preset'а обязательно");
    const created = await presetsStore.createPreset({
      sessionId: req.params.sessionId,
      groupId: req.params.groupId,
      curatorId: viewerId,
      label: label.slice(0, 120),
      filter: req.body?.filter,
      isDefault: Boolean(req.body?.isDefault),
      createdBy: viewerId,
    });
    res.status(201).json(created);
  }),
);

// PATCH /api/curator/sessions/:sessionId/groups/:groupId/chat/presets/:presetId
router.patch(
  "/sessions/:sessionId/groups/:groupId/chat/presets/:presetId",
  asyncHandler(async (req, res) => {
    const viewerId = getViewerId(req);
    await ensureCuratorAccess(viewerId, req.params.sessionId, req.params.groupId);
    const existing = await presetsStore.getById(req.params.presetId);
    if (!existing || existing.curatorId !== viewerId) {
      throw createHttpError(404, "Preset не найден");
    }
    const patch = {};
    if (req.body?.label !== undefined) {
      const label = String(req.body.label).trim();
      if (!label) throw createHttpError(400, "Название preset'а не должно быть пустым");
      patch.label = label.slice(0, 120);
    }
    if (req.body?.filter !== undefined) patch.filter = req.body.filter;
    if (req.body?.isDefault !== undefined) patch.isDefault = Boolean(req.body.isDefault);
    const updated = await presetsStore.updatePreset(req.params.presetId, patch);
    res.json(updated);
  }),
);

// DELETE /api/curator/sessions/:sessionId/groups/:groupId/chat/presets/:presetId
router.delete(
  "/sessions/:sessionId/groups/:groupId/chat/presets/:presetId",
  asyncHandler(async (req, res) => {
    const viewerId = getViewerId(req);
    await ensureCuratorAccess(viewerId, req.params.sessionId, req.params.groupId);
    const existing = await presetsStore.getById(req.params.presetId);
    if (!existing || existing.curatorId !== viewerId) {
      throw createHttpError(404, "Preset не найден");
    }
    await presetsStore.deletePreset(req.params.presetId);
    res.status(204).send();
  }),
);

module.exports = router;
