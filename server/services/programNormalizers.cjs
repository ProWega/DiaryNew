"use strict";

const { randomUUID } = require("node:crypto");
const {
  addDaysToIsoDate,
  formatProgramDayDateLabel,
  getIsoDateDayStamp,
  getTodayIsoDate,
} = require("../db/repositories/common.cjs");
const { getParticipantEventAccessSettings } = require("../db/repositories/eventAccess.cjs");

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

function normalizeReflectionQuestions(value = []) {
  const questions = Array.isArray(value) ? value : [];
  return questions
    .map((question) => {
      const text = String(question?.text || question?.title || "").trim();
      if (!text) {
        return null;
      }

      return {
        id: String(question?.id || `reflection-question-${randomUUID().slice(0, 8)}`).trim(),
        text,
        required: Boolean(question?.required),
      };
    })
    .filter(Boolean);
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
    reflectionQuestions: normalizeReflectionQuestions(body.reflectionQuestions),
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

function normalizeOrganizerSessionSettingsPatch(body = {}) {
  return getParticipantEventAccessSettings(body);
}

function hasOwnField(body, key) {
  return Object.prototype.hasOwnProperty.call(body || {}, key);
}

function isCustomProgramDayDateLabel(dateValue, dateLabel) {
  const trimmedLabel = String(dateLabel || "").trim();
  if (!trimmedLabel) {
    return false;
  }

  const autoLabel = formatProgramDayDateLabel(dateValue);
  if (!autoLabel) {
    return true;
  }

  return trimmedLabel !== autoLabel;
}

function getAutoProgramDayDateValue(program, { currentDay = null } = {}) {
  const safeDays = Array.isArray(program?.days) ? program.days : [];
  const currentDayIndex = currentDay ? safeDays.findIndex((day) => day.id === currentDay.id) : -1;
  const previousDays =
    currentDayIndex >= 0
      ? safeDays.slice(0, currentDayIndex)
      : currentDay
        ? safeDays.filter((day) => day.id !== currentDay.id)
        : safeDays;

  for (let index = previousDays.length - 1; index >= 0; index -= 1) {
    const dateValue = previousDays[index]?.dateValue;
    if (getIsoDateDayStamp(dateValue) !== null) {
      return addDaysToIsoDate(dateValue, 1);
    }
  }

  if (getIsoDateDayStamp(program?.eventContext?.startDate) !== null) {
    const offset = currentDay
      ? Math.max(
          safeDays.findIndex((day) => day.id === currentDay.id),
          0,
        )
      : safeDays.length;
    return addDaysToIsoDate(program.eventContext.startDate, offset);
  }

  return getTodayIsoDate();
}

function finalizeDayPatch(program, body = {}, currentDay = null) {
  const explicitDateValue = String(body.dateValue ?? body.date ?? "").trim();
  const currentDateValue = String(currentDay?.dateValue || "").trim();
  let dateValue = explicitDateValue;

  if (!dateValue) {
    dateValue = currentDateValue || getAutoProgramDayDateValue(program, { currentDay });
  }

  const hasExplicitDateLabel = hasOwnField(body, "dateLabel");
  const explicitDateLabel = String(body.dateLabel || "");
  let dateLabel = "";

  if (hasExplicitDateLabel) {
    dateLabel = explicitDateLabel.trim() ? explicitDateLabel : formatProgramDayDateLabel(dateValue);
  } else if (currentDay) {
    const currentDateLabel = String(currentDay.dateLabel || "");
    const shouldRegenerateLabel =
      !currentDateLabel.trim() ||
      (!isCustomProgramDayDateLabel(currentDateValue, currentDateLabel) &&
        currentDateValue !== dateValue);
    dateLabel = shouldRegenerateLabel ? formatProgramDayDateLabel(dateValue) : currentDateLabel;
  } else {
    dateLabel = formatProgramDayDateLabel(dateValue);
  }

  return {
    label: String(body.label || currentDay?.label || "День").trim() || "День",
    dateLabel,
    dateValue,
    reflectionQuestions: hasOwnField(body, "reflectionQuestions")
      ? normalizeReflectionQuestions(body.reflectionQuestions)
      : normalizeReflectionQuestions(currentDay?.reflectionQuestions),
  };
}

function pickOrganizerSessionPayload(body = {}) {
  const allowedKeys = [
    "name",
    "description",
    "startDate",
    "endDate",
    "registrationStartsAt",
    "registrationEndsAt",
    "registrationCapacity",
    "registrationStatus",
  ];
  return Object.fromEntries(
    allowedKeys
      .filter((key) => Object.prototype.hasOwnProperty.call(body, key))
      .map((key) => [key, body[key]]),
  );
}

module.exports = {
  normalizeList,
  toSlugFragment,
  createSpeakerId,
  normalizeProgramStatus,
  getDefaultEventTypes,
  normalizeReflectionQuestions,
  normalizeEventPatch,
  normalizeProgramPatch,
  normalizeOrganizerSessionSettingsPatch,
  hasOwnField,
  isCustomProgramDayDateLabel,
  getAutoProgramDayDateValue,
  finalizeDayPatch,
  pickOrganizerSessionPayload,
};
