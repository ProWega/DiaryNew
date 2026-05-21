"use strict";

const { randomUUID } = require("node:crypto");
const { Router } = require("express");
const { getWorkspace, updateWorkspace } = require("../db/organizerWorkspaceStore.cjs");
const {
  assignOrganizerGroupCurator,
  assignParticipantsToOrganizerGroup,
  createOrganizerGroup,
  deleteOrganizerGroup,
  getOrganizerAnalyticsSnapshot,
  updateOrganizerGroup,
} = require("../db/repositories/organizerStore.cjs");
const {
  applyLlmSettingsPatch,
  createSession,
  getSessionLlmSettings,
  listSessions,
  updateRegistration,
  updateSession,
} = require("../db/repositories/sessionStore.cjs");
const { getUser } = require("../db/repositories/userStore.cjs");
const {
  asyncHandler,
  createHttpError,
  getViewerId,
  isAdminViewer,
  isOrganizerViewer,
  requireOrganizer,
} = require("../lib/routeHelpers.cjs");
const { validateBody } = require("../validation/middleware.cjs");
const {
  assignCuratorSchema,
  assignParticipantsSchema,
  createGroupSchema,
  createProgramSchema,
  createSessionSchema,
  programDaySchema,
  programEventSchema,
  publishSurveySchema,
  createSurveySchema,
  surveyQuestionBodySchema,
  updateDayFlowsSchema,
  updateFlowOrderSchema,
  updateGroupSchema,
  updateProgramSchema,
  updateRegistrationSchema,
  updateSessionSchema,
  updateSessionSettingsSchema,
  updateSurveySchema,
} = require("../validation/organizerSchemas.cjs");
const flow = require("../services/programFlowService.cjs");
const norm = require("../services/programNormalizers.cjs");
const workspace = require("../services/programWorkspaceService.cjs");
const audience = require("../services/surveyAudienceService.cjs");
const eventConceptsStore = require("../db/repositories/eventConceptsStore.cjs");
const { documentUploader, inviteBulkUploader, persistUpload } = require("../lib/uploads.cjs");
const inviteDocumentService = require("../services/inviteDocumentService.cjs");
const { extractText } = require("../services/documentExtraction.cjs");
const { logAuditEvent } = require("../services/auditLog.cjs");
const { getSessionUsageReport } = require("../services/curatorLlmGuard.cjs");
const { listCuratorsForGroup } = require("../services/groupCuratorsService.cjs");
const chatPresetsStore = require("../db/repositories/curatorChatPresetsStore.cjs");
const { previewChatContext } = require("../services/curatorChatService.cjs");
const chatContext = require("../services/curatorChatContext.cjs");
const programExcelImporter = require("../services/programExcelImporter.cjs");

const router = Router();

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// GET /api/organizer/workspace
router.get(
  "/workspace",
  asyncHandler(async (req, res) => {
    const viewer = await getUser(getViewerId(req));

    if (
      !viewer ||
      (!isOrganizerViewer(viewer) && !isAdminViewer(viewer)) ||
      viewer.status === "disabled"
    ) {
      throw createHttpError(403, "Недостаточно прав для кабинета организатора");
    }

    const sessions = await listSessions(isAdminViewer(viewer) ? {} : { organizerId: viewer.id });
    res.json({
      title: "Рабочее пространство организатора",
      meta: {
        storageMode: "postgres",
        updatedAt: new Date().toISOString(),
      },
      sessions,
    });
  }),
);

// POST /api/organizer/sessions
router.post(
  "/sessions",
  validateBody(createSessionSchema),
  asyncHandler(async (req, res) => {
    const viewer = await getUser(getViewerId(req));

    if (
      !viewer ||
      (!isOrganizerViewer(viewer) && !isAdminViewer(viewer)) ||
      viewer.status === "disabled"
    ) {
      throw createHttpError(403, "Недостаточно прав для создания заезда");
    }

    const payload = isAdminViewer(viewer)
      ? req.body || {}
      : norm.pickOrganizerSessionPayload(req.body || {});
    const session = await createSession({
      actorId: viewer.id,
      payload,
      assignOrganizerId:
        isOrganizerViewer(viewer) && !isAdminViewer(viewer)
          ? viewer.id
          : req.body?.organizerId || null,
    });
    res.status(201).json(session);
  }),
);

// PATCH /api/organizer/sessions/:sessionId
router.patch(
  "/sessions/:sessionId",
  requireOrganizer,
  validateBody(updateSessionSchema),
  asyncHandler(async (req, res) => {
    const payload = isAdminViewer(req.viewer)
      ? req.body || {}
      : norm.pickOrganizerSessionPayload(req.body || {});
    res.json(
      await updateSession({
        actorId: req.viewer.id,
        sessionId: req.params.sessionId,
        payload,
        allowExtendedRegistrationFields: true,
      }),
    );
  }),
);

// PATCH /api/organizer/sessions/:sessionId/registration
router.patch(
  "/sessions/:sessionId/registration",
  requireOrganizer,
  validateBody(updateRegistrationSchema),
  asyncHandler(async (req, res) => {
    res.json(
      await updateRegistration({
        actorId: req.viewer.id,
        sessionId: req.params.sessionId,
        payload: req.body || {},
      }),
    );
  }),
);

// PATCH /api/organizer/sessions/:sessionId/settings
router.patch(
  "/sessions/:sessionId/settings",
  requireOrganizer,
  validateBody(updateSessionSettingsSchema),
  asyncHandler(async (req, res) => {
    const body = req.body || {};

    // llm-патч идёт в отдельную колонку sessions.llm_settings (минует workspace),
    // т.к. это админ-настройки, а workspace.settings — конфигурация UX участника.
    if (body.llm) {
      await applyLlmSettingsPatch(req.params.sessionId, body.llm);
    }

    const settingsPatch = norm.normalizeOrganizerSessionSettingsPatch(body);
    const workspaceResult = await updateWorkspace(req.params.sessionId, (draft) => {
      draft.sessionSettings = {
        ...(draft.sessionSettings || {}),
        ...settingsPatch,
      };
      return workspace.syncWorkspace(draft);
    });

    // Возвращаем актуальный llmSettings вместе с workspace чтобы UI обновился атомарно.
    const llmSettings = await getSessionLlmSettings(req.params.sessionId);
    res.json({ ...workspaceResult, llmSettings });
  }),
);

// GET /api/organizer/sessions/:sessionId/workspace
router.get(
  "/sessions/:sessionId/workspace",
  requireOrganizer,
  asyncHandler(async (req, res) => {
    const [draft, llmSettings] = await Promise.all([
      getWorkspace(req.params.sessionId),
      getSessionLlmSettings(req.params.sessionId),
    ]);
    res.json({ ...workspace.syncWorkspace(draft), llmSettings });
  }),
);

// GET /api/organizer/sessions/:sessionId/analytics
router.get(
  "/sessions/:sessionId/analytics",
  requireOrganizer,
  asyncHandler(async (req, res) => {
    const draft = workspace.syncWorkspace(await getWorkspace(req.params.sessionId));
    const analytics = await getOrganizerAnalyticsSnapshot(req.params.sessionId);
    res.json({
      sessionId: draft.sessionId,
      meta: {
        ...(draft.meta || {}),
        analyticsUpdatedAt: new Date().toISOString(),
      },
      summary: draft.summary || {},
      groupsSummary: draft.groupsSummary || { groups: [], alerts: [] },
      sessionSummary: draft.sessionSummary || {},
      speakerLectureSummary: draft.speakerLectureSummary || { speakers: [], lectures: [] },
      dataState: analytics.dataState,
      eventPulse: analytics.eventPulse,
      groupPulse: analytics.groupPulse,
      participantScatter: analytics.participantScatter,
      operationalBrief: analytics.operationalBrief,
      curatorCandidates: draft.curatorCandidates || [],
    });
  }),
);

// POST /api/organizer/sessions/:sessionId/groups
router.post(
  "/sessions/:sessionId/groups",
  requireOrganizer,
  validateBody(createGroupSchema),
  asyncHandler(async (req, res) => {
    const result = await createOrganizerGroup({
      actorId: req.viewer.id,
      sessionId: req.params.sessionId,
      payload: req.body || {},
    });
    res.status(201).json(workspace.syncWorkspace(result));
  }),
);

// PATCH /api/organizer/sessions/:sessionId/groups/:groupId
router.patch(
  "/sessions/:sessionId/groups/:groupId",
  requireOrganizer,
  validateBody(updateGroupSchema),
  asyncHandler(async (req, res) => {
    const result = await updateOrganizerGroup({
      actorId: req.viewer.id,
      sessionId: req.params.sessionId,
      groupId: req.params.groupId,
      payload: req.body || {},
    });
    res.json(workspace.syncWorkspace(result));
  }),
);

// DELETE /api/organizer/sessions/:sessionId/groups/:groupId
router.delete(
  "/sessions/:sessionId/groups/:groupId",
  requireOrganizer,
  asyncHandler(async (req, res) => {
    const result = await deleteOrganizerGroup({
      actorId: req.viewer.id,
      sessionId: req.params.sessionId,
      groupId: req.params.groupId,
    });
    res.json(workspace.syncWorkspace(result));
  }),
);

// PATCH /api/organizer/sessions/:sessionId/groups/:groupId/curator
router.patch(
  "/sessions/:sessionId/groups/:groupId/curator",
  requireOrganizer,
  validateBody(assignCuratorSchema),
  asyncHandler(async (req, res) => {
    const result = await assignOrganizerGroupCurator({
      actorId: req.viewer.id,
      sessionId: req.params.sessionId,
      groupId: req.params.groupId,
      curatorId: req.body?.curatorId || "",
    });
    res.json(workspace.syncWorkspace(result));
  }),
);

// POST /api/organizer/sessions/:sessionId/groups/:groupId/participants
router.post(
  "/sessions/:sessionId/groups/:groupId/participants",
  requireOrganizer,
  validateBody(assignParticipantsSchema),
  asyncHandler(async (req, res) => {
    const result = await assignParticipantsToOrganizerGroup({
      actorId: req.viewer.id,
      sessionId: req.params.sessionId,
      groupId: req.params.groupId,
      participantIds: req.body?.participantIds || [],
    });
    res.json(workspace.syncWorkspace(result));
  }),
);

// POST /api/organizer/sessions/:sessionId/programs
router.post(
  "/sessions/:sessionId/programs",
  requireOrganizer,
  validateBody(createProgramSchema),
  asyncHandler(async (req, res) => {
    const payload = norm.normalizeProgramPatch(req.body);

    const result = await updateWorkspace(req.params.sessionId, (draft) => {
      workspace.syncWorkspace(draft);
      if (draft.programWorkspace.programs.length) {
        return workspace.syncWorkspace(draft);
      }

      const nextProgramId = `program-${randomUUID().slice(0, 8)}`;
      draft.programWorkspace.programs.unshift({
        id: nextProgramId,
        title: payload.title,
        description: payload.description,
        status: payload.status,
        eventContext: {
          id: `event-context-${randomUUID().slice(0, 8)}`,
          ...payload.eventContext,
        },
        days: [
          {
            id: `day-${randomUUID().slice(0, 8)}`,
            label: "День 1",
            dateLabel: "Новая дата",
            flowOrder: ["A"],
            flowMeta: { A: { label: "A", track: "" } },
            flows: [{ id: "A", label: "A", track: "" }],
            events: [],
          },
        ],
      });
      draft.programWorkspace.currentProgramId = nextProgramId;
      draft.programWorkspace.activeEventId = null;
      return workspace.syncWorkspace(draft);
    });

    res.json(result);
  }),
);

// PATCH /api/organizer/sessions/:sessionId/programs/:programId
router.patch(
  "/sessions/:sessionId/programs/:programId",
  requireOrganizer,
  validateBody(updateProgramSchema),
  asyncHandler(async (req, res) => {
    const payload = norm.normalizeProgramPatch(req.body, { defaultStatus: undefined });

    const result = await updateWorkspace(req.params.sessionId, (draft) => {
      workspace.syncWorkspace(draft);
      const program = workspace.findProgram(draft, req.params.programId);
      program.title = payload.title;
      program.description = payload.description;
      if (payload.status !== undefined) {
        program.status = payload.status;
      }
      program.eventContext = {
        ...program.eventContext,
        ...payload.eventContext,
      };
      return workspace.syncWorkspace(draft);
    });

    res.json(result);
  }),
);

// POST /api/organizer/sessions/:sessionId/programs/:programId/publish
router.post(
  "/sessions/:sessionId/programs/:programId/publish",
  requireOrganizer,
  asyncHandler(async (req, res) => {
    const result = await updateWorkspace(req.params.sessionId, (draft) => {
      workspace.syncWorkspace(draft);
      const program = workspace.findProgram(draft, req.params.programId);
      const firstEvent = (program.days || []).flatMap((day) => day.events || [])[0] || null;

      program.status = "published";
      draft.programWorkspace.currentProgramId = program.id;
      draft.programWorkspace.activeEventId = firstEvent?.id || null;

      return workspace.syncWorkspace(draft);
    });

    res.json(result);
  }),
);

// POST /api/organizer/sessions/:sessionId/programs/:programId/draft
router.post(
  "/sessions/:sessionId/programs/:programId/draft",
  requireOrganizer,
  asyncHandler(async (req, res) => {
    const result = await updateWorkspace(req.params.sessionId, (draft) => {
      workspace.syncWorkspace(draft);
      const program = workspace.findProgram(draft, req.params.programId);
      const firstEvent = (program.days || []).flatMap((day) => day.events || [])[0] || null;

      program.status = "draft";
      draft.programWorkspace.currentProgramId = program.id;
      draft.programWorkspace.activeEventId = firstEvent?.id || null;

      return workspace.syncWorkspace(draft);
    });

    res.json(result);
  }),
);

// POST /api/organizer/sessions/:sessionId/programs/:programId/select
router.post(
  "/sessions/:sessionId/programs/:programId/select",
  requireOrganizer,
  asyncHandler(async (req, res) => {
    const result = await updateWorkspace(req.params.sessionId, (draft) => {
      workspace.findProgram(draft, req.params.programId);
      draft.programWorkspace.currentProgramId = req.params.programId;
      const currentProgram = workspace.findProgram(draft, req.params.programId);
      const candidateEvent =
        workspace
          .flattenEvents(draft)
          .find((event) => event.id === draft.programWorkspace.activeEventId) ||
        currentProgram.days[0]?.events[0];

      if (candidateEvent) {
        draft.programWorkspace.activeEventId = candidateEvent.id;
      }

      return workspace.syncWorkspace(draft);
    });

    res.json(result);
  }),
);

// POST /api/organizer/sessions/:sessionId/programs/:programId/days
router.post(
  "/sessions/:sessionId/programs/:programId/days",
  requireOrganizer,
  validateBody(programDaySchema),
  asyncHandler(async (req, res) => {
    const result = await updateWorkspace(req.params.sessionId, (draft) => {
      workspace.syncWorkspace(draft);
      const program = workspace.findProgram(draft, req.params.programId);
      const payload = norm.finalizeDayPatch(program, req.body);
      const nextDayId = `day-${randomUUID().slice(0, 8)}`;
      program.days.push({
        id: nextDayId,
        label: payload.label,
        dateLabel: payload.dateLabel,
        dateValue: payload.dateValue,
        flowOrder: ["A"],
        flowMeta: { A: { label: "A", track: "" } },
        flows: [{ id: "A", label: "A", track: "" }],
        reflectionQuestions: payload.reflectionQuestions,
        events: [],
      });
      return workspace.syncWorkspace(draft);
    });

    res.status(201).json(result);
  }),
);

// PATCH /api/organizer/sessions/:sessionId/programs/:programId/days/:dayId
router.patch(
  "/sessions/:sessionId/programs/:programId/days/:dayId",
  requireOrganizer,
  validateBody(programDaySchema),
  asyncHandler(async (req, res) => {
    const result = await updateWorkspace(req.params.sessionId, (draft) => {
      workspace.syncWorkspace(draft);
      const program = workspace.findProgram(draft, req.params.programId);
      const day = workspace.findDay(program, req.params.dayId);
      const payload = norm.finalizeDayPatch(program, req.body, day);
      day.label = payload.label;
      day.dateLabel = payload.dateLabel;
      day.dateValue = payload.dateValue;
      day.reflectionQuestions = payload.reflectionQuestions;
      return workspace.syncWorkspace(draft);
    });

    res.json(result);
  }),
);

// DELETE /api/organizer/sessions/:sessionId/programs/:programId/days/:dayId
router.delete(
  "/sessions/:sessionId/programs/:programId/days/:dayId",
  requireOrganizer,
  asyncHandler(async (req, res) => {
    const result = await updateWorkspace(req.params.sessionId, (draft) => {
      workspace.syncWorkspace(draft);
      const program = workspace.findProgram(draft, req.params.programId);
      const day = workspace.findDay(program, req.params.dayId);
      program.days = program.days.filter((item) => item.id !== day.id);

      if ((day.events || []).some((event) => event.id === draft.programWorkspace.activeEventId)) {
        draft.programWorkspace.activeEventId = workspace.flattenEvents(draft)[0]?.id || null;
      }

      return workspace.syncWorkspace(draft);
    });

    res.json(result);
  }),
);

// PATCH /api/organizer/sessions/:sessionId/programs/:programId/days/:dayId/flows
router.patch(
  "/sessions/:sessionId/programs/:programId/days/:dayId/flows",
  requireOrganizer,
  validateBody(updateDayFlowsSchema),
  asyncHandler(async (req, res) => {
    const rawFlows = Array.isArray(req.body?.flows) ? req.body.flows : [];

    const result = await updateWorkspace(req.params.sessionId, (draft) => {
      workspace.syncWorkspace(draft);
      const program = workspace.findProgram(draft, req.params.programId);
      const day = workspace.findDay(program, req.params.dayId);
      const existingFlows = flow.normalizeFlowDefinitions(day);
      const existingById = new Map(existingFlows.map((item) => [item.id, item]));
      const nextFlows = [];
      const seenIds = new Set();

      for (const [index, rawFlow] of rawFlows.entries()) {
        const id = flow.normalizeFlowId(
          typeof rawFlow === "string"
            ? rawFlow
            : rawFlow?.id || rawFlow?.value || rawFlow?.parallelGroup,
          `flow-${index + 1}`,
        );

        if (seenIds.has(id)) {
          continue;
        }
        seenIds.add(id);

        const existingFlow = existingById.get(id);
        const label =
          typeof rawFlow === "string"
            ? existingFlow?.label || rawFlow
            : rawFlow?.label || rawFlow?.title || existingFlow?.label || id;
        const track =
          typeof rawFlow === "string"
            ? existingFlow?.track || ""
            : rawFlow?.track || existingFlow?.track || "";

        nextFlows.push({
          id,
          label: String(label || id).trim() || id,
          track: String(track || "").trim(),
        });
      }

      for (const flowId of flow.getFlowEventIds(day)) {
        if (!seenIds.has(flowId)) {
          nextFlows.push(existingById.get(flowId) || { id: flowId, label: flowId, track: "" });
          seenIds.add(flowId);
        }
      }

      flow.validateFlowDefinitions(
        nextFlows.length ? nextFlows : [{ id: "A", label: "A", track: "" }],
      );
      flow.syncDayFlows(day, nextFlows.length ? nextFlows : [{ id: "A", label: "A", track: "" }]);
      return workspace.syncWorkspace(draft);
    });

    res.json(result);
  }),
);

// PATCH /api/organizer/sessions/:sessionId/programs/:programId/days/:dayId/flow-order
router.patch(
  "/sessions/:sessionId/programs/:programId/days/:dayId/flow-order",
  requireOrganizer,
  validateBody(updateFlowOrderSchema),
  asyncHandler(async (req, res) => {
    const flowOrder = flow.normalizeFlowOrder(
      req.body?.flowOrder || req.body?.order || req.body?.columns,
    );

    const result = await updateWorkspace(req.params.sessionId, (draft) => {
      workspace.syncWorkspace(draft);
      const program = workspace.findProgram(draft, req.params.programId);
      const day = workspace.findDay(program, req.params.dayId);
      const flowMap = new Map(flow.normalizeFlowDefinitions(day).map((item) => [item.id, item]));
      const nextOrder = flow.mergeDayFlowOrder(day, flowOrder);
      flow.syncDayFlows(
        day,
        nextOrder.map((flowId) => flowMap.get(flowId) || { id: flowId, label: flowId, track: "" }),
      );
      return workspace.syncWorkspace(draft);
    });

    res.json(result);
  }),
);

// PATCH /api/organizer/sessions/:sessionId/programs/:programId/days/:dayId/events/:eventId
router.patch(
  "/sessions/:sessionId/programs/:programId/days/:dayId/events/:eventId",
  requireOrganizer,
  validateBody(programEventSchema),
  asyncHandler(async (req, res) => {
    const patch = req.body || {};

    const result = await updateWorkspace(req.params.sessionId, (draft) => {
      workspace.syncWorkspace(draft);
      const program = workspace.findProgram(draft, req.params.programId);
      const day = workspace.findDay(program, req.params.dayId);
      const event = workspace.findEvent(day, req.params.eventId);
      const normalizedPatch = norm.normalizeEventPatch({ ...event, ...patch });
      const speaker = patch.speakerId
        ? workspace.getSpeakerCatalogItem(draft, patch.speakerId)
        : null;
      const candidate = {
        ...event,
        ...normalizedPatch,
        speakerName: speaker?.name || normalizedPatch.speakerName || event.speakerName,
        reflectionQuestions: normalizedPatch.reflectionQuestions,
      };

      flow.validateEventSchedule(day, candidate, event.id);
      flow.ensureFlowInDay(day, candidate.parallelGroup, { track: candidate.track });
      Object.assign(event, candidate);
      day.events = workspace.sortEvents(day.events);
      return workspace.syncWorkspace(draft);
    });

    res.json(result);
  }),
);

// POST /api/organizer/sessions/:sessionId/programs/:programId/days/:dayId/events/parallel
router.post(
  "/sessions/:sessionId/programs/:programId/days/:dayId/events/parallel",
  requireOrganizer,
  validateBody(programEventSchema),
  asyncHandler(async (req, res) => {
    const payload = norm.normalizeEventPatch(req.body);

    const result = await updateWorkspace(req.params.sessionId, (draft) => {
      workspace.syncWorkspace(draft);
      const program = workspace.findProgram(draft, req.params.programId);
      const day = workspace.findDay(program, req.params.dayId);
      const speaker = payload.speakerId
        ? workspace.getSpeakerCatalogItem(draft, payload.speakerId)
        : null;
      const nextEvent = {
        id: `event-${randomUUID().slice(0, 8)}`,
        ...payload,
        speakerName: speaker?.name || payload.speakerName || "",
      };

      flow.validateEventSchedule(day, nextEvent);
      flow.ensureFlowInDay(day, nextEvent.parallelGroup, { track: nextEvent.track });
      day.events.push(nextEvent);
      day.events = workspace.sortEvents(day.events);
      return workspace.syncWorkspace(draft);
    });

    res.json(result);
  }),
);

// DELETE /api/organizer/sessions/:sessionId/programs/:programId/days/:dayId/events/:eventId
router.delete(
  "/sessions/:sessionId/programs/:programId/days/:dayId/events/:eventId",
  requireOrganizer,
  asyncHandler(async (req, res) => {
    const result = await updateWorkspace(req.params.sessionId, (draft) => {
      workspace.syncWorkspace(draft);
      const program = workspace.findProgram(draft, req.params.programId);
      const day = workspace.findDay(program, req.params.dayId);
      workspace.findEvent(day, req.params.eventId);

      day.events = day.events.filter((event) => event.id !== req.params.eventId);
      flow.compactDayFlowOrder(day);

      if (draft.programWorkspace.activeEventId === req.params.eventId) {
        draft.programWorkspace.activeEventId =
          day.events[0]?.id || workspace.flattenEvents(draft)[0]?.id || null;
      }

      return workspace.syncWorkspace(draft);
    });

    res.json(result);
  }),
);

// POST /api/organizer/sessions/:sessionId/programs/:programId/days/:dayId/events/:eventId/activate
router.post(
  "/sessions/:sessionId/programs/:programId/days/:dayId/events/:eventId/activate",
  requireOrganizer,
  asyncHandler(async (req, res) => {
    const result = await updateWorkspace(req.params.sessionId, (draft) => {
      const targetProgram = workspace.findProgram(draft, req.params.programId);
      const targetDay = workspace.findDay(targetProgram, req.params.dayId);
      workspace.findEvent(targetDay, req.params.eventId);

      draft.programWorkspace.currentProgramId = req.params.programId;
      draft.programWorkspace.activeEventId = req.params.eventId;

      for (const program of draft.programWorkspace.programs) {
        for (const day of program.days) {
          for (const event of day.events) {
            if (event.id === req.params.eventId) {
              event.status = "active";
            } else if (event.status === "active") {
              event.status = "planned";
            }
          }
        }
      }

      return workspace.syncWorkspace(draft);
    });

    res.json(result);
  }),
);

// POST /api/organizer/sessions/:sessionId/surveys
router.post(
  "/sessions/:sessionId/surveys",
  requireOrganizer,
  validateBody(createSurveySchema),
  asyncHandler(async (req, res) => {
    const payload = req.body || {};

    const result = await updateWorkspace(req.params.sessionId, (draft) => {
      const questions = Array.isArray(payload.questions)
        ? payload.questions.map((question) => ({
            id: question.id || `question-${randomUUID().slice(0, 8)}`,
            type: question.type || "scale",
            title: question.title || "Новый вопрос",
            options: norm.normalizeList(question.options),
          }))
        : [];

      draft.surveyWorkspace.surveys.unshift({
        id: `survey-${randomUUID().slice(0, 8)}`,
        title: payload.title || "Новый опрос",
        category: payload.category || "Конструктор",
        cadence: payload.cadence || "по решению организатора",
        source: payload.source || "Черновик организатора",
        description: payload.description || "Новый черновик опросника.",
        status: "draft",
        questions,
      });

      return workspace.syncWorkspace(draft);
    });

    res.json(result);
  }),
);

// PATCH /api/organizer/sessions/:sessionId/surveys/:surveyId
router.patch(
  "/sessions/:sessionId/surveys/:surveyId",
  requireOrganizer,
  validateBody(updateSurveySchema),
  asyncHandler(async (req, res) => {
    const payload = req.body || {};

    const result = await updateWorkspace(req.params.sessionId, (draft) => {
      const survey = workspace.findSurvey(draft, req.params.surveyId);
      survey.title = payload.title ?? survey.title;
      survey.category = payload.category ?? survey.category;
      survey.cadence = payload.cadence ?? survey.cadence;
      survey.source = payload.source ?? survey.source;
      survey.description = payload.description ?? survey.description;
      survey.status = payload.status ?? survey.status;
      return workspace.syncWorkspace(draft);
    });

    res.json(result);
  }),
);

// POST /api/organizer/sessions/:sessionId/surveys/:surveyId/questions
router.post(
  "/sessions/:sessionId/surveys/:surveyId/questions",
  requireOrganizer,
  validateBody(surveyQuestionBodySchema),
  asyncHandler(async (req, res) => {
    const payload = req.body || {};

    const result = await updateWorkspace(req.params.sessionId, (draft) => {
      const survey = workspace.findSurvey(draft, req.params.surveyId);
      survey.questions.push({
        id: `question-${randomUUID().slice(0, 8)}`,
        type: payload.type || "scale",
        title: payload.title || "Новый вопрос",
        options: norm.normalizeList(payload.options),
      });

      return workspace.syncWorkspace(draft);
    });

    res.json(result);
  }),
);

// PATCH /api/organizer/sessions/:sessionId/surveys/:surveyId/questions/:questionId
router.patch(
  "/sessions/:sessionId/surveys/:surveyId/questions/:questionId",
  requireOrganizer,
  validateBody(surveyQuestionBodySchema),
  asyncHandler(async (req, res) => {
    const payload = req.body || {};

    const result = await updateWorkspace(req.params.sessionId, (draft) => {
      const survey = workspace.findSurvey(draft, req.params.surveyId);
      const question = survey.questions.find((item) => item.id === req.params.questionId);

      if (!question) {
        throw createHttpError(404, "Вопрос не найден");
      }

      question.type = payload.type ?? question.type;
      question.title = payload.title ?? question.title;
      question.options =
        payload.options !== undefined ? norm.normalizeList(payload.options) : question.options;
      return workspace.syncWorkspace(draft);
    });

    res.json(result);
  }),
);

// POST /api/organizer/sessions/:sessionId/surveys/:surveyId/publish
router.post(
  "/sessions/:sessionId/surveys/:surveyId/publish",
  requireOrganizer,
  validateBody(publishSurveySchema),
  asyncHandler(async (req, res) => {
    const filters = audience.normalizeSurveyFilters(req.body);

    const result = await updateWorkspace(req.params.sessionId, (draft) => {
      const survey = workspace.findSurvey(draft, req.params.surveyId);
      const recipients = draft.audiencePool.filter((participant) =>
        audience.matchAudience(participant, filters),
      );

      survey.status = "published";
      draft.surveyWorkspace.publications.unshift({
        id: `publication-${randomUUID().slice(0, 8)}`,
        surveyId: survey.id,
        status: "active",
        publishedAt: new Date().toISOString(),
        audienceSummary: audience.buildAudienceSummary(draft, filters, recipients.length),
        recipientsCount: recipients.length,
        filters,
      });

      return workspace.syncWorkspace(draft);
    });

    res.json(result);
  }),
);

// GET /api/organizer/sessions/:sessionId/usage
// Агрегат расхода LLM-токенов по всем кураторам сессии за сегодня.
router.get(
  "/sessions/:sessionId/usage",
  requireOrganizer,
  asyncHandler(async (req, res) => {
    res.json(await getSessionUsageReport({ sessionId: req.params.sessionId }));
  }),
);

// ---------------------------------------------------------------------------
// Event concepts (PDF/DOCX/TXT/MD) — Curator AI v2 Phase 4
// ---------------------------------------------------------------------------

// POST /api/organizer/sessions/:sessionId/events/:eventId/concepts
// multipart/form-data, поле "file". Сохраняет файл на диск, извлекает
// текстовый слой и пишет в program_event_concepts.
router.post(
  "/sessions/:sessionId/events/:eventId/concepts",
  requireOrganizer,
  documentUploader,
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw createHttpError(400, "Файл не получен");
    }

    const settings = await getSessionLlmSettings(req.params.sessionId);
    const persisted = persistUpload({ kind: "document", file: req.file });
    const { text, truncated, originalChars } = await extractText(
      req.file.buffer,
      req.file.mimetype,
      { limitChars: settings.conceptExtractionLimit },
    );

    const concept = await eventConceptsStore.insertConcept({
      sessionId: req.params.sessionId,
      eventId: req.params.eventId,
      sourceFilename: req.file.originalname || persisted.filename,
      storageFilename: persisted.filename,
      mime: persisted.mime,
      sizeBytes: persisted.sizeBytes,
      extractedText: text,
      extractedChars: originalChars,
      uploadedBy: req.viewer.id,
    });

    logAuditEvent({
      actorId: req.viewer.id,
      sessionId: req.params.sessionId,
      action: "program_event.concept.upload",
      entityType: "program_event",
      entityId: req.params.eventId,
      payload: {
        conceptId: concept.id,
        filename: concept.sourceFilename,
        mime: concept.mime,
        sizeBytes: concept.sizeBytes,
        extractedChars: concept.extractedChars,
        truncated,
      },
    });

    res.status(201).json({
      ...concept,
      downloadUrl: persisted.url,
      truncated,
    });
  }),
);

// GET /api/organizer/sessions/:sessionId/events/:eventId/concepts
router.get(
  "/sessions/:sessionId/events/:eventId/concepts",
  requireOrganizer,
  asyncHandler(async (req, res) => {
    const concepts = await eventConceptsStore.listByEvent(req.params.eventId);
    res.json(
      concepts.map((concept) => ({
        ...concept,
        downloadUrl: `/uploads/documents/${concept.storageFilename}`,
      })),
    );
  }),
);

// DELETE /api/organizer/sessions/:sessionId/events/:eventId/concepts/:conceptId
router.delete(
  "/sessions/:sessionId/events/:eventId/concepts/:conceptId",
  requireOrganizer,
  asyncHandler(async (req, res) => {
    const concept = await eventConceptsStore.getById(req.params.conceptId);
    if (!concept || concept.eventId !== req.params.eventId) {
      throw createHttpError(404, "Концепция не найдена");
    }
    await eventConceptsStore.deleteById(req.params.conceptId);
    logAuditEvent({
      actorId: req.viewer.id,
      sessionId: req.params.sessionId,
      action: "program_event.concept.delete",
      entityType: "program_event",
      entityId: req.params.eventId,
      payload: {
        conceptId: req.params.conceptId,
        filename: concept.sourceFilename,
      },
    });
    res.status(204).send();
  }),
);

// ---------------------------------------------------------------------------
// Curator chat presets — конструктор контекста (Curator AI v2.1)
//
// Organizer-side зеркало для /api/curator/.../chat/presets и /preview.
// Позволяет организатору посмотреть как собран контекст для каждого куратора
// группы, создать/изменить preset'ы, назначить дефолт «за» куратора.
// ---------------------------------------------------------------------------

// GET /api/organizer/sessions/:sessionId/groups/:groupId/curators
router.get(
  "/sessions/:sessionId/groups/:groupId/curators",
  requireOrganizer,
  asyncHandler(async (req, res) => {
    res.json(
      await listCuratorsForGroup({
        sessionId: req.params.sessionId,
        groupId: req.params.groupId,
      }),
    );
  }),
);

// GET .../groups/:groupId/curators/:curatorId/chat/presets
router.get(
  "/sessions/:sessionId/groups/:groupId/curators/:curatorId/chat/presets",
  requireOrganizer,
  asyncHandler(async (req, res) => {
    res.json(
      await chatPresetsStore.listByCuratorGroup({
        sessionId: req.params.sessionId,
        groupId: req.params.groupId,
        curatorId: req.params.curatorId,
      }),
    );
  }),
);

// POST .../groups/:groupId/curators/:curatorId/chat/presets
router.post(
  "/sessions/:sessionId/groups/:groupId/curators/:curatorId/chat/presets",
  requireOrganizer,
  asyncHandler(async (req, res) => {
    const label = String(req.body?.label || "").trim();
    if (!label) throw createHttpError(400, "Название preset'а обязательно");
    const created = await chatPresetsStore.createPreset({
      sessionId: req.params.sessionId,
      groupId: req.params.groupId,
      curatorId: req.params.curatorId,
      label: label.slice(0, 120),
      filter: req.body?.filter,
      isDefault: Boolean(req.body?.isDefault),
      createdBy: req.viewer.id,
    });
    logAuditEvent({
      actorId: req.viewer.id,
      sessionId: req.params.sessionId,
      action: "curator_ai.preset.create",
      entityType: "curator_chat_preset",
      entityId: created.id,
      payload: {
        curatorId: req.params.curatorId,
        label: created.label,
        isDefault: created.isDefault,
      },
    });
    res.status(201).json(created);
  }),
);

// PATCH .../curators/:curatorId/chat/presets/:presetId
router.patch(
  "/sessions/:sessionId/groups/:groupId/curators/:curatorId/chat/presets/:presetId",
  requireOrganizer,
  asyncHandler(async (req, res) => {
    const existing = await chatPresetsStore.getById(req.params.presetId);
    if (
      !existing ||
      existing.curatorId !== req.params.curatorId ||
      existing.sessionId !== req.params.sessionId ||
      existing.groupId !== req.params.groupId
    ) {
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
    const updated = await chatPresetsStore.updatePreset(req.params.presetId, patch);
    logAuditEvent({
      actorId: req.viewer.id,
      sessionId: req.params.sessionId,
      action:
        patch.isDefault === true ? "curator_ai.preset.set_default" : "curator_ai.preset.update",
      entityType: "curator_chat_preset",
      entityId: updated.id,
      payload: { curatorId: req.params.curatorId, patch },
    });
    res.json(updated);
  }),
);

// DELETE .../curators/:curatorId/chat/presets/:presetId
router.delete(
  "/sessions/:sessionId/groups/:groupId/curators/:curatorId/chat/presets/:presetId",
  requireOrganizer,
  asyncHandler(async (req, res) => {
    const existing = await chatPresetsStore.getById(req.params.presetId);
    if (
      !existing ||
      existing.curatorId !== req.params.curatorId ||
      existing.sessionId !== req.params.sessionId ||
      existing.groupId !== req.params.groupId
    ) {
      throw createHttpError(404, "Preset не найден");
    }
    await chatPresetsStore.deletePreset(req.params.presetId);
    logAuditEvent({
      actorId: req.viewer.id,
      sessionId: req.params.sessionId,
      action: "curator_ai.preset.delete",
      entityType: "curator_chat_preset",
      entityId: req.params.presetId,
      payload: { curatorId: req.params.curatorId, label: existing.label },
    });
    res.status(204).send();
  }),
);

// POST .../curators/:curatorId/chat/preview
// body: { filter? }  → preview как увидит ИИ куратор
router.post(
  "/sessions/:sessionId/groups/:groupId/curators/:curatorId/chat/preview",
  requireOrganizer,
  asyncHandler(async (req, res) => {
    const result = await previewChatContext({
      viewerId: req.params.curatorId,
      sessionId: req.params.sessionId,
      groupId: req.params.groupId,
      filter: req.body?.filter,
      // organizer уже прошёл requireOrganizer — пропускаем ensureCuratorAccess
      // чтобы не падать на отсутствии у организатора curator-роли в группе.
      skipAccess: true,
    });
    res.json(result);
  }),
);

// GET .../groups/:groupId/chat/context-options
// Чек-листы для picker'а в кабинете организатора.
router.get(
  "/sessions/:sessionId/groups/:groupId/chat/context-options",
  requireOrganizer,
  asyncHandler(async (req, res) => {
    res.json(
      await chatContext.listContextOptions({
        sessionId: req.params.sessionId,
        groupId: req.params.groupId,
      }),
    );
  }),
);

// ---------------------------------------------------------------------------
// Импорт программы из Excel
// ---------------------------------------------------------------------------

/**
 * Парсит `value` как JSON. Возвращает null если не строка / невалидный JSON.
 */
function safeParseJson(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
}

/**
 * multer 2.x декодирует `file.originalname` из latin1, поэтому русские имена
 * файлов (вроде «№1. Драфт_Наследники Победы.xlsx») приходят как мусор.
 * Принудительно декодируем через UTF-8.
 */
function decodeOriginalName(name) {
  if (!name) return name;
  try {
    return Buffer.from(name, "latin1").toString("utf8");
  } catch {
    return name;
  }
}

// POST /api/organizer/sessions/:sessionId/programs/import-preview
// multipart: file (.xlsx) + form fields: mode, model?, stopWords? (JSON array)
// Возвращает DraftProgram (НЕ пишет в БД).
router.post(
  "/sessions/:sessionId/programs/import-preview",
  requireOrganizer,
  documentUploader,
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw createHttpError(400, "Файл не получен");
    }
    const mode = req.body?.mode === "llm" ? "llm" : "heuristic";
    const stopWords = safeParseJson(req.body?.stopWords);
    const sheetName = req.body?.sheetName ? String(req.body.sheetName) : null;
    const llmConfig =
      mode === "llm"
        ? {
            model: String(req.body?.model || "").trim(),
            sessionId: req.params.sessionId,
            maxTokens: undefined,
          }
        : null;

    const draft = await programExcelImporter.parseProgram({
      buffer: req.file.buffer,
      mode,
      stopWords: Array.isArray(stopWords) ? stopWords : undefined,
      llmConfig,
      sheetName,
    });

    // Audit только для платного LLM-режима, чтобы не засорять log на
    // каждый просмотр.
    if (mode === "llm" && draft.usage) {
      logAuditEvent({
        actorId: req.viewer.id,
        sessionId: req.params.sessionId,
        action: "organizer.program.imported.preview.llm",
        entityType: "session",
        entityId: req.params.sessionId,
        payload: {
          fileName: decodeOriginalName(req.file.originalname) || null,
          sizeBytes: req.file.size,
          model: llmConfig.model,
          usage: draft.usage,
        },
      });
    }

    res.json({ draft, fileName: decodeOriginalName(req.file.originalname) || null });
  }),
);

// POST /api/organizer/sessions/:sessionId/programs/import-commit
// body: { draft: DraftProgram, fileName?, mode?, model?, conflictResolution }
// Сохраняет draft как программу в workspace (status='draft').
router.post(
  "/sessions/:sessionId/programs/import-commit",
  requireOrganizer,
  asyncHandler(async (req, res) => {
    const draft = req.body?.draft;
    if (!draft || !Array.isArray(draft.days)) {
      throw createHttpError(400, "В payload отсутствует draft.days[]");
    }
    const conflictResolution =
      req.body?.conflictResolution === "create_new" ? "create_new" : "replace_draft";

    const result = await updateWorkspace(req.params.sessionId, (workspaceDraft) => {
      workspace.syncWorkspace(workspaceDraft);
      const existingProgram = workspaceDraft.programWorkspace.programs[0] || null;
      if (
        existingProgram &&
        existingProgram.status === "published" &&
        conflictResolution === "replace_draft"
      ) {
        const err = new Error(
          "Текущая программа опубликована — нельзя автоматически заменить. Сначала переведите её в draft.",
        );
        err.status = 409;
        throw err;
      }

      const programId = `program-${randomUUID().slice(0, 8)}`;
      const days = (draft.days || []).map((day, dayIndex) => {
        const dayId = `day-${randomUUID().slice(0, 8)}`;
        // Только не отфильтрованные события идут в БД.
        const events = (day.events || [])
          .filter((evt) => !evt.droppedByStopWord)
          .map((evt) => ({
            id: `event-${randomUUID().slice(0, 8)}`,
            title: String(evt.title || "").trim() || "Событие без названия",
            start: String(evt.start || ""),
            end: String(evt.end || ""),
            type: String(evt.type || "Лекция"),
            speakerId: "",
            speakerName: String(evt.speakerName || ""),
            location: String(evt.location || ""),
            track: String(evt.track || ""),
            parallelGroup: String(evt.parallelGroup || "A"),
            status: "planned",
            tags: Array.isArray(evt.tags) ? evt.tags : [],
            description: String(evt.description || ""),
            reflectionQuestions: [],
          }));
        return {
          id: dayId,
          label: String(day.label || `День ${dayIndex + 1}`),
          dateLabel: String(day.dateLabel || ""),
          dateValue: String(day.dateValue || ""),
          flowOrder: ["A"],
          flowMeta: { A: { label: "A", track: "" } },
          flows: [{ id: "A", label: "A", track: "" }],
          events,
        };
      });

      const newProgram = {
        id: programId,
        title: String(draft.title || "").trim() || "Программа (импорт из Excel)",
        description: String(draft.description || ""),
        status: "draft",
        eventContext: {
          id: `event-context-${randomUUID().slice(0, 8)}`,
          title: draft.eventContext?.title || "",
          eventType: draft.eventContext?.eventType || "Форумное событие",
          venue: draft.eventContext?.venue || "",
          startDate: draft.eventContext?.startDate || "",
          endDate: draft.eventContext?.endDate || "",
          participantCount: Number(draft.eventContext?.participantCount || 0),
          description: draft.eventContext?.description || "",
        },
        days,
      };

      workspaceDraft.programWorkspace.programs = [newProgram];
      workspaceDraft.programWorkspace.currentProgramId = programId;
      workspaceDraft.programWorkspace.activeEventId = null;
      return workspace.syncWorkspace(workspaceDraft);
    });

    const eventsCount = (draft.days || []).reduce(
      (sum, day) => sum + (day.events || []).filter((evt) => !evt.droppedByStopWord).length,
      0,
    );
    const filteredCount = (draft.days || []).reduce(
      (sum, day) => sum + (day.events || []).filter((evt) => evt.droppedByStopWord).length,
      0,
    );

    logAuditEvent({
      actorId: req.viewer.id,
      sessionId: req.params.sessionId,
      action: "organizer.program.imported.commit",
      entityType: "program",
      entityId: result.programWorkspace?.currentProgramId || null,
      payload: {
        fileName: req.body?.fileName || null,
        mode: req.body?.mode || null,
        model: req.body?.model || null,
        daysCount: draft.days.length,
        eventsCount,
        filteredCount,
        conflictResolution,
      },
    });

    res.status(201).json(result);
  }),
);

// ---------------------------------------------------------------------------
// Пакетные приглашения участников через xlsx → PDF с QR
// ---------------------------------------------------------------------------

// GET /api/organizer/sessions/:sessionId/invites/template.xlsx
// Скачать пустой шаблон с 3 колонками (Группа / Куратор / Участник)
router.get(
  "/sessions/:sessionId/invites/template.xlsx",
  requireOrganizer,
  asyncHandler(async (_req, res) => {
    const buffer = inviteDocumentService.buildTemplateXlsx();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", 'attachment; filename="invites-template.xlsx"');
    res.send(buffer);
  }),
);

// POST /api/organizer/sessions/:sessionId/invites/preview
// multipart: file (xlsx) — НЕ создаёт magic-link, только парсит.
router.post(
  "/sessions/:sessionId/invites/preview",
  requireOrganizer,
  inviteBulkUploader,
  asyncHandler(async (req, res) => {
    const file = req.files?.file?.[0];
    if (!file) throw createHttpError(400, "Не получен xlsx-шаблон");
    const result = inviteDocumentService.parseTemplateXlsx(file.buffer);
    res.json({
      ...result,
      fileName: decodeOriginalName(file.originalname) || null,
    });
  }),
);

// POST /api/organizer/sessions/:sessionId/invites/generate
// multipart: file (xlsx) + letterhead (PDF/PNG/JPEG, опц.)
// body fields: layout, title?, footer?, ttlMinutes?
// Создаёт magic-link'и для всех + рендерит PDF.
router.post(
  "/sessions/:sessionId/invites/generate",
  requireOrganizer,
  inviteBulkUploader,
  asyncHandler(async (req, res) => {
    const xlsxFile = req.files?.file?.[0];
    if (!xlsxFile) throw createHttpError(400, "Не получен xlsx-шаблон");
    const letterhead = req.files?.letterhead?.[0] || null;

    const layout = ["card", "table"].includes(req.body?.layout) ? req.body.layout : "card";
    const title = String(req.body?.title || "").trim() || "Приглашения участников";
    const footer = String(req.body?.footer || "").trim() || "";
    const ttlMinutes = Math.max(
      15,
      Math.min(60 * 24 * 30, Number(req.body?.ttlMinutes) || 60 * 24),
    );

    const parsed = inviteDocumentService.parseTemplateXlsx(xlsxFile.buffer);

    const invites = await inviteDocumentService.createBulkInvites({
      sessionId: req.params.sessionId,
      actorId: req.viewer.id,
      groups: parsed.groups,
      ttlMinutes,
    });

    let pdfBuffer;
    try {
      pdfBuffer = await inviteDocumentService.renderInvitesPdf({
        invites,
        layout,
        letterhead,
        title,
        footer,
      });
    } catch (error) {
      throw createHttpError(500, `Ошибка рендера PDF: ${error.message}`);
    }

    const curatorCount = invites.filter((i) => i.role === "curator").length;
    const participantsCount = invites.filter((i) => i.role === "participant").length;

    logAuditEvent({
      actorId: req.viewer.id,
      sessionId: req.params.sessionId,
      action: "organizer.invite.batch.generated",
      entityType: "session",
      entityId: req.params.sessionId,
      payload: {
        fileName: decodeOriginalName(xlsxFile.originalname) || null,
        groupsCount: parsed.groups.length,
        curatorCount,
        participantsCount,
        ttlMinutes,
        layout,
        hasLetterhead: Boolean(letterhead),
        letterheadMime: letterhead?.mimetype || null,
      },
    });

    const filename = `invites-${req.params.sessionId}-${Date.now()}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("X-Invites-Created", String(invites.length));
    res.setHeader("X-Invites-Groups", String(parsed.groups.length));
    res.status(201).send(pdfBuffer);
  }),
);

module.exports = router;
