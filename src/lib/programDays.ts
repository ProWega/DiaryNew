interface DateParts {
  year: number;
  month: number;
  day: number;
}

interface HasDateValue {
  dateValue?: string | null;
}

interface ProgramLike {
  days?: HasDateValue[];
  eventContext?: {
    startDate?: string | null;
  };
}

function parseIsoDateParts(value: unknown): DateParts | null {
  const match = String(value || "")
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (!year || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  return { year, month, day };
}

function formatIsoDateFromParts({ year, month, day }: DateParts): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function getIsoDateDayStamp(value: unknown): number | null {
  const parts = parseIsoDateParts(value);
  if (!parts) {
    return null;
  }

  return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / 86400000);
}

export function getLocalTodayIsoDate(): string {
  const now = new Date();
  return formatIsoDateFromParts({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  });
}

export function addDaysToIsoDate(value: unknown, days: unknown): string {
  const stamp = getIsoDateDayStamp(value);
  if (stamp === null) {
    return "";
  }

  const nextDate = new Date((stamp + Number(days || 0)) * 86400000);
  return formatIsoDateFromParts({
    year: nextDate.getUTCFullYear(),
    month: nextDate.getUTCMonth() + 1,
    day: nextDate.getUTCDate(),
  });
}

export function formatProgramDayDateLabel(value: unknown): string {
  const parts = parseIsoDateParts(value);
  if (!parts) {
    return "";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(parts.year, parts.month - 1, parts.day)));
}

export function isCustomProgramDayDateLabel(dateValue: unknown, dateLabel: unknown): boolean {
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

export function createProgramDayDraft(
  program: ProgramLike | null | undefined,
  todayIso = getLocalTodayIsoDate(),
): { label: string; dateLabel: string; dateValue: string } {
  const days = Array.isArray(program?.days) ? program.days : [];
  let nextDateValue = "";

  for (let index = days.length - 1; index >= 0; index -= 1) {
    const day = days[index];
    if (getIsoDateDayStamp(day?.dateValue) !== null) {
      nextDateValue = addDaysToIsoDate(day.dateValue, 1);
      break;
    }
  }

  if (!nextDateValue && getIsoDateDayStamp(program?.eventContext?.startDate) !== null) {
    nextDateValue = addDaysToIsoDate(program?.eventContext?.startDate, days.length);
  }

  if (!nextDateValue) {
    nextDateValue = todayIso;
  }

  return {
    label: `День ${(program?.days?.length || 0) + 1}`,
    dateLabel: formatProgramDayDateLabel(nextDateValue),
    dateValue: nextDateValue,
  };
}

export function selectClosestProgramDay<T extends HasDateValue>(
  days: T[],
  todayIso = getLocalTodayIsoDate(),
): T | null {
  const safeDays = Array.isArray(days) ? days : [];
  if (!safeDays.length) {
    return null;
  }

  const todayStamp = getIsoDateDayStamp(todayIso);
  if (todayStamp === null) {
    return safeDays[0];
  }

  const exactMatch = safeDays.find((day) => getIsoDateDayStamp(day?.dateValue) === todayStamp);
  if (exactMatch) {
    return exactMatch;
  }

  let bestMatch: { day: T; distance: number; isPast: boolean } | null = null;

  for (const day of safeDays) {
    const stamp = getIsoDateDayStamp(day?.dateValue);
    if (stamp === null) {
      continue;
    }

    const distance = Math.abs(stamp - todayStamp);
    const isPast = stamp < todayStamp;

    if (!bestMatch) {
      bestMatch = { day, distance, isPast };
      continue;
    }

    if (distance < bestMatch.distance) {
      bestMatch = { day, distance, isPast };
      continue;
    }

    if (distance === bestMatch.distance && isPast && !bestMatch.isPast) {
      bestMatch = { day, distance, isPast };
    }
  }

  return bestMatch?.day ?? safeDays[0];
}
