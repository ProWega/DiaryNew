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
const { query } = require("../db/postgres.cjs");
const inviteBatchesStore = require("../db/repositories/inviteBatchesStore.cjs");
const { createMagicLink } = require("../db/repositories/authStore.cjs");
const inviteDocumentService = require("../services/inviteDocumentService.cjs");
const { inviteBulkUploader } = require("../lib/uploads.cjs");
const { logAuditEvent } = require("../services/auditLog.cjs");

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

// ---------------------------------------------------------------------------
// Group overview & invitations (вкладка «Состав группы»)
// ---------------------------------------------------------------------------

/**
 * Собирает per-member состояние сегодня/вчера + рефлексия + последний коммент
 * + журней-этап. Один комбинированный запрос, возвращает массив.
 */
async function fetchGroupRoster(sessionId, groupId) {
  const result = await query(
    `
    with members as (
      select u.id as user_id, u.full_name, su.journey_stage
      from session_users su
      join users u on u.id = su.user_id
      where su.session_id = $1 and su.group_id = $2
        and su.role = 'participant' and su.status = 'active'
    ),
    today_entries as (
      select de.user_id,
             (array_agg(de.state_id order by de.responded_at desc)
                filter (where de.state_id is not null))[1] as state_id,
             max(de.responded_at) filter (where coalesce(trim(de.comment), '') <> '')
               as last_comment_at
      from diary_entries de
      join program_events e on e.id = de.event_id
      join program_days d on d.id = e.day_id
      where de.session_id = $1
        and de.responded_at is not null
        and (d.date_value is null or d.date_value::date = (now() at time zone 'utc')::date)
      group by de.user_id
    ),
    yesterday_entries as (
      select de.user_id,
             (array_agg(de.state_id order by de.responded_at desc)
                filter (where de.state_id is not null))[1] as state_id
      from diary_entries de
      join program_events e on e.id = de.event_id
      join program_days d on d.id = e.day_id
      where de.session_id = $1
        and de.responded_at is not null
        and d.date_value::date = ((now() at time zone 'utc')::date - interval '1 day')::date
      group by de.user_id
    ),
    today_reflections as (
      select dr.user_id, dr.responded_at
      from daily_reflections dr
      join program_days d on d.id = dr.day_id
      where dr.session_id = $1
        and dr.responded_at is not null
        and d.date_value::date = (now() at time zone 'utc')::date
    )
    select m.user_id, m.full_name, m.journey_stage,
           t.state_id as today_state_id,
           y.state_id as yesterday_state_id,
           t.last_comment_at,
           (tr.responded_at is not null) as reflection_done
    from members m
    left join today_entries t on t.user_id = m.user_id
    left join yesterday_entries y on y.user_id = m.user_id
    left join today_reflections tr on tr.user_id = m.user_id
    order by m.full_name
  `,
    [sessionId, groupId],
  );

  // Имена 7-балльной шкалы — те же, что в narrativeBriefService.
  const stateLabels = {
    apathy: "Апатия",
    passive: "Пассивность",
    relaxed: "Расслабленность",
    balance: "Баланс",
    engaged: "Включённость",
    overstimulated: "Перевозбуждённость",
    panic: "Паника",
  };
  const stateLevels = {
    apathy: 0,
    passive: 1,
    relaxed: 2,
    balance: 3,
    engaged: 4,
    overstimulated: 5,
    panic: 6,
  };

  return result.rows.map((row) => ({
    userId: row.user_id,
    fullName: row.full_name || "",
    journeyStage: row.journey_stage || null,
    todayState: row.today_state_id
      ? { id: row.today_state_id, label: stateLabels[row.today_state_id] || row.today_state_id }
      : null,
    yesterdayState: row.yesterday_state_id
      ? {
          id: row.yesterday_state_id,
          label: stateLabels[row.yesterday_state_id] || row.yesterday_state_id,
        }
      : null,
    todayLevel: row.today_state_id ? (stateLevels[row.today_state_id] ?? null) : null,
    reflectionDone: Boolean(row.reflection_done),
    lastCommentAt: row.last_comment_at || null,
  }));
}

// GET /api/curator/sessions/:sid/groups/:gid/overview
router.get(
  "/sessions/:sessionId/groups/:groupId/overview",
  asyncHandler(async (req, res) => {
    const viewerId = getViewerId(req);
    await ensureCuratorAccess(viewerId, req.params.sessionId, req.params.groupId);

    const members = await fetchGroupRoster(req.params.sessionId, req.params.groupId);
    const invitations = await inviteBatchesStore.getInvitesForGroup({
      sessionId: req.params.sessionId,
      groupId: req.params.groupId,
    });

    const totalMembers = members.length;
    const activeToday = members.filter((m) => m.todayState).length;
    const reflectionsDone = members.filter((m) => m.reflectionDone).length;
    const pendingInvites = invitations.filter((i) => i.status === "pending").length;
    const activeLevels = members.map((m) => m.todayLevel).filter((l) => Number.isFinite(l));
    const avgActivationToday =
      activeLevels.length > 0
        ? Number((activeLevels.reduce((sum, l) => sum + l, 0) / activeLevels.length).toFixed(1))
        : null;

    res.json({
      metrics: {
        totalMembers,
        activeToday,
        reflectionsDone,
        pendingInvites,
        avgActivationToday,
      },
      members,
    });
  }),
);

// GET /api/curator/sessions/:sid/groups/:gid/invitations
router.get(
  "/sessions/:sessionId/groups/:groupId/invitations",
  asyncHandler(async (req, res) => {
    const viewerId = getViewerId(req);
    await ensureCuratorAccess(viewerId, req.params.sessionId, req.params.groupId);

    const invitations = await inviteBatchesStore.getInvitesForGroup({
      sessionId: req.params.sessionId,
      groupId: req.params.groupId,
    });

    // Дополняем каждый pending qrDataUrl'ом для inline-отображения.
    const withQr = await Promise.all(
      invitations.map(async (inv) => {
        if (!inv.url) return inv;
        try {
          const qrDataUrl = await inviteDocumentService.renderQrDataUrl(inv.url, 220);
          return { ...inv, qrDataUrl };
        } catch {
          return inv;
        }
      }),
    );

    res.json({ invitations: withQr });
  }),
);

// GET /api/curator/sessions/:sid/groups/:gid/invitations/template.xlsx
router.get(
  "/sessions/:sessionId/groups/:groupId/invitations/template.xlsx",
  asyncHandler(async (req, res) => {
    const viewerId = getViewerId(req);
    await ensureCuratorAccess(viewerId, req.params.sessionId, req.params.groupId);
    const buf = inviteDocumentService.buildCuratorNamesTemplateXlsx();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", `attachment; filename="curator-names-template.xlsx"`);
    res.status(200).send(buf);
  }),
);

// POST /api/curator/sessions/:sid/groups/:gid/invitations
// body: { fullName: string, ttlMinutes?: number }
router.post(
  "/sessions/:sessionId/groups/:groupId/invitations",
  asyncHandler(async (req, res) => {
    const viewerId = getViewerId(req);
    await ensureCuratorAccess(viewerId, req.params.sessionId, req.params.groupId);

    const fullName = String(req.body?.fullName || "").trim();
    if (fullName.length < 2) {
      throw createHttpError(400, "Имя должно быть не короче 2 символов");
    }
    const ttlMinutes = Math.max(
      15,
      Math.min(
        60 * 24 * 30,
        Number(req.body?.ttlMinutes) || inviteDocumentService.DEFAULT_TTL_MINUTES,
      ),
    );

    const groupRow = await query(`select name from groups where id = $1 limit 1`, [
      req.params.groupId,
    ]);
    const groupName = groupRow.rows[0]?.name || null;

    const targetUserId = await inviteDocumentService.findExistingSessionUserId({
      sessionId: req.params.sessionId,
      fullName,
    });

    const link = await createMagicLink({
      creatorId: viewerId,
      purpose: "invite",
      targetUserId,
      sessionId: req.params.sessionId,
      role: "participant",
      groupId: req.params.groupId,
      fullName,
      ttlMinutes,
      meta: {
        source: "curator-invite",
        reusedExistingUser: Boolean(targetUserId),
      },
    });

    const invite = {
      groupId: req.params.groupId,
      groupName,
      role: "participant",
      fullName,
      url: link.url,
      expiresAt: link.expiresAt,
      magicLinkId: link.id,
    };

    try {
      await inviteBatchesStore.persistInviteBatch({
        sessionId: req.params.sessionId,
        actorId: viewerId,
        invites: [invite],
        layout: "card",
        ttlMinutes,
      });
    } catch (error) {
      console.warn("[curator] invite batch persist failed:", error?.message || error);
    }

    logAuditEvent({
      actorId: viewerId,
      sessionId: req.params.sessionId,
      action: "curator.invite.single",
      entityType: "magic_link",
      entityId: link.id,
      payload: {
        groupId: req.params.groupId,
        fullName,
        reusedExistingUser: Boolean(targetUserId),
        ttlMinutes,
      },
    });

    let qrDataUrl = null;
    try {
      qrDataUrl = await inviteDocumentService.renderQrDataUrl(link.url, 220);
    } catch {
      // Не критично — фронт обойдётся без QR
    }

    res.status(201).json({
      invite: {
        ...invite,
        createdAt: new Date().toISOString(),
        createdBy: viewerId,
        consumedAt: null,
        status: "pending",
        qrDataUrl,
      },
    });
  }),
);

// POST /api/curator/sessions/:sid/groups/:gid/invitations/bulk
// multipart: file (xlsx, 1 столбец ФИО) ИЛИ body { names: string[], ttlMinutes? }
router.post(
  "/sessions/:sessionId/groups/:groupId/invitations/bulk",
  inviteBulkUploader,
  asyncHandler(async (req, res) => {
    const viewerId = getViewerId(req);
    await ensureCuratorAccess(viewerId, req.params.sessionId, req.params.groupId);

    let names = [];
    const warnings = [];

    const xlsxFile = req.files?.file?.[0];
    if (xlsxFile) {
      const parsed = inviteDocumentService.parseCuratorNamesXlsx(xlsxFile.buffer);
      names = parsed.names;
      warnings.push(...(parsed.warnings || []));
    } else if (Array.isArray(req.body?.names)) {
      const seen = new Set();
      for (const raw of req.body.names) {
        const name = String(raw || "").trim();
        if (!name || name.length < 2) continue;
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        names.push(name);
      }
    } else {
      throw createHttpError(400, "Нужен либо xlsx-файл, либо body { names: [...] }");
    }

    if (!names.length) {
      throw createHttpError(400, "Список имён пустой");
    }

    const ttlMinutes = Math.max(
      15,
      Math.min(
        60 * 24 * 30,
        Number(req.body?.ttlMinutes) || inviteDocumentService.DEFAULT_TTL_MINUTES,
      ),
    );

    const groupRow = await query(`select name from groups where id = $1 limit 1`, [
      req.params.groupId,
    ]);
    const groupName = groupRow.rows[0]?.name || null;

    const invitesForBatch = [];
    const response = [];
    let dedupCount = 0;
    for (const fullName of names) {
      const targetUserId = await inviteDocumentService.findExistingSessionUserId({
        sessionId: req.params.sessionId,
        fullName,
      });
      if (targetUserId) dedupCount += 1;
      const link = await createMagicLink({
        creatorId: viewerId,
        purpose: "invite",
        targetUserId,
        sessionId: req.params.sessionId,
        role: "participant",
        groupId: req.params.groupId,
        fullName,
        ttlMinutes,
        meta: {
          source: "curator-invite",
          batch: true,
          reusedExistingUser: Boolean(targetUserId),
        },
      });
      const item = {
        groupId: req.params.groupId,
        groupName,
        role: "participant",
        fullName,
        url: link.url,
        expiresAt: link.expiresAt,
        magicLinkId: link.id,
      };
      invitesForBatch.push(item);
      response.push({
        ...item,
        createdAt: new Date().toISOString(),
        createdBy: viewerId,
        consumedAt: null,
        status: "pending",
      });
    }

    try {
      await inviteBatchesStore.persistInviteBatch({
        sessionId: req.params.sessionId,
        actorId: viewerId,
        invites: invitesForBatch,
        layout: "card",
        ttlMinutes,
      });
    } catch (error) {
      console.warn("[curator] bulk invite batch persist failed:", error?.message || error);
    }

    logAuditEvent({
      actorId: viewerId,
      sessionId: req.params.sessionId,
      action: "curator.invite.bulk",
      entityType: "group",
      entityId: req.params.groupId,
      payload: {
        count: invitesForBatch.length,
        namesCount: names.length,
        dedupCount,
        ttlMinutes,
        viaXlsx: Boolean(xlsxFile),
      },
    });

    // Generate QR data URLs in parallel for client display.
    const withQr = await Promise.all(
      response.map(async (inv) => {
        try {
          const qrDataUrl = await inviteDocumentService.renderQrDataUrl(inv.url, 220);
          return { ...inv, qrDataUrl };
        } catch {
          return inv;
        }
      }),
    );

    res.status(201).json({ invitations: withQr, warnings });
  }),
);

module.exports = router;
