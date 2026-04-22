const cors = require("cors");
const express = require("express");
const { randomUUID } = require("node:crypto");
const { getWorkspace, updateWorkspace } = require("./db/organizerWorkspaceStore.cjs");
const { hasPostgresConfig } = require("./db/postgres.cjs");
const { getAdminWorkspace } = require("./db/repositories/adminStore.cjs");
const { getAdminDashboard, getCuratorDashboard } = require("./db/repositories/analyticsStore.cjs");
const {
  getParticipantDiary,
  updateParticipantEntry,
  updateParticipantReflection,
} = require("./db/repositories/diaryStore.cjs");
const {
  createSession,
  listPublicEvents,
  listSessions,
  updateRegistration,
  updateSession,
} = require("./db/repositories/sessionStore.cjs");
const {
  canAccessOrganizerSession,
  createUser,
  getBootstrap,
  getUser,
  listUsers,
  registerParticipant,
  updateUser,
  updateUserStatus,
  upsertUserAssignment,
} = require("./db/repositories/userStore.cjs");

const PORT = Number(process.env.PORT || 4000);
const HOST = process.env.HOST || "0.0.0.0";

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function getViewerId(req) {
  return req.header("x-viewer-id") || req.query.viewerId;
}

function hasActiveAssignmentRole(viewer, role) {
  return Array.isArray(viewer?.assignments)
    ? viewer.assignments.some((assignment) => assignment.role === role && assignment.status !== "disabled")
    : false;
}

function isAdminViewer(viewer) {
  return viewer?.role === "admin" || viewer?.baseRole === "admin";
}

function isOrganizerViewer(viewer) {
  return (
    viewer?.role === "organizer" ||
    viewer?.baseRole === "organizer" ||
    hasActiveAssignmentRole(viewer, "organizer")
  );
}

function pickOrganizerSessionPayload(body = {}) {
  const allowedKeys = [
    "name",
    "description",
    "startDate",
    "endDate",
    "registrationStartsAt",
    "registrationEndsAt",
    "registrationStatus",
  ];
  return Object.fromEntries(
    allowedKeys
      .filter((key) => Object.prototype.hasOwnProperty.call(body, key))
      .map((key) => [key, body[key]]),
  );
}

function requireOrganizer(req, _res, next) {
  const viewerId = req.header("x-viewer-id") || req.query.viewerId;
  Promise.resolve()
    .then(async () => {
      const viewer = await canAccessOrganizerSession(viewerId, req.params.sessionId);

      if (!viewer) {
        throw createHttpError(403, "Недостаточно прав для управления этим заездом");
      }

      req.viewer = viewer;
      next();
    })
    .catch(next);
}

function requireAdmin(req, _res, next) {
  Promise.resolve()
    .then(async () => {
      const viewer = await getUser(getViewerId(req));

      if (!viewer || !isAdminViewer(viewer) || viewer.status === "disabled") {
        throw createHttpError(403, "Недостаточно прав для панели администратора");
      }

      req.viewer = viewer;
      next();
    })
    .catch(next);
}

function normalizeList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function normalizeFlowOrder(value) {
  const source = Array.isArray(value) ? value : [];
  return Array.from(
    new Set(
      source
        .map((item) => (typeof item === "string" ? item : item?.id || item?.value || item?.parallelGroup || ""))
        .map((item) => String(item).trim())
        .filter(Boolean),
    ),
  );
}

function normalizeFlowId(value, fallback = "A") {
  const id = String(value || "").trim();
  return id || fallback;
}

function normalizeFlowMeta(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([rawId, rawMeta]) => {
        const id = normalizeFlowId(rawId, "");
        if (!id) {
          return null;
        }

        const meta = rawMeta && typeof rawMeta === "object" && !Array.isArray(rawMeta) ? rawMeta : { label: rawMeta };
        return [
          id,
          {
            label: String(meta.label || meta.title || id).trim() || id,
            track: String(meta.track || "").trim(),
          },
        ];
      })
      .filter(Boolean),
  );
}

function getFlowEventIds(day) {
  return normalizeFlowOrder((day?.events || []).map((event) => event?.parallelGroup || "A"));
}

function normalizeFlowDefinitions(day, nextFlows = null) {
  const flowMeta = normalizeFlowMeta(day?.flowMeta || day?.flow_meta);
  const flowMap = new Map();
  const pushFlow = (rawFlow, fallbackIndex = 0) => {
    const id = normalizeFlowId(
      typeof rawFlow === "string" ? rawFlow : rawFlow?.id || rawFlow?.value || rawFlow?.parallelGroup,
      "",
    );

    if (!id || flowMap.has(id)) {
      return;
    }

    const firstEvent = (day?.events || []).find((event) => normalizeFlowId(event?.parallelGroup) === id);
    const meta = flowMeta[id] || {};
    const label =
      typeof rawFlow === "string"
        ? meta.label || rawFlow
        : rawFlow?.label || rawFlow?.title || meta.label || id;
    const track =
      typeof rawFlow === "string"
        ? meta.track || firstEvent?.track || ""
        : rawFlow?.track || meta.track || firstEvent?.track || "";

    flowMap.set(id, {
      id,
      label: String(label || id).trim() || id,
      track: String(track || "").trim(),
      _index: fallbackIndex,
    });
  };

  if (Array.isArray(nextFlows)) {
    nextFlows.forEach(pushFlow);
  } else {
    (day?.flows || []).forEach(pushFlow);
    normalizeFlowOrder(day?.flowOrder).forEach(pushFlow);
  }

  getFlowEventIds(day).forEach(pushFlow);

  if (!flowMap.size) {
    pushFlow("A");
  }

  return Array.from(flowMap.values()).map(({ _index, ...flow }) => flow);
}

function validateFlowDefinitions(flows) {
  const seenLabels = new Set();
  for (const flow of flows) {
    const label = String(flow?.label || "").trim();
    if (!flow?.id || !label) {
      throw createHttpError(400, "Flow name is required.");
    }

    const labelKey = label.toLowerCase();
    if (seenLabels.has(labelKey)) {
      throw createHttpError(400, "Flow names must be unique within the day.");
    }
    seenLabels.add(labelKey);
  }
}

function syncDayFlows(day, nextFlows = null) {
  const flows = normalizeFlowDefinitions(day, nextFlows);
  const flowMeta = normalizeFlowMeta(day?.flowMeta || day?.flow_meta);
  const nextMeta = {};

  for (const flow of flows) {
    nextMeta[flow.id] = {
      label: flow.label || flowMeta[flow.id]?.label || flow.id,
      track: flow.track || flowMeta[flow.id]?.track || "",
    };
  }

  day.flows = flows.map((flow) => ({
    id: flow.id,
    label: nextMeta[flow.id].label,
    track: nextMeta[flow.id].track,
  }));
  day.flowOrder = day.flows.map((flow) => flow.id);
  day.flowMeta = nextMeta;
  return day.flows;
}

function parseTimeToMinutes(value) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
}

function getEventStartMinutes(event) {
  return parseTimeToMinutes(event?.start) ?? 9 * 60;
}

function getEventEndMinutes(event) {
  const start = getEventStartMinutes(event);
  const end = parseTimeToMinutes(event?.end);
  return end !== null && end > start ? end : start + 60;
}

function rangesOverlap(firstStart, firstEnd, secondStart, secondEnd) {
  return firstStart < secondEnd && secondStart < firstEnd;
}

function mergeDayFlowOrder(day, nextOrder = day?.flowOrder) {
  const ordered = normalizeFlowOrder(nextOrder);
  for (const event of day?.events || []) {
    const parallelGroup = String(event?.parallelGroup || "A").trim() || "A";
    if (!ordered.includes(parallelGroup)) {
      ordered.push(parallelGroup);
    }
  }

  return ordered.length ? ordered : ["A"];
}

function ensureFlowInDay(day, parallelGroup, flowPatch = {}) {
  const nextGroup = String(parallelGroup || "A").trim() || "A";
  const flows = normalizeFlowDefinitions(day);
  const existingFlow = flows.find((flow) => flow.id === nextGroup);
  if (existingFlow) {
    existingFlow.label = flowPatch.label || existingFlow.label || nextGroup;
    existingFlow.track = flowPatch.track || existingFlow.track || "";
  } else {
    flows.push({
      id: nextGroup,
      label: flowPatch.label || nextGroup,
      track: flowPatch.track || "",
    });
  }
  syncDayFlows(day, flows);
}

function compactDayFlowOrder(day) {
  const existingFlows = normalizeFlowDefinitions(day);
  syncDayFlows(day, existingFlows.length ? existingFlows : [{ id: "A", label: "A", track: "" }]);
}

function validateEventSchedule(day, candidate, excludedEventId = null) {
  const start = parseTimeToMinutes(candidate?.start);
  const end = parseTimeToMinutes(candidate?.end);

  if (start === null || end === null) {
    throw createHttpError(400, "Укажите время в формате ЧЧ:ММ.");
  }

  if (end <= start) {
    throw createHttpError(400, "Окончание должно быть позже начала.");
  }

  const candidateGroup = candidate.parallelGroup || "A";
  const conflict = (day?.events || []).find((event) => {
    if (event.id === excludedEventId || (event.parallelGroup || "A") !== candidateGroup) {
      return false;
    }

    return rangesOverlap(start, end, getEventStartMinutes(event), getEventEndMinutes(event));
  });

  if (conflict) {
    throw createHttpError(
      409,
      `Конфликт с мероприятием "${conflict.title || "Без названия"}" в этом потоке.`,
    );
  }
}

function toSlugFragment(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "");
}

function createSpeakerId(name) {
  const slug = toSlugFragment(name);
  return `speaker-${slug || randomUUID().slice(0, 8)}`;
}

function normalizeProgramStatus(status) {
  return ["draft", "published", "archived"].includes(status) ? status : "draft";
}

function getDefaultEventTypes() {
  return [
    "Лекция",
    "Мастер-класс",
    "Практикум",
    "Экскурсия",
    "Групповая работа",
    "Рефлексия",
    "Поддержка",
    "Логистика",
  ];
}

function normalizeEventPatch(body = {}) {
  return {
    title: body.title || "",
    start: body.start || "",
    end: body.end || "",
    type: body.type || "",
    speakerId: body.speakerId || "",
    speakerName: body.speakerName || "",
    location: body.location || "",
    track: body.track || "",
    parallelGroup: body.parallelGroup || "A",
    status: body.status || "planned",
    tags: normalizeList(body.tags),
    description: body.description || "",
  };
}

function normalizeProgramPatch(body = {}, { defaultStatus = "draft" } = {}) {
  return {
    title: body.title || "Новая программа",
    description: body.description || "",
    status: body.status === undefined ? defaultStatus : normalizeProgramStatus(body.status),
    eventContext: {
      title: body.eventContext?.title || body.title || "Новое событие",
      eventType: body.eventContext?.eventType || "Форумное событие",
      venue: body.eventContext?.venue || "",
      startDate: body.eventContext?.startDate || "",
      endDate: body.eventContext?.endDate || "",
      participantCount: Number(body.eventContext?.participantCount || 0),
      description: body.eventContext?.description || body.description || "",
    },
  };
}

function normalizeDayPatch(body = {}) {
  return {
    label: body.label || "День",
    dateLabel: body.dateLabel || "",
    dateValue: body.dateValue || body.date || "",
  };
}

function findProgram(workspace, programId) {
  const program = workspace.programWorkspace.programs.find((item) => item.id === programId);

  if (!program) {
    throw createHttpError(404, "Программа не найдена");
  }

  return program;
}

function getSpeakerCatalogItem(workspace, speakerId) {
  return workspace.programWorkspace.speakersCatalog.find((item) => item.id === speakerId) || null;
}

function findDay(program, dayId) {
  const day = program.days.find((item) => item.id === dayId);

  if (!day) {
    throw createHttpError(404, "День программы не найден");
  }

  return day;
}

function findEvent(day, eventId) {
  const event = day.events.find((item) => item.id === eventId);

  if (!event) {
    throw createHttpError(404, "Событие не найдено");
  }

  return event;
}

function findSurvey(workspace, surveyId) {
  const survey = workspace.surveyWorkspace.surveys.find((item) => item.id === surveyId);

  if (!survey) {
    throw createHttpError(404, "Опросник не найден");
  }

  return survey;
}

function sortEvents(events) {
  return [...events].sort((left, right) => {
    const startCompare = String(left.start).localeCompare(String(right.start));
    if (startCompare !== 0) {
      return startCompare;
    }

    const trackCompare = String(left.parallelGroup).localeCompare(String(right.parallelGroup));
    if (trackCompare !== 0) {
      return trackCompare;
    }

    return String(left.title).localeCompare(String(right.title));
  });
}

function flattenEvents(workspace) {
  return workspace.programWorkspace.programs.flatMap((program) =>
    program.days.flatMap((day) =>
      day.events.map((event) => ({
        ...event,
        programId: program.id,
        programTitle: program.title,
        programStatus: program.status || "draft",
        dayId: day.id,
        dayLabel: day.label,
      })),
    ),
  );
}

function getCanonicalProgram(programs = [], currentProgramId = null) {
  const normalizedPrograms = Array.isArray(programs) ? programs.filter(Boolean) : [];
  if (!normalizedPrograms.length) {
    return null;
  }

  return (
    normalizedPrograms.find((program) => program.id === currentProgramId) ||
    normalizedPrograms.find((program) => program.isCurrent || program.is_current) ||
    normalizedPrograms[0]
  );
}

function ensureProgramWorkspaceDefaults(workspace) {
  workspace.programWorkspace = workspace.programWorkspace || {};
  const canonicalProgram = getCanonicalProgram(
    workspace.programWorkspace.programs,
    workspace.programWorkspace.currentProgramId,
  );
  workspace.programWorkspace.programs = canonicalProgram ? [canonicalProgram] : [];
  workspace.programWorkspace.currentProgramId = canonicalProgram?.id || null;
  workspace.programWorkspace.reference = {
    ...(workspace.programWorkspace.reference || {}),
    eventTypes:
      workspace.programWorkspace.reference?.eventTypes?.length
        ? workspace.programWorkspace.reference.eventTypes
        : getDefaultEventTypes(),
  };

  const catalogMap = new Map();
  const catalogNameMap = new Map();
  const registerSpeaker = (speaker) => {
    if (!speaker?.name) {
      return;
    }

    const speakerNameKey = speaker.name.trim().toLowerCase();
    const speakerId =
      catalogNameMap.get(speakerNameKey) || speaker.id || createSpeakerId(speaker.name);
    const existing = catalogMap.get(speakerId);
    catalogMap.set(speakerId, {
      id: speakerId,
      name: speaker.name,
      role: speaker.role || existing?.role || "Спикер / ведущий",
      topics: speaker.topics || existing?.topics || [],
    });
    catalogNameMap.set(speakerNameKey, speakerId);
  };

  (workspace.programWorkspace.speakersCatalog || []).forEach(registerSpeaker);
  (workspace.speakerLectureSummary?.speakers || []).forEach(registerSpeaker);

  workspace.programWorkspace.programs = (workspace.programWorkspace.programs || []).map((program, index) => {
    const eventContext = {
      id: program.eventContext?.id || `event-context-${program.id || index + 1}`,
      title: program.eventContext?.title || program.title || "Событие программы",
      eventType: program.eventContext?.eventType || "Форумное событие",
      venue: program.eventContext?.venue || "Площадка программы",
      startDate: program.eventContext?.startDate || "",
      endDate: program.eventContext?.endDate || "",
      participantCount:
        program.eventContext?.participantCount || workspace.audiencePool?.length || 0,
      description: program.eventContext?.description || program.description || "",
    };

    const days = (program.days || []).map((day) => {
      const events = (day.events || []).map((event) => {
        const normalizedSpeakerName = event.speakerName?.trim().toLowerCase();
        const speakerId =
          event.speakerId ||
          (normalizedSpeakerName ? catalogNameMap.get(normalizedSpeakerName) : "") ||
          "";
        if (speakerId && event.speakerName) {
          registerSpeaker({
            id: speakerId,
            name: event.speakerName,
          });
        }

        return {
          ...event,
          speakerId,
        };
      });

      const nextDay = {
        ...day,
        events,
      };
      syncDayFlows(nextDay);
      return nextDay;
    });

    return {
      ...program,
      eventContext,
      days,
    };
  });

  workspace.programWorkspace.speakersCatalog = Array.from(catalogMap.values()).sort((left, right) =>
    left.name.localeCompare(right.name, "ru"),
  );

  for (const program of workspace.programWorkspace.programs) {
    for (const day of program.days) {
      for (const event of day.events) {
        const speaker = event.speakerId ? getSpeakerCatalogItem(workspace, event.speakerId) : null;
        if (speaker) {
          event.speakerName = speaker.name;
        }
      }
    }
  }

  const hasActiveEvent = flattenEvents(workspace).some(
    (event) => event.id === workspace.programWorkspace.activeEventId,
  );
  if (!hasActiveEvent) {
    workspace.programWorkspace.activeEventId = flattenEvents(workspace)[0]?.id || null;
  }
}

function makeLectureKey(item) {
  return item.eventId || `${item.title}::${item.speakerName}`;
}

function syncSpeakerAndLectureSummary(workspace) {
  const flattenedEvents = flattenEvents(workspace).filter((event) => event.programStatus === "published");
  const existingLectures = workspace.speakerLectureSummary.lectures || [];
  const existingLectureMap = new Map(existingLectures.map((item) => [makeLectureKey(item), item]));
  const nextLectures = flattenedEvents.map((event) => {
    const existingLecture =
      existingLectureMap.get(event.id) ||
      existingLectureMap.get(`${event.title}::${event.speakerName}`);

    return {
      id: existingLecture?.id || `lecture-${event.id}`,
      eventId: event.id,
      title: event.title,
      speakerId: event.speakerId,
      speakerName: event.speakerName,
      day: event.dayLabel,
      start: event.start,
      end: event.end,
      avgActivationDelta: existingLecture?.avgActivationDelta || "н/д",
      completion: existingLecture?.completion || 0,
      topThemes: existingLecture?.topThemes || event.tags.slice(0, 3),
      note:
        existingLecture?.note ||
        "Аналитика по этому блоку появится после накопления ответов участников.",
    };
  });

  const speakerStats = new Map();
  for (const event of flattenedEvents) {
    const speakerName = event.speakerName || "Команда программы";
    const speakerKey = event.speakerId || createSpeakerId(speakerName);
    const current = speakerStats.get(speakerKey) || {
      speakerId: speakerKey,
      speakerName,
      tags: new Set(),
      eventsLed: 0,
    };
    event.tags.forEach((tag) => current.tags.add(tag));
    current.eventsLed += 1;
    speakerStats.set(speakerKey, current);
  }

  const existingSpeakerMap = new Map(
    (workspace.speakerLectureSummary.speakers || []).map((speaker) => [speaker.id || speaker.name, speaker]),
  );

  const nextSpeakers = Array.from(speakerStats.entries()).map(([speakerKey, stats]) => {
    const catalogSpeaker = getSpeakerCatalogItem(workspace, stats.speakerId);
    const existingSpeaker = existingSpeakerMap.get(speakerKey);
    const speakerName = catalogSpeaker?.name || stats.speakerName;

    return {
      id:
        existingSpeaker?.id ||
        stats.speakerId ||
        `speaker-${speakerName.toLowerCase().replace(/[^a-z0-9а-яё]+/gi, "-")}`,
      name: speakerName,
      role: catalogSpeaker?.role || existingSpeaker?.role || "Спикер / ведущий",
      topics: catalogSpeaker?.topics?.length ? catalogSpeaker.topics : Array.from(stats.tags).slice(0, 4),
      eventsLed: stats.eventsLed,
      activationLift: existingSpeaker?.activationLift || "н/д",
      feedbackTone:
        existingSpeaker?.feedbackTone || "Качественная аналитика появится после первых срезов.",
      recommendation:
        existingSpeaker?.recommendation ||
        "Использовать этот блок как наблюдаемую единицу до накопления новой выборки.",
    };
  });

  workspace.speakerLectureSummary = {
    ...workspace.speakerLectureSummary,
    speakers: nextSpeakers,
    lectures: nextLectures,
  };
}

function syncSummary(workspace) {
  const programs = workspace.programWorkspace.programs || [];
  const activeEvent = flattenEvents(workspace).find(
    (event) => event.id === workspace.programWorkspace.activeEventId,
  );

  workspace.summary = {
    ...workspace.summary,
    programsCount: programs.length,
    groupsCount: workspace.groupsSummary.groups.length,
    speakersCount: workspace.programWorkspace.speakersCatalog.length,
    surveysCount: workspace.surveyWorkspace.surveys.length,
    activeEventLabel: activeEvent
      ? `${activeEvent.type}: ${activeEvent.title}`
      : "Актуальное событие не выбрано",
  };
}

function ensureSurveyFilterOptions(workspace) {
  const unique = (values) => Array.from(new Set(values)).filter(Boolean);

  workspace.surveyWorkspace.filterOptions = {
    ...workspace.surveyWorkspace.filterOptions,
    identityStatuses: unique(workspace.audiencePool.map((item) => item.identityStatus)),
    groupIds: unique(workspace.audiencePool.map((item) => item.groupId)),
    genders: unique(workspace.audiencePool.map((item) => item.gender)),
    emotionalProfiles: unique(workspace.audiencePool.map((item) => item.emotionalProfile)),
  };
}

function matchAudience(participant, filters) {
  if (filters.ageMin !== null && filters.ageMin !== undefined && participant.age < filters.ageMin) {
    return false;
  }

  if (filters.ageMax !== null && filters.ageMax !== undefined && participant.age > filters.ageMax) {
    return false;
  }

  if (filters.genders?.length && !filters.genders.includes(participant.gender)) {
    return false;
  }

  if (
    filters.emotionalProfiles?.length &&
    !filters.emotionalProfiles.includes(participant.emotionalProfile)
  ) {
    return false;
  }

  if (filters.groupIds?.length && !filters.groupIds.includes(participant.groupId)) {
    return false;
  }

  if (
    filters.identityStatuses?.length &&
    !filters.identityStatuses.includes(participant.identityStatus)
  ) {
    return false;
  }

  return true;
}

function normalizeSurveyFilters(body = {}) {
  return {
    ageMin:
      body.ageMin === "" || body.ageMin === undefined || body.ageMin === null
        ? null
        : Number(body.ageMin),
    ageMax:
      body.ageMax === "" || body.ageMax === undefined || body.ageMax === null
        ? null
        : Number(body.ageMax),
    genders: normalizeList(body.genders),
    emotionalProfiles: normalizeList(body.emotionalProfiles),
    groupIds: normalizeList(body.groupIds),
    identityStatuses: normalizeList(body.identityStatuses),
  };
}

function buildAudienceSummary(workspace, filters, recipientsCount) {
  const parts = [
    workspace.sessionLabel || workspace.sessionId,
    filters.ageMin || filters.ageMax
      ? `${filters.ageMin ?? "?"}-${filters.ageMax ?? "?"} лет`
      : "все возраста",
    filters.genders.length ? filters.genders.join(", ") : "все гендеры",
    filters.groupIds.length ? filters.groupIds.join(", ") : "все группы",
    filters.emotionalProfiles.length
      ? filters.emotionalProfiles.join(", ")
      : "все эмоциональные профили",
    filters.identityStatuses.length
      ? filters.identityStatuses.join(", ")
      : "все статусы идентичности",
    `${recipientsCount} получателей`,
  ];

  return parts.join(" · ");
}

function syncWorkspace(workspace) {
  ensureProgramWorkspaceDefaults(workspace);
  ensureSurveyFilterOptions(workspace);
  syncSpeakerAndLectureSummary(workspace);
  syncSummary(workspace);
  return workspace;
}

app.get(
  "/api/health",
  asyncHandler(async (_req, res) => {
    const workspace = await getWorkspace("session-istoki-school-2026");

    res.json({
      ok: true,
      time: new Date().toISOString(),
      dataMode: workspace.meta?.storageMode || "memory",
      postgresConfigured: hasPostgresConfig(),
    });
  }),
);

app.get(
  "/api/users",
  asyncHandler(async (_req, res) => {
    res.json(await listUsers());
  }),
);

app.get(
  "/api/public/events",
  asyncHandler(async (_req, res) => {
    res.json(await listPublicEvents());
  }),
);

app.post(
  "/api/participants/register",
  asyncHandler(async (req, res) => {
    res.status(201).json(await registerParticipant(req.body || {}));
  }),
);

app.get(
  "/api/bootstrap",
  asyncHandler(async (req, res) => {
    const viewerId = getViewerId(req);
    res.json(await getBootstrap(viewerId));
  }),
);

app.get(
  "/api/participant/sessions/:sessionId/diary",
  asyncHandler(async (req, res) => {
    res.json(
      await getParticipantDiary({
        viewerId: getViewerId(req),
        sessionId: req.params.sessionId,
      }),
    );
  }),
);

app.patch(
  "/api/participant/sessions/:sessionId/diary/:entryId",
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

app.patch(
  "/api/participant/sessions/:sessionId/reflections/:dayId",
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

app.get(
  "/api/curator/sessions/:sessionId/groups/:groupId/dashboard",
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

app.get(
  "/api/admin/dashboard",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    res.json(await getAdminDashboard());
  }),
);

app.get(
  "/api/admin/workspace",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    res.json(await getAdminWorkspace());
  }),
);

app.post(
  "/api/admin/users",
  requireAdmin,
  asyncHandler(async (req, res) => {
    res.status(201).json(await createUser({ actorId: req.viewer.id, payload: req.body || {} }));
  }),
);

app.patch(
  "/api/admin/users/:userId",
  requireAdmin,
  asyncHandler(async (req, res) => {
    res.json(await updateUser({ actorId: req.viewer.id, userId: req.params.userId, payload: req.body || {} }));
  }),
);

app.patch(
  "/api/admin/users/:userId/status",
  requireAdmin,
  asyncHandler(async (req, res) => {
    res.json(await updateUserStatus({ actorId: req.viewer.id, userId: req.params.userId, status: req.body?.status }));
  }),
);

app.post(
  "/api/admin/users/:userId/assignments",
  requireAdmin,
  asyncHandler(async (req, res) => {
    res.status(201).json(await upsertUserAssignment({ actorId: req.viewer.id, userId: req.params.userId, payload: req.body || {} }));
  }),
);

app.patch(
  "/api/admin/users/:userId/assignments/:sessionId",
  requireAdmin,
  asyncHandler(async (req, res) => {
    res.json(
      await upsertUserAssignment({
        actorId: req.viewer.id,
        userId: req.params.userId,
        payload: {
          ...(req.body || {}),
          sessionId: req.params.sessionId,
        },
      }),
    );
  }),
);

app.post(
  "/api/admin/sessions",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const session = await createSession({
      actorId: req.viewer.id,
      payload: req.body || {},
      assignOrganizerId: req.body?.organizerId || null,
    });
    res.status(201).json(session);
  }),
);

app.patch(
  "/api/admin/sessions/:sessionId",
  requireAdmin,
  asyncHandler(async (req, res) => {
    res.json(await updateSession({ actorId: req.viewer.id, sessionId: req.params.sessionId, payload: req.body || {} }));
  }),
);

app.patch(
  "/api/admin/sessions/:sessionId/registration",
  requireAdmin,
  asyncHandler(async (req, res) => {
    res.json(await updateRegistration({ actorId: req.viewer.id, sessionId: req.params.sessionId, payload: req.body || {} }));
  }),
);

app.get(
  "/api/organizer/workspace",
  asyncHandler(async (req, res) => {
    const viewer = await getUser(getViewerId(req));

    if (!viewer || (!isOrganizerViewer(viewer) && !isAdminViewer(viewer)) || viewer.status === "disabled") {
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

app.post(
  "/api/organizer/sessions",
  asyncHandler(async (req, res) => {
    const viewer = await getUser(getViewerId(req));

    if (!viewer || (!isOrganizerViewer(viewer) && !isAdminViewer(viewer)) || viewer.status === "disabled") {
      throw createHttpError(403, "Недостаточно прав для создания заезда");
    }

    const payload = isAdminViewer(viewer) ? req.body || {} : pickOrganizerSessionPayload(req.body || {});
    const session = await createSession({
      actorId: viewer.id,
      payload,
      assignOrganizerId: isOrganizerViewer(viewer) && !isAdminViewer(viewer) ? viewer.id : req.body?.organizerId || null,
    });
    res.status(201).json(session);
  }),
);

app.patch(
  "/api/organizer/sessions/:sessionId",
  requireOrganizer,
  asyncHandler(async (req, res) => {
    const payload = isAdminViewer(req.viewer) ? req.body || {} : pickOrganizerSessionPayload(req.body || {});
    res.json(
      await updateSession({
        actorId: req.viewer.id,
        sessionId: req.params.sessionId,
        payload,
        allowExtendedRegistrationFields: false,
      }),
    );
  }),
);

app.patch(
  "/api/organizer/sessions/:sessionId/registration",
  requireOrganizer,
  asyncHandler(async (req, res) => {
    res.json(await updateRegistration({ actorId: req.viewer.id, sessionId: req.params.sessionId, payload: req.body || {} }));
  }),
);

app.get(
  "/api/organizer/sessions/:sessionId/workspace",
  requireOrganizer,
  asyncHandler(async (req, res) => {
    const workspace = await getWorkspace(req.params.sessionId);
    res.json(syncWorkspace(workspace));
  }),
);

app.get(
  "/api/organizer/sessions/:sessionId/analytics",
  requireOrganizer,
  asyncHandler(async (req, res) => {
    const workspace = syncWorkspace(await getWorkspace(req.params.sessionId));
    res.json({
      sessionId: workspace.sessionId,
      meta: {
        ...(workspace.meta || {}),
        analyticsUpdatedAt: new Date().toISOString(),
      },
      summary: workspace.summary || {},
      groupsSummary: workspace.groupsSummary || { groups: [], alerts: [] },
      sessionSummary: workspace.sessionSummary || {},
      speakerLectureSummary: workspace.speakerLectureSummary || { speakers: [], lectures: [] },
    });
  }),
);

app.post(
  "/api/organizer/sessions/:sessionId/programs",
  requireOrganizer,
  asyncHandler(async (req, res) => {
    const payload = normalizeProgramPatch(req.body);

    const workspace = await updateWorkspace(req.params.sessionId, (draft) => {
      syncWorkspace(draft);
      if (draft.programWorkspace.programs.length) {
        return syncWorkspace(draft);
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
      return syncWorkspace(draft);
    });

    res.json(workspace);
  }),
);

app.patch(
  "/api/organizer/sessions/:sessionId/programs/:programId",
  requireOrganizer,
  asyncHandler(async (req, res) => {
    const payload = normalizeProgramPatch(req.body, { defaultStatus: undefined });

    const workspace = await updateWorkspace(req.params.sessionId, (draft) => {
      syncWorkspace(draft);
      const program = findProgram(draft, req.params.programId);
      program.title = payload.title;
      program.description = payload.description;
      if (payload.status !== undefined) {
        program.status = payload.status;
      }
      program.eventContext = {
        ...program.eventContext,
        ...payload.eventContext,
      };
      return syncWorkspace(draft);
    });

    res.json(workspace);
  }),
);

app.post(
  "/api/organizer/sessions/:sessionId/programs/:programId/select",
  requireOrganizer,
  asyncHandler(async (req, res) => {
    const workspace = await updateWorkspace(req.params.sessionId, (draft) => {
      findProgram(draft, req.params.programId);
      draft.programWorkspace.currentProgramId = req.params.programId;
      const currentProgram = findProgram(draft, req.params.programId);
      const candidateEvent =
        flattenEvents(draft).find((event) => event.id === draft.programWorkspace.activeEventId) ||
        currentProgram.days[0]?.events[0];

      if (candidateEvent) {
        draft.programWorkspace.activeEventId = candidateEvent.id;
      }

      return syncWorkspace(draft);
    });

    res.json(workspace);
  }),
);

app.post(
  "/api/organizer/sessions/:sessionId/programs/:programId/days",
  requireOrganizer,
  asyncHandler(async (req, res) => {
    const payload = normalizeDayPatch(req.body);

    const workspace = await updateWorkspace(req.params.sessionId, (draft) => {
      syncWorkspace(draft);
      const program = findProgram(draft, req.params.programId);
      const nextDayId = `day-${randomUUID().slice(0, 8)}`;
      program.days.push({
        id: nextDayId,
        label: payload.label,
        dateLabel: payload.dateLabel,
        dateValue: payload.dateValue,
        flowOrder: ["A"],
        flowMeta: { A: { label: "A", track: "" } },
        flows: [{ id: "A", label: "A", track: "" }],
        events: [],
      });
      return syncWorkspace(draft);
    });

    res.status(201).json(workspace);
  }),
);

app.patch(
  "/api/organizer/sessions/:sessionId/programs/:programId/days/:dayId",
  requireOrganizer,
  asyncHandler(async (req, res) => {
    const payload = normalizeDayPatch(req.body);

    const workspace = await updateWorkspace(req.params.sessionId, (draft) => {
      syncWorkspace(draft);
      const program = findProgram(draft, req.params.programId);
      const day = findDay(program, req.params.dayId);
      day.label = payload.label;
      day.dateLabel = payload.dateLabel;
      day.dateValue = payload.dateValue;
      return syncWorkspace(draft);
    });

    res.json(workspace);
  }),
);

app.delete(
  "/api/organizer/sessions/:sessionId/programs/:programId/days/:dayId",
  requireOrganizer,
  asyncHandler(async (req, res) => {
    const workspace = await updateWorkspace(req.params.sessionId, (draft) => {
      syncWorkspace(draft);
      const program = findProgram(draft, req.params.programId);
      const day = findDay(program, req.params.dayId);
      program.days = program.days.filter((item) => item.id !== day.id);

      if ((day.events || []).some((event) => event.id === draft.programWorkspace.activeEventId)) {
        draft.programWorkspace.activeEventId = flattenEvents(draft)[0]?.id || null;
      }

      return syncWorkspace(draft);
    });

    res.json(workspace);
  }),
);

app.patch(
  "/api/organizer/sessions/:sessionId/programs/:programId/days/:dayId/flows",
  requireOrganizer,
  asyncHandler(async (req, res) => {
    const rawFlows = Array.isArray(req.body?.flows) ? req.body.flows : [];

    const workspace = await updateWorkspace(req.params.sessionId, (draft) => {
      syncWorkspace(draft);
      const program = findProgram(draft, req.params.programId);
      const day = findDay(program, req.params.dayId);
      const existingFlows = normalizeFlowDefinitions(day);
      const existingById = new Map(existingFlows.map((flow) => [flow.id, flow]));
      const nextFlows = [];
      const seenIds = new Set();

      for (const [index, rawFlow] of rawFlows.entries()) {
        const id = normalizeFlowId(
          typeof rawFlow === "string" ? rawFlow : rawFlow?.id || rawFlow?.value || rawFlow?.parallelGroup,
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

      for (const flowId of getFlowEventIds(day)) {
        if (!seenIds.has(flowId)) {
          nextFlows.push(existingById.get(flowId) || { id: flowId, label: flowId, track: "" });
          seenIds.add(flowId);
        }
      }

      validateFlowDefinitions(nextFlows.length ? nextFlows : [{ id: "A", label: "A", track: "" }]);
      syncDayFlows(day, nextFlows.length ? nextFlows : [{ id: "A", label: "A", track: "" }]);
      return syncWorkspace(draft);
    });

    res.json(workspace);
  }),
);

app.patch(
  "/api/organizer/sessions/:sessionId/programs/:programId/days/:dayId/flow-order",
  requireOrganizer,
  asyncHandler(async (req, res) => {
    const flowOrder = normalizeFlowOrder(req.body?.flowOrder || req.body?.order || req.body?.columns);

    const workspace = await updateWorkspace(req.params.sessionId, (draft) => {
      syncWorkspace(draft);
      const program = findProgram(draft, req.params.programId);
      const day = findDay(program, req.params.dayId);
      const flowMap = new Map(normalizeFlowDefinitions(day).map((flow) => [flow.id, flow]));
      const nextOrder = mergeDayFlowOrder(day, flowOrder);
      syncDayFlows(
        day,
        nextOrder.map((flowId) => flowMap.get(flowId) || { id: flowId, label: flowId, track: "" }),
      );
      return syncWorkspace(draft);
    });

    res.json(workspace);
  }),
);

app.patch(
  "/api/organizer/sessions/:sessionId/programs/:programId/days/:dayId/events/:eventId",
  requireOrganizer,
  asyncHandler(async (req, res) => {
    const patch = req.body || {};

    const workspace = await updateWorkspace(req.params.sessionId, (draft) => {
      syncWorkspace(draft);
      const program = findProgram(draft, req.params.programId);
      const day = findDay(program, req.params.dayId);
      const event = findEvent(day, req.params.eventId);
      const normalizedPatch = normalizeEventPatch({ ...event, ...patch });
      const speaker = patch.speakerId ? getSpeakerCatalogItem(draft, patch.speakerId) : null;
      const candidate = {
        ...event,
        ...normalizedPatch,
        speakerName: speaker?.name || normalizedPatch.speakerName || event.speakerName,
      };

      validateEventSchedule(day, candidate, event.id);
      ensureFlowInDay(day, candidate.parallelGroup, { track: candidate.track });
      Object.assign(event, candidate);
      day.events = sortEvents(day.events);
      return syncWorkspace(draft);
    });

    res.json(workspace);
  }),
);

app.post(
  "/api/organizer/sessions/:sessionId/programs/:programId/days/:dayId/events/parallel",
  requireOrganizer,
  asyncHandler(async (req, res) => {
    const payload = normalizeEventPatch(req.body);

    const workspace = await updateWorkspace(req.params.sessionId, (draft) => {
      syncWorkspace(draft);
      const program = findProgram(draft, req.params.programId);
      const day = findDay(program, req.params.dayId);
      const speaker = payload.speakerId ? getSpeakerCatalogItem(draft, payload.speakerId) : null;
      const nextEvent = {
        id: `event-${randomUUID().slice(0, 8)}`,
        ...payload,
        speakerName: speaker?.name || payload.speakerName || "",
      };

      validateEventSchedule(day, nextEvent);
      ensureFlowInDay(day, nextEvent.parallelGroup, { track: nextEvent.track });
      day.events.push(nextEvent);
      day.events = sortEvents(day.events);
      return syncWorkspace(draft);
    });

    res.json(workspace);
  }),
);

app.delete(
  "/api/organizer/sessions/:sessionId/programs/:programId/days/:dayId/events/:eventId",
  requireOrganizer,
  asyncHandler(async (req, res) => {
    const workspace = await updateWorkspace(req.params.sessionId, (draft) => {
      syncWorkspace(draft);
      const program = findProgram(draft, req.params.programId);
      const day = findDay(program, req.params.dayId);
      findEvent(day, req.params.eventId);

      day.events = day.events.filter((event) => event.id !== req.params.eventId);
      compactDayFlowOrder(day);

      if (draft.programWorkspace.activeEventId === req.params.eventId) {
        draft.programWorkspace.activeEventId = day.events[0]?.id || flattenEvents(draft)[0]?.id || null;
      }

      return syncWorkspace(draft);
    });

    res.json(workspace);
  }),
);

app.post(
  "/api/organizer/sessions/:sessionId/programs/:programId/days/:dayId/events/:eventId/activate",
  requireOrganizer,
  asyncHandler(async (req, res) => {
    const workspace = await updateWorkspace(req.params.sessionId, (draft) => {
      const targetProgram = findProgram(draft, req.params.programId);
      const targetDay = findDay(targetProgram, req.params.dayId);
      findEvent(targetDay, req.params.eventId);

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

      return syncWorkspace(draft);
    });

    res.json(workspace);
  }),
);

app.post(
  "/api/organizer/sessions/:sessionId/surveys",
  requireOrganizer,
  asyncHandler(async (req, res) => {
    const payload = req.body || {};

    const workspace = await updateWorkspace(req.params.sessionId, (draft) => {
      const questions = Array.isArray(payload.questions)
        ? payload.questions.map((question) => ({
            id: question.id || `question-${randomUUID().slice(0, 8)}`,
            type: question.type || "scale",
            title: question.title || "Новый вопрос",
            options: normalizeList(question.options),
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

      return syncWorkspace(draft);
    });

    res.json(workspace);
  }),
);

app.patch(
  "/api/organizer/sessions/:sessionId/surveys/:surveyId",
  requireOrganizer,
  asyncHandler(async (req, res) => {
    const payload = req.body || {};

    const workspace = await updateWorkspace(req.params.sessionId, (draft) => {
      const survey = findSurvey(draft, req.params.surveyId);
      survey.title = payload.title ?? survey.title;
      survey.category = payload.category ?? survey.category;
      survey.cadence = payload.cadence ?? survey.cadence;
      survey.source = payload.source ?? survey.source;
      survey.description = payload.description ?? survey.description;
      survey.status = payload.status ?? survey.status;
      return syncWorkspace(draft);
    });

    res.json(workspace);
  }),
);

app.post(
  "/api/organizer/sessions/:sessionId/surveys/:surveyId/questions",
  requireOrganizer,
  asyncHandler(async (req, res) => {
    const payload = req.body || {};

    const workspace = await updateWorkspace(req.params.sessionId, (draft) => {
      const survey = findSurvey(draft, req.params.surveyId);
      survey.questions.push({
        id: `question-${randomUUID().slice(0, 8)}`,
        type: payload.type || "scale",
        title: payload.title || "Новый вопрос",
        options: normalizeList(payload.options),
      });

      return syncWorkspace(draft);
    });

    res.json(workspace);
  }),
);

app.patch(
  "/api/organizer/sessions/:sessionId/surveys/:surveyId/questions/:questionId",
  requireOrganizer,
  asyncHandler(async (req, res) => {
    const payload = req.body || {};

    const workspace = await updateWorkspace(req.params.sessionId, (draft) => {
      const survey = findSurvey(draft, req.params.surveyId);
      const question = survey.questions.find((item) => item.id === req.params.questionId);

      if (!question) {
        throw createHttpError(404, "Вопрос не найден");
      }

      question.type = payload.type ?? question.type;
      question.title = payload.title ?? question.title;
      question.options =
        payload.options !== undefined ? normalizeList(payload.options) : question.options;
      return syncWorkspace(draft);
    });

    res.json(workspace);
  }),
);

app.post(
  "/api/organizer/sessions/:sessionId/surveys/:surveyId/publish",
  requireOrganizer,
  asyncHandler(async (req, res) => {
    const filters = normalizeSurveyFilters(req.body);

    const workspace = await updateWorkspace(req.params.sessionId, (draft) => {
      const survey = findSurvey(draft, req.params.surveyId);
      const recipients = draft.audiencePool.filter((participant) => matchAudience(participant, filters));

      survey.status = "published";
      draft.surveyWorkspace.publications.unshift({
        id: `publication-${randomUUID().slice(0, 8)}`,
        surveyId: survey.id,
        status: "active",
        publishedAt: new Date().toISOString(),
        audienceSummary: buildAudienceSummary(draft, filters, recipients.length),
        recipientsCount: recipients.length,
        filters,
      });

      return syncWorkspace(draft);
    });

    res.json(workspace);
  }),
);

app.use((error, _req, res, _next) => {
  const status = error.status || 500;
  res.status(status).json({
    message: error.message || "Внутренняя ошибка сервера",
  });
});

function startServer() {
  return app.listen(PORT, HOST, () => {
    console.log(`[server] Organizer API listening on http://${HOST}:${PORT}`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = {
  app,
  startServer,
};
