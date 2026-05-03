import { getEventStatusLabel, normalizeList } from "../../lib/organizerWorkspace";
import {
  createProgramDayDraft as createAutoProgramDayDraft,
  formatProgramDayDateLabel,
  isCustomProgramDayDateLabel,
} from "../../lib/programDays";
import { chartPalette } from "../Charts";

export const DEFAULT_EVENT_STATUS_OPTIONS = [
  { value: "planned", label: "Запланировано" },
  { value: "active", label: "Текущее" },
  { value: "completed", label: "Завершено" },
];

export const EMPTY_PROGRAM = { eventContext: {}, days: [] };
export const EMPTY_EVENT = {};

export function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

export function safeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function createReflectionQuestionDraft() {
  const suffix =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().slice(0, 8)
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  return {
    id: `reflection-question-${suffix}`,
    text: "",
    required: false,
  };
}

export function normalizeReflectionQuestions(value = []) {
  return safeArray(value)
    .map((question) => ({
      id: String(question?.id || createReflectionQuestionDraft().id).trim(),
      text: String(question?.text || question?.title || "").trimStart(),
      required: Boolean(question?.required),
    }))
    .filter((question) => question.id);
}

export function normalizeScheduleEvent(event, fallbackIndex = 0, fallbackPrefix = "event") {
  const rawEvent = safeObject(event);
  return {
    ...rawEvent,
    id: rawEvent.id || `${fallbackPrefix}-${fallbackIndex}`,
    title: rawEvent.title || "Без названия",
    start: rawEvent.start || "09:00",
    end: rawEvent.end || "10:00",
    type: rawEvent.type || "",
    speakerId: rawEvent.speakerId || "",
    speakerName: rawEvent.speakerName || "",
    location: rawEvent.location || "",
    track: rawEvent.track || "",
    parallelGroup: rawEvent.parallelGroup || "A",
    status: rawEvent.status || "planned",
    tags: normalizeList(rawEvent.tags),
    description: rawEvent.description || "",
    reflectionQuestions: normalizeReflectionQuestions(rawEvent.reflectionQuestions),
  };
}

export function normalizeComponentProgram(program, fallbackIndex = 0) {
  const rawProgram = safeObject(program);
  const eventContext = safeObject(rawProgram.eventContext);
  return {
    ...rawProgram,
    id: rawProgram.id || `program-${fallbackIndex}`,
    title: rawProgram.title || "Без названия",
    description: rawProgram.description || "",
    status: rawProgram.status || "draft",
    eventContext: {
      ...eventContext,
      title: eventContext.title || rawProgram.title || "Событие",
      eventType: eventContext.eventType || "Событие",
      venue: eventContext.venue || "",
    },
    days: safeArray(rawProgram.days),
  };
}

export function normalizeStatusOptions(statusOptions = DEFAULT_EVENT_STATUS_OPTIONS) {
  return safeArray(statusOptions).map((option) =>
    typeof option === "string" ? { value: option, label: getEventStatusLabel(option) } : option,
  );
}

export function parseTimeToMinutes(value) {
  if (typeof value !== "string") {
    return null;
  }

  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return hours * 60 + minutes;
}

export function formatMinutesAsTime(value) {
  const safeValue = Math.max(0, Math.min(24 * 60, Number(value) || 0));
  const hours = Math.floor(safeValue / 60);
  const minutes = safeValue % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function floorToStep(value, step) {
  return Math.floor(value / step) * step;
}

export function ceilToStep(value, step) {
  return Math.ceil(value / step) * step;
}

export function getEventStartMinutes(event) {
  return parseTimeToMinutes(event?.start) ?? 9 * 60;
}

export function getEventEndMinutes(event, defaultDurationMinutes = 60) {
  const start = getEventStartMinutes(event);
  const end = parseTimeToMinutes(event?.end);
  return end !== null && end > start ? end : start + defaultDurationMinutes;
}

export function normalizeColumnDefinition(column, fallbackIndex = 0) {
  if (typeof column === "string") {
    return {
      id: column || `P${fallbackIndex + 1}`,
      label: column || `P${fallbackIndex + 1}`,
      track: "",
    };
  }

  const id = column?.id || column?.value || column?.parallelGroup || `P${fallbackIndex + 1}`;
  return {
    id,
    label: column?.label || column?.title || id,
    track: column?.track || "",
  };
}

export function normalizeColumnOrder(value = []) {
  return Array.from(
    new Set(
      safeArray(value)
        .map((item) =>
          typeof item === "string" ? item : item?.id || item?.value || item?.parallelGroup || "",
        )
        .map((item) => String(item).trim())
        .filter(Boolean),
    ),
  );
}

export function sortColumnsByOrder(columns = [], columnOrder = []) {
  const orderedIds = normalizeColumnOrder(columnOrder);
  const columnMap = new Map(columns.map((column) => [column.id, column]));
  const ordered = orderedIds.map((id) => columnMap.get(id)).filter(Boolean);
  const orderedSet = new Set(ordered.map((column) => column.id));
  const rest = columns
    .filter((column) => !orderedSet.has(column.id))
    .sort((first, second) =>
      first.label.localeCompare(second.label, "ru", { numeric: true, sensitivity: "base" }),
    );

  return [...ordered, ...rest];
}

export function moveListItem(items = [], fromIndex = 0, toIndex = 0) {
  const nextItems = [...items];
  const [item] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, item);
  return nextItems;
}

export function getStableParallelColumns(events = [], columns = [], columnOrder = []) {
  const columnMap = new Map();

  columns.forEach((column, index) => {
    const normalized = normalizeColumnDefinition(column, index);
    columnMap.set(normalized.id, normalized);
  });

  normalizeColumnOrder(columnOrder).forEach((id) => {
    if (!columnMap.has(id)) {
      columnMap.set(id, { id, label: id, track: "" });
    }
  });

  events.forEach((event) => {
    const id = event.parallelGroup || "A";
    const existing = columnMap.get(id);
    columnMap.set(id, {
      id,
      label: existing?.label || id,
      track: existing?.track || event.track || "",
    });
  });

  const result = sortColumnsByOrder(Array.from(columnMap.values()), columnOrder);

  return result.length ? result : [{ id: "A", label: "A", track: "Общий поток" }];
}

export function getNextFlowId(columns = []) {
  const usedIds = new Set(
    safeArray(columns)
      .map((column) => String(column?.id || column || "").trim())
      .filter(Boolean),
  );
  let maxIndex = 0;
  for (const id of usedIds) {
    const match = id.match(/^P(\d+)$/i);
    if (match) {
      maxIndex = Math.max(maxIndex, Number(match[1]) || 0);
    }
  }

  let candidate = `P${maxIndex + 1 || 1}`;
  while (usedIds.has(candidate)) {
    maxIndex += 1;
    candidate = `P${maxIndex + 1}`;
  }

  return candidate;
}

export function isDuplicateFlowLabel(columns = [], label = "", excludeId = "") {
  const normalizedLabel = String(label || "")
    .trim()
    .toLowerCase();
  if (!normalizedLabel) {
    return false;
  }

  return safeArray(columns).some(
    (column) =>
      column.id !== excludeId &&
      String(column.label || column.id || "")
        .trim()
        .toLowerCase() === normalizedLabel,
  );
}

export function normalizeInlineEditableFields(fields) {
  const fallback = ["title", "track", "speakerName", "location"];
  if (!Array.isArray(fields)) {
    return fallback;
  }

  const allowed = new Set(fallback);
  const result = fields.filter((field) => allowed.has(field));
  return result.length ? result : fallback;
}

export function normalizeEventFormValue(event = {}, eventTypes = []) {
  const rawEvent = safeObject(event);
  return {
    title: rawEvent.title || "",
    start: rawEvent.start || "09:00",
    end: rawEvent.end || "10:00",
    type: rawEvent.type || safeArray(eventTypes)[0] || "",
    speakerId: rawEvent.speakerId || "",
    location: rawEvent.location || "",
    track: rawEvent.track || "",
    parallelGroup: rawEvent.parallelGroup || "A",
    status: rawEvent.status || "planned",
    tags: Array.isArray(rawEvent.tags) ? rawEvent.tags.join(", ") : rawEvent.tags || "",
    description: rawEvent.description || "",
    reflectionQuestions: normalizeReflectionQuestions(rawEvent.reflectionQuestions),
  };
}

export function normalizeEventPayload(form, speakersCatalog = []) {
  const speakerName =
    safeArray(speakersCatalog).find((speaker) => speaker.id === form.speakerId)?.name || "";
  return {
    ...form,
    speakerName,
    tags: normalizeList(form.tags),
    reflectionQuestions: normalizeReflectionQuestions(form.reflectionQuestions).filter((question) =>
      question.text.trim(),
    ),
  };
}

export function createScheduleEventDraft({
  start,
  parallelGroup,
  track,
  eventTypes,
  defaultDurationMinutes,
}) {
  const startMinutes = parseTimeToMinutes(start) ?? 9 * 60;
  const safeEventTypes = safeArray(eventTypes);

  return {
    title: "",
    start,
    end: formatMinutesAsTime(startMinutes + defaultDurationMinutes),
    type: safeEventTypes[0] || "",
    speakerId: "",
    location: "",
    track: track || (parallelGroup === "A" ? "Общий поток" : `Поток ${parallelGroup}`),
    parallelGroup,
    status: "planned",
    tags: "",
    description: "",
  };
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function getSafeSlotMinutes(slotMinutes) {
  return Number.isFinite(Number(slotMinutes)) && Number(slotMinutes) > 0 ? Number(slotMinutes) : 15;
}

export function getSafeRowHeight(rowHeight) {
  return Number.isFinite(Number(rowHeight)) && Number(rowHeight) >= 28 ? Number(rowHeight) : 48;
}

export function getSafeSize(value, fallback) {
  return Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : fallback;
}

export function rangesOverlap(firstStart, firstEnd, secondStart, secondEnd) {
  return firstStart < secondEnd && secondStart < firstEnd;
}

export function validateScheduleCandidate(
  candidate,
  events = [],
  excludedEventId = null,
  minDurationMinutes = 15,
) {
  const start = parseTimeToMinutes(candidate?.start);
  const end = parseTimeToMinutes(candidate?.end);

  if (start === null || end === null) {
    return "Укажите время в формате ЧЧ:ММ.";
  }

  if (end <= start) {
    return "Окончание должно быть позже начала.";
  }

  if (end - start < minDurationMinutes) {
    return `Минимальная длительность: ${minDurationMinutes} мин.`;
  }

  const candidateGroup = candidate.parallelGroup || "A";
  const normalizedEvents = safeArray(events).map((event, index) =>
    normalizeScheduleEvent(event, index),
  );
  const conflict = normalizedEvents.find((event) => {
    if (event.id === excludedEventId || (event.parallelGroup || "A") !== candidateGroup) {
      return false;
    }

    return rangesOverlap(
      start,
      end,
      getEventStartMinutes(event),
      getEventEndMinutes(event, minDurationMinutes),
    );
  });

  if (conflict) {
    return `Конфликт с мероприятием "${conflict.title || "Без названия"}" в этом потоке.`;
  }

  return "";
}

export function createEventTimePatch(event, start, end, parallelGroup) {
  return {
    ...event,
    start: formatMinutesAsTime(start),
    end: formatMinutesAsTime(end),
    parallelGroup,
  };
}

export function createProgramDayFormModel(dayDraft = {}) {
  const dateValue = dayDraft?.dateValue || "";
  const isAutoDateLabel = !isCustomProgramDayDateLabel(dateValue, dayDraft?.dateLabel || "");

  return {
    isAutoDateLabel,
    form: {
      label: dayDraft?.label || "День",
      dateLabel: isAutoDateLabel ? formatProgramDayDateLabel(dateValue) : dayDraft?.dateLabel || "",
      dateValue,
    },
  };
}

export function applyProgramDayDateValue(form, nextDateValue, isAutoDateLabel) {
  return {
    ...form,
    dateValue: nextDateValue,
    dateLabel: isAutoDateLabel ? formatProgramDayDateLabel(nextDateValue) : form.dateLabel,
  };
}

export { formatProgramDayDateLabel };

export const ORGANIZER_DATA_STATE_COPY = {
  unpublished: {
    title: "Программа еще не опубликована",
    description: "Сводные графики появятся после публикации программы и первых ответов участников.",
  },
  published_empty: {
    title: "В опубликованной программе пока нет событий",
    description:
      "Сначала нужен календарь событий, потом аналитика сможет собрать рабочую картину по заезду.",
  },
  no_members: {
    title: "В заезде пока нет участников",
    description: "Назначьте участников в группы, чтобы увидеть сравнение групп и сигналы внимания.",
  },
  no_responses: {
    title: "Ответов участников пока нет",
    description:
      "Графики останутся честно пустыми, пока в дневниках и рефлексии не появятся первые записи.",
  },
};

export const ORGANIZER_STATE_SEGMENTS = [
  { id: "low", label: "Низкий ресурс", color: "#6e98d8" },
  { id: "mid", label: "Баланс", color: "#7dae42" },
  { id: "high", label: "Напряжение", color: "#d97757" },
];

export function buildGroupDraftMap(groups = []) {
  return safeArray(groups).reduce((accumulator, group) => {
    accumulator[group.id] = {
      name: group.name || "",
      description: group.description || "",
      curatorId: group.curatorId || "",
    };
    return accumulator;
  }, {});
}

export function buildGroupTrendSeries(groupPulse = [], eventPulse = []) {
  const safeEvents = safeArray(eventPulse);
  return safeArray(groupPulse).map((group, index) => ({
    id: group.id,
    label: group.name,
    color: chartPalette[index % chartPalette.length],
    data: safeEvents.map((event, eventIndex) => ({
      id: `${group.id}:${event.id}`,
      label: `${eventIndex + 1}`,
      value: Number.isFinite(Number(group.trajectory?.[eventIndex]))
        ? Number(group.trajectory[eventIndex])
        : 0,
      meta: {
        flag: Number.isFinite(Number(group.trajectory?.[eventIndex])) ? "" : "·",
      },
    })),
  }));
}

export function buildGroupDistributionRows(groupPulse = []) {
  return safeArray(groupPulse).map((group) => {
    const distribution = safeArray(group.stateDistribution);
    const low = distribution
      .filter((segment) => Number(segment.level) <= 2)
      .reduce((sum, segment) => sum + Number(segment.count || 0), 0);
    const mid = distribution
      .filter((segment) => Number(segment.level) === 3)
      .reduce((sum, segment) => sum + Number(segment.count || 0), 0);
    const high = distribution
      .filter((segment) => Number(segment.level) >= 4)
      .reduce((sum, segment) => sum + Number(segment.count || 0), 0);
    const total = low + mid + high;

    return {
      id: group.id,
      label: group.name,
      total,
      segments: ORGANIZER_STATE_SEGMENTS.map((segment) => ({
        ...segment,
        value: segment.id === "low" ? low : segment.id === "mid" ? mid : high,
      })).filter((segment) => segment.value > 0),
    };
  });
}

export function buildOrganizerEventDeltaRows(eventPulse = []) {
  return safeArray(eventPulse)
    .filter((event) => Number.isFinite(Number(event.deltaFromPrevious)))
    .map((event, index) => ({
      id: event.id,
      label: `${index + 1}`,
      value: Number(event.deltaFromPrevious),
      color: Number(event.deltaFromPrevious) >= 0 ? "#7dae42" : "#d97757",
      meta: {
        title: event.title,
      },
    }));
}

export function buildOrganizerScatterData(participantScatter = [], groups = []) {
  const colorByGroupId = safeArray(groups).reduce((accumulator, group, index) => {
    accumulator[group.id] = chartPalette[index % chartPalette.length];
    return accumulator;
  }, {});

  return safeArray(participantScatter)
    .filter((participant) => Number.isFinite(Number(participant.avgActivation)))
    .map((participant) => ({
      ...participant,
      x: Number(participant.avgActivation),
      y: Number.isFinite(Number(participant.amplitude)) ? Number(participant.amplitude) : 0,
      shortLabel: participant.shortLabel || participant.label?.slice(0, 2)?.toUpperCase() || "У",
      color: colorByGroupId[participant.groupId] || chartPalette[0],
      size: Math.max(8, Number(participant.completion || participant.size || 0)),
    }));
}

export function buildRoster(items = [], selectedGroupId = "all", query = "") {
  const normalizedQuery = String(query || "")
    .trim()
    .toLowerCase();

  return safeArray(items).filter((participant) => {
    const matchesGroup = selectedGroupId === "all" || participant.groupId === selectedGroupId;
    const matchesQuery =
      !normalizedQuery ||
      String(participant.fullName || "")
        .toLowerCase()
        .includes(normalizedQuery) ||
      String(participant.groupLabel || "")
        .toLowerCase()
        .includes(normalizedQuery);

    return matchesGroup && matchesQuery;
  });
}

export function getOrganizerDataStateCard(dataState) {
  return ORGANIZER_DATA_STATE_COPY[dataState] || null;
}
