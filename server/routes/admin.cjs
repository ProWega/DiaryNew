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
const { asyncHandler, createHttpError, requireAdmin } = require("../lib/routeHelpers.cjs");
const { logAuditEvent } = require("../services/auditLog.cjs");
const agentPromptsStore = require("../db/repositories/agentPromptsStore.cjs");
const agentPromptsService = require("../services/agentPromptsService.cjs");
const aiReportsStore = require("../db/repositories/aiReportsStore.cjs");
const programAnalyticsService = require("../services/programAnalyticsService.cjs");
const { callLlm } = require("../services/llmClient.cjs");
const { KNOWN_MODELS } = require("../services/llmSettings.cjs");

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

// ---------------------------------------------------------------------------
// AI Agent prompts — настраиваемые промпты и порядок сбора preamble-блоков.
// См. docs/architecture/backend-services.md, раздел «Настройка ИИ-агентов».
// ---------------------------------------------------------------------------

const AGENT_PROMPT_MAX_TEXT = 20_000;
const AGENT_PROMPT_PREVIEW_DEFAULT_MAX_TOKENS = 600;
const AGENT_PROMPT_PREVIEW_DEFAULT_MODEL = "claude-haiku-4-5";

function validateAgentType(value) {
  const v = String(value || "").trim();
  if (!v || !/^[a-z][a-z0-9_]{0,40}$/.test(v)) {
    throw createHttpError(400, "agentType должен быть kebab-/snake_case строкой (a-z0-9_)");
  }
  return v;
}

function validateBlocksConfig(value, agentType) {
  if (!Array.isArray(value)) return [];
  const knownKeys = new Set(agentPromptsService.listBlockCatalog(agentType).map((b) => b.key));
  return value
    .map((block) => {
      if (!block || typeof block !== "object") return null;
      const key = String(block.key || "").trim();
      if (!key) return null;
      // Для известных типов агента — фильтруем неизвестные ключи (но не
      // ломаемся — `composePreamble` сам пропустит unknown). Для кастомных
      // типов — пропускаем любые ключи.
      if (knownKeys.size > 0 && !knownKeys.has(key)) return null;
      return { key, enabled: block.enabled !== false };
    })
    .filter(Boolean);
}

function validatePayload(req, agentType) {
  const body = req.body || {};
  const systemText = String(body.systemText || "").trim();
  if (!systemText) {
    throw createHttpError(400, "systemText не может быть пустым");
  }
  if (systemText.length > AGENT_PROMPT_MAX_TEXT) {
    throw createHttpError(400, `systemText длиннее ${AGENT_PROMPT_MAX_TEXT} символов`);
  }
  const blocksConfig = validateBlocksConfig(body.blocksConfig, agentType);
  const maxTokens =
    body.maxTokens === null || body.maxTokens === undefined ? null : Number(body.maxTokens);
  if (maxTokens !== null && (!Number.isFinite(maxTokens) || maxTokens < 32 || maxTokens > 8000)) {
    throw createHttpError(400, "maxTokens должен быть числом 32..8000");
  }
  return {
    name: body.name ? String(body.name).slice(0, 200) : null,
    systemText,
    blocksConfig,
    model: body.model ? String(body.model).slice(0, 60) : null,
    maxTokens,
    notes: body.notes ? String(body.notes).slice(0, 2000) : null,
  };
}

// GET /api/admin/agent-prompts — список всех current версий + каталог блоков
router.get(
  "/agent-prompts",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const current = await agentPromptsStore.listCurrent();
    const known = agentPromptsService.listKnownAgentTypes();

    // Дополняем список fallback'ами для известных типов, у которых нет
    // current-row в БД (т.е. миграция не прошла или строка удалена).
    const byType = new Map(current.map((row) => [row.agentType, row]));
    const merged = known.map((type) => {
      if (byType.has(type)) return byType.get(type);
      const fb = agentPromptsService.HARDCODED_FALLBACK[type];
      return {
        id: null,
        agentType: type,
        name: fb?.name || type,
        version: 0,
        systemText: fb?.systemText || "",
        blocksConfig: fb?.blocksConfig ? [...fb.blocksConfig] : [],
        model: null,
        maxTokens: null,
        isCurrent: false,
        notes: "(fallback из кода — миграция не запущена)",
        createdBy: null,
        createdAt: null,
      };
    });
    // Дописываем кастомные типы, которые есть в БД, но не в каталоге
    for (const row of current) {
      if (!known.includes(row.agentType)) merged.push(row);
    }

    const catalog = Object.fromEntries(
      known.map((type) => [type, agentPromptsService.listBlockCatalog(type)]),
    );

    res.json({ agents: merged, catalog, knownModels: [...KNOWN_MODELS] });
  }),
);

// GET /api/admin/agent-prompts/:agentType — current версия одного агента
router.get(
  "/agent-prompts/:agentType",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const agentType = validateAgentType(req.params.agentType);
    const row = await agentPromptsStore.getCurrent(agentType);
    if (row) {
      res.json({ agent: row, catalog: agentPromptsService.listBlockCatalog(agentType) });
      return;
    }
    const fb = agentPromptsService.HARDCODED_FALLBACK[agentType];
    if (!fb) {
      throw createHttpError(404, "Агент с таким типом не найден");
    }
    res.json({
      agent: {
        id: null,
        agentType,
        name: fb.name,
        version: 0,
        systemText: fb.systemText,
        blocksConfig: [...fb.blocksConfig],
        model: null,
        maxTokens: null,
        isCurrent: false,
        notes: "(fallback из кода)",
        createdBy: null,
        createdAt: null,
      },
      catalog: agentPromptsService.listBlockCatalog(agentType),
    });
  }),
);

// GET /api/admin/agent-prompts/:agentType/history — все версии (DESC)
router.get(
  "/agent-prompts/:agentType/history",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const agentType = validateAgentType(req.params.agentType);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const history = await agentPromptsStore.listHistory(agentType, { limit });
    res.json({ history });
  }),
);

// POST /api/admin/agent-prompts/:agentType — сохранить как новую версию
router.post(
  "/agent-prompts/:agentType",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const agentType = validateAgentType(req.params.agentType);
    const payload = validatePayload(req, agentType);
    if (!payload.name) {
      // если name не задан — берём имя из fallback'а или сам agent_type
      const fb = agentPromptsService.HARDCODED_FALLBACK[agentType];
      payload.name = fb?.name || agentType;
    }
    const result = await agentPromptsStore.saveNewVersion(agentType, payload, req.viewer.id);
    agentPromptsService.invalidateCache(agentType);
    logAuditEvent({
      actorId: req.viewer.id,
      action: "admin.agent_prompts.created",
      entityType: "agent_prompt",
      entityId: result.id,
      payload: {
        agentType,
        version: result.version,
        blocksCount: result.blocksConfig.length,
        hasNotes: Boolean(payload.notes),
      },
    });
    res.status(201).json({ agent: result });
  }),
);

// POST /api/admin/agent-prompts/restore/:versionId — откат на сохранённую версию
router.post(
  "/agent-prompts/restore/:versionId",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const versionId = String(req.params.versionId || "").trim();
    if (!versionId) throw createHttpError(400, "versionId не задан");
    const result = await agentPromptsStore.restoreVersion(versionId, req.viewer.id);
    agentPromptsService.invalidateCache(result.agentType);
    logAuditEvent({
      actorId: req.viewer.id,
      action: "admin.agent_prompts.restored",
      entityType: "agent_prompt",
      entityId: result.id,
      payload: {
        agentType: result.agentType,
        version: result.version,
        restoredFrom: versionId,
      },
    });
    res.status(201).json({ agent: result });
  }),
);

// POST /api/admin/agent-prompts/:agentType/preview — прогон LLM с draft'ом
// без сохранения. Preamble для curator_chat собирается из buildPreamble,
// для остальных типов — только system + user question (расширим в фазе 4).
router.post(
  "/agent-prompts/:agentType/preview",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const agentType = validateAgentType(req.params.agentType);
    const body = req.body || {};
    const systemText = String(body.systemText || "").trim();
    if (!systemText) throw createHttpError(400, "systemText не задан");
    if (systemText.length > AGENT_PROMPT_MAX_TEXT) {
      throw createHttpError(400, "systemText слишком длинный");
    }

    const userQuestion = String(body.userQuestion || "").trim();
    const sessionId = body.sessionId ? String(body.sessionId) : null;
    const groupId = body.groupId ? String(body.groupId) : null;
    const model = body.model ? String(body.model).slice(0, 60) : AGENT_PROMPT_PREVIEW_DEFAULT_MODEL;
    const maxTokens = Number(body.maxTokens) || AGENT_PROMPT_PREVIEW_DEFAULT_MAX_TOKENS;
    const blocksConfig = validateBlocksConfig(body.blocksConfig, agentType);
    const previewOnly = body.previewOnly === true;

    // Собираем preamble для preview. В Phase 2 — только curator_chat имеет
    // реальный preamble; остальные типы получают пустой блок (phase 4 расширит).
    let preamble = "";
    if (agentType === "curator_chat" && sessionId && groupId) {
      try {
        const { buildPreamble } = require("../services/curatorChatContext.cjs");
        const preambleResult = await buildPreamble({
          sessionId,
          groupId,
          filter: {},
          // Передаём draft blocksConfig, чтобы consumer-в-фазе-3 уважал их.
          blocksConfig,
        });
        const parts = [
          preambleResult.membersBlock,
          preambleResult.feedbackBlock,
          preambleResult.conceptsBlock,
        ].filter(Boolean);
        preamble = parts.join("\n\n");
      } catch (err) {
        // Не блокируем preview, если preamble недоступен — даём админу
        // понять, что система задеплоена, но контекст не собрался.
        preamble = `[preamble недоступен: ${err?.message || err}]`;
      }
    }

    const startedAt = Date.now();
    let output = "";
    let usage = null;
    let llmError = null;

    if (!previewOnly) {
      try {
        const llmResult = await callLlm({
          model,
          maxTokens,
          systemBlocks: [
            { text: systemText, cacheable: false },
            ...(preamble ? [{ text: preamble, cacheable: false }] : []),
          ],
          messages: [
            {
              role: "user",
              content: userQuestion || "Сделай короткий тестовый ответ согласно роли.",
            },
          ],
        });
        output = llmResult.text;
        usage = llmResult.usage;
      } catch (err) {
        llmError = err?.message || "LLM call failed";
      }
    }

    const durationMs = Date.now() - startedAt;

    logAuditEvent({
      actorId: req.viewer.id,
      sessionId,
      action: "admin.agent_prompts.preview",
      entityType: "agent_prompt",
      entityId: agentType,
      payload: {
        agentType,
        sessionId,
        groupId,
        model: previewOnly ? null : model,
        previewOnly,
        tokens: usage,
        ok: previewOnly ? true : !llmError,
      },
    });

    res.json({
      agentType,
      model: previewOnly ? null : model,
      previewOnly,
      preamble,
      output,
      usage,
      durationMs,
      error: llmError,
    });
  }),
);

// ---------------------------------------------------------------------------
// AI Reports (Phase 4) — отчёты «Анализ программы» и т.п.
// Хранятся в существующей таблице ai_reports (scope = "program-analytics").
// ---------------------------------------------------------------------------

// POST /api/admin/ai-reports/program-analytics/generate — запустить анализ
router.post(
  "/ai-reports/program-analytics/generate",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const sessionId = String(req.body?.sessionId || "").trim();
    if (!sessionId) throw createHttpError(400, "sessionId не задан");
    const model = req.body?.model ? String(req.body.model).slice(0, 60) : null;
    const maxTokens = req.body?.maxTokens === undefined ? null : Number(req.body.maxTokens);
    const title = req.body?.title ? String(req.body.title).slice(0, 200) : null;

    const result = await programAnalyticsService.generateReport({
      sessionId,
      actorId: req.viewer.id,
      model,
      maxTokens,
      title,
    });

    logAuditEvent({
      actorId: req.viewer.id,
      sessionId,
      action: "admin.ai_report.generated",
      entityType: "ai_report",
      entityId: result.report.id,
      payload: {
        scope: "program-analytics",
        version: result.report.version,
        ok: !result.llmError,
      },
    });

    res.status(201).json({ report: result.report, error: result.llmError });
  }),
);

// GET /api/admin/ai-reports?sessionId=...&scope=program-analytics
router.get(
  "/ai-reports",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const sessionId = req.query.sessionId ? String(req.query.sessionId) : null;
    const scope = req.query.scope ? String(req.query.scope) : null;
    const groupId = req.query.groupId ? String(req.query.groupId) : null;
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const reports = await aiReportsStore.listReports({ sessionId, scope, groupId, limit });
    res.json({ reports });
  }),
);

// GET /api/admin/ai-reports/:reportId
router.get(
  "/ai-reports/:reportId",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const report = await aiReportsStore.getReport(req.params.reportId);
    if (!report) throw createHttpError(404, "Отчёт не найден");
    res.json({ report });
  }),
);

module.exports = router;
