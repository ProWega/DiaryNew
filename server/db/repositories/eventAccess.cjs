const PARTICIPANT_EVENT_ACCESS_MODES = {
  ALWAYS: "always",
  FROM_START_TIME: "from_start_time",
};
const MOSCOW_UTC_OFFSET_MINUTES = 3 * 60;

function normalizeParticipantEventAccessMode(value) {
  return value === PARTICIPANT_EVENT_ACCESS_MODES.FROM_START_TIME
    ? PARTICIPANT_EVENT_ACCESS_MODES.FROM_START_TIME
    : PARTICIPANT_EVENT_ACCESS_MODES.ALWAYS;
}

function getParticipantEventAccessSettings(settings = {}) {
  const safeSettings =
    settings && typeof settings === "object" && !Array.isArray(settings) ? settings : {};

  return {
    participantEventAccessMode: normalizeParticipantEventAccessMode(
      safeSettings.participantEventAccessMode,
    ),
  };
}

function getDatePart(value) {
  if (!value) {
    return "";
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, "0");
    const day = String(value.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
}

function parseProgramEventStart(dateValue, startTime) {
  const datePart = getDatePart(dateValue);
  const timeMatch = String(startTime || "").match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);

  if (!datePart || !timeMatch) {
    return null;
  }

  const [, year, month, day] = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/) || [];
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const second = Number(timeMatch[3] || 0);

  if (
    !year ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    return null;
  }

  const start = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day), hour, minute, second) -
      MOSCOW_UTC_OFFSET_MINUTES * 60 * 1000,
  );
  return Number.isNaN(start.getTime()) ? null : start;
}

function computeParticipantEventAccess(event = {}, settings = {}, now = new Date()) {
  const { participantEventAccessMode } = getParticipantEventAccessSettings(settings);

  if (participantEventAccessMode !== PARTICIPANT_EVENT_ACCESS_MODES.FROM_START_TIME) {
    return {
      locked: false,
      mode: participantEventAccessMode,
    };
  }

  const dateValue = event.date_value ?? event.dateValue;
  const startTime = event.start_time ?? event.start;

  if (!getDatePart(dateValue)) {
    return {
      locked: true,
      mode: participantEventAccessMode,
      reason: "Для события не задана дата дня программы.",
    };
  }

  const availableAt = parseProgramEventStart(dateValue, startTime);

  if (!availableAt) {
    return {
      locked: true,
      mode: participantEventAccessMode,
      reason: "Для события не задано время начала.",
    };
  }

  if (now.getTime() < availableAt.getTime()) {
    return {
      locked: true,
      mode: participantEventAccessMode,
      availableAt: availableAt.toISOString(),
      reason: "Оценка откроется в момент начала события.",
    };
  }

  return {
    locked: false,
    mode: participantEventAccessMode,
    availableAt: availableAt.toISOString(),
  };
}

module.exports = {
  PARTICIPANT_EVENT_ACCESS_MODES,
  computeParticipantEventAccess,
  getParticipantEventAccessSettings,
  normalizeParticipantEventAccessMode,
};
