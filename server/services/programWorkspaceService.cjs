"use strict";

const { createHttpError } = require("../lib/routeHelpers.cjs");
const { getParticipantEventAccessSettings } = require("../db/repositories/eventAccess.cjs");
const flow = require("./programFlowService.cjs");
const norm = require("./programNormalizers.cjs");

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
    eventTypes: workspace.programWorkspace.reference?.eventTypes?.length
      ? workspace.programWorkspace.reference.eventTypes
      : norm.getDefaultEventTypes(),
  };

  const catalogMap = new Map();
  const catalogNameMap = new Map();
  const registerSpeaker = (speaker) => {
    if (!speaker?.name) {
      return;
    }

    const speakerNameKey = speaker.name.trim().toLowerCase();
    const speakerId =
      catalogNameMap.get(speakerNameKey) || speaker.id || norm.createSpeakerId(speaker.name);
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

  workspace.programWorkspace.programs = (workspace.programWorkspace.programs || []).map(
    (program, index) => {
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
        flow.syncDayFlows(nextDay);
        return nextDay;
      });

      return {
        ...program,
        eventContext,
        days,
      };
    },
  );

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
  const flattenedEvents = flattenEvents(workspace).filter(
    (event) => event.programStatus === "published",
  );
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
    const speakerKey = event.speakerId || norm.createSpeakerId(speakerName);
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
    (workspace.speakerLectureSummary.speakers || []).map((speaker) => [
      speaker.id || speaker.name,
      speaker,
    ]),
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
      topics: catalogSpeaker?.topics?.length
        ? catalogSpeaker.topics
        : Array.from(stats.tags).slice(0, 4),
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

function syncWorkspace(workspace) {
  workspace.sessionSettings = getParticipantEventAccessSettings(workspace.sessionSettings);
  ensureProgramWorkspaceDefaults(workspace);
  ensureSurveyFilterOptions(workspace);
  syncSpeakerAndLectureSummary(workspace);
  syncSummary(workspace);
  return workspace;
}

module.exports = {
  findProgram,
  getSpeakerCatalogItem,
  findDay,
  findEvent,
  findSurvey,
  sortEvents,
  flattenEvents,
  getCanonicalProgram,
  ensureProgramWorkspaceDefaults,
  makeLectureKey,
  syncSpeakerAndLectureSummary,
  syncSummary,
  ensureSurveyFilterOptions,
  syncWorkspace,
};
