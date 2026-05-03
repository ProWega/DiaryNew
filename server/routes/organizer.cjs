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
  createSession,
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
    const settingsPatch = norm.normalizeOrganizerSessionSettingsPatch(req.body || {});
    const result = await updateWorkspace(req.params.sessionId, (draft) => {
      draft.sessionSettings = {
        ...(draft.sessionSettings || {}),
        ...settingsPatch,
      };
      return workspace.syncWorkspace(draft);
    });
    res.json(result);
  }),
);

// GET /api/organizer/sessions/:sessionId/workspace
router.get(
  "/sessions/:sessionId/workspace",
  requireOrganizer,
  asyncHandler(async (req, res) => {
    const draft = await getWorkspace(req.params.sessionId);
    res.json(workspace.syncWorkspace(draft));
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

module.exports = router;
