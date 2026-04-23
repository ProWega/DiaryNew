const { query } = require("../postgres.cjs");
const {
  addDaysToIsoDate,
  formatProgramDayDateLabel,
  getIsoDateDayStamp,
  toIsoDate,
} = require("./common.cjs");

const DEFAULT_FLOW_ORDER = ["A"];
const DEFAULT_FLOW_META = { A: { label: "A", track: "" } };

function cloneFlowOrder(value) {
  return Array.isArray(value) && value.length ? [...value] : [...DEFAULT_FLOW_ORDER];
}

function cloneFlowMeta(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return JSON.parse(JSON.stringify(DEFAULT_FLOW_META));
  }

  return JSON.parse(JSON.stringify(value));
}

function getProgramDayLabel(dayNumber) {
  return `День ${dayNumber}`;
}

function getProgramDayDateValues(startDate, endDate) {
  const normalizedStart = toIsoDate(startDate);
  const normalizedEnd = toIsoDate(endDate) || normalizedStart;
  const startStamp = getIsoDateDayStamp(normalizedStart);
  const endStamp = getIsoDateDayStamp(normalizedEnd);

  if (startStamp === null) {
    return [];
  }

  if (endStamp === null || endStamp < startStamp) {
    return [normalizedStart];
  }

  const result = [];
  let nextDateValue = normalizedStart;

  for (let stamp = startStamp; stamp <= endStamp; stamp += 1) {
    result.push(nextDateValue);
    nextDateValue = addDaysToIsoDate(nextDateValue, 1);
  }

  return result;
}

function normalizeDayRow(day) {
  return {
    ...day,
    label: String(day?.label || "").trim(),
    dateLabel: String(day?.date_label ?? day?.dateLabel ?? "").trim(),
    dateValue: toIsoDate(day?.date_value ?? day?.dateValue),
    dayNumber: Number(day?.day_number ?? day?.dayNumber ?? 0) || 0,
    flowOrder: cloneFlowOrder(day?.flow_order ?? day?.flowOrder),
    flowMeta: cloneFlowMeta(day?.flow_meta ?? day?.flowMeta),
  };
}

function isBrokenRangeLabel(dateLabel, sessionDateLabel) {
  const trimmedDateLabel = String(dateLabel || "").trim();
  const trimmedSessionLabel = String(sessionDateLabel || "").trim();
  return Boolean(trimmedDateLabel && trimmedSessionLabel && trimmedDateLabel === trimmedSessionLabel);
}

function isAutoCompatibleDateLabel(dateLabel, expectedDateValue, sessionDateLabel) {
  const trimmedDateLabel = String(dateLabel || "").trim();
  if (!trimmedDateLabel) {
    return true;
  }

  if (isBrokenRangeLabel(trimmedDateLabel, sessionDateLabel)) {
    return true;
  }

  const autoLabel = formatProgramDayDateLabel(expectedDateValue);
  return autoLabel ? trimmedDateLabel === autoLabel : false;
}

function canExpandLegacyBootstrap(days, expectedDateValues, sessionDateLabel, eventsByDay) {
  if (expectedDateValues.length <= 1 || days.length !== 1) {
    return false;
  }

  const [firstDay] = days;
  const expectedFirstDate = expectedDateValues[0];
  const eventCount = Array.isArray(eventsByDay.get(firstDay.id)) ? eventsByDay.get(firstDay.id).length : 0;

  if (eventCount > 0) {
    return false;
  }

  if (firstDay.label && firstDay.label !== getProgramDayLabel(1)) {
    return false;
  }

  if (firstDay.dateValue && firstDay.dateValue !== expectedFirstDate) {
    return false;
  }

  return isAutoCompatibleDateLabel(firstDay.dateLabel, expectedFirstDate, sessionDateLabel);
}

function repairProgramDayRows({ program, sessionDateLabel, days, eventsByDay = new Map() }) {
  const normalizedDays = [...days].map(normalizeDayRow).sort(
    (first, second) =>
      first.dayNumber - second.dayNumber ||
      String(first.dateValue || "").localeCompare(String(second.dateValue || "")) ||
      String(first.id || "").localeCompare(String(second.id || "")),
  );
  const expectedDateValues = getProgramDayDateValues(program?.start_date ?? program?.startDate, program?.end_date ?? program?.endDate);
  let changed = false;
  let workingDays = normalizedDays;

  if (canExpandLegacyBootstrap(workingDays, expectedDateValues, sessionDateLabel, eventsByDay)) {
    const firstDay = workingDays[0];
    workingDays = expectedDateValues.map((dateValue, index) => ({
      ...firstDay,
      id: index === 0 ? firstDay.id : `day-${program.id}-${index + 1}`,
      label: getProgramDayLabel(index + 1),
      dateLabel: formatProgramDayDateLabel(dateValue),
      dateValue,
      dayNumber: index + 1,
      flowOrder: index === 0 ? cloneFlowOrder(firstDay.flowOrder) : [...DEFAULT_FLOW_ORDER],
      flowMeta: index === 0 ? cloneFlowMeta(firstDay.flowMeta) : cloneFlowMeta(DEFAULT_FLOW_META),
    }));
    changed = true;
  }

  const repairedDays = workingDays.map((day, index) => {
    const expectedDateValue = expectedDateValues[index] || day.dateValue || "";
    const repaired = {
      ...day,
      label: day.label || getProgramDayLabel(index + 1),
      dayNumber: index + 1,
      dateValue: day.dateValue,
      dateLabel: day.dateLabel,
      flowOrder: cloneFlowOrder(day.flowOrder),
      flowMeta: cloneFlowMeta(day.flowMeta),
    };

    if (!repaired.dateValue && expectedDateValue && isAutoCompatibleDateLabel(repaired.dateLabel, expectedDateValue, sessionDateLabel)) {
      repaired.dateValue = expectedDateValue;
    }

    if (repaired.dateValue && (!repaired.dateLabel || isBrokenRangeLabel(repaired.dateLabel, sessionDateLabel))) {
      repaired.dateLabel = formatProgramDayDateLabel(repaired.dateValue);
    }

    if (
      repaired.label !== day.label ||
      repaired.dayNumber !== day.dayNumber ||
      repaired.dateValue !== day.dateValue ||
      repaired.dateLabel !== day.dateLabel
    ) {
      changed = true;
    }

    return repaired;
  });

  return {
    changed,
    days: repairedDays,
  };
}

async function persistProgramDayRows(sessionId, programId, days) {
  for (const [index, day] of days.entries()) {
    await query(
      `
        insert into program_days (id, program_id, session_id, day_number, label, date_label, date_value, flow_order, flow_meta, updated_at)
        values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,now())
        on conflict (id)
        do update set
          day_number = excluded.day_number,
          label = excluded.label,
          date_label = excluded.date_label,
          date_value = excluded.date_value,
          flow_order = excluded.flow_order,
          flow_meta = excluded.flow_meta,
          updated_at = now()
      `,
      [
        day.id,
        programId,
        sessionId,
        index + 1,
        day.label || getProgramDayLabel(index + 1),
        day.dateLabel || "",
        day.dateValue || null,
        JSON.stringify(cloneFlowOrder(day.flowOrder)),
        JSON.stringify(cloneFlowMeta(day.flowMeta)),
      ],
    );
  }
}

async function repairProgramDaysForProgram({ sessionId, sessionDateLabel, program, days, eventsByDay = new Map() }) {
  const repairResult = repairProgramDayRows({
    program,
    sessionDateLabel,
    days,
    eventsByDay,
  });

  if (repairResult.changed) {
    await persistProgramDayRows(sessionId, program.id, repairResult.days);
  }

  return repairResult.days;
}

function buildBootstrapProgramDays({ programId, sessionId, startDate, endDate, firstDayId }) {
  const expectedDateValues = getProgramDayDateValues(startDate, endDate);

  if (!expectedDateValues.length) {
    return [
      {
        id: firstDayId || `day-${programId}-1`,
        programId,
        sessionId,
        dayNumber: 1,
        label: getProgramDayLabel(1),
        dateLabel: "",
        dateValue: null,
        flowOrder: [...DEFAULT_FLOW_ORDER],
        flowMeta: cloneFlowMeta(DEFAULT_FLOW_META),
      },
    ];
  }

  return expectedDateValues.map((dateValue, index) => ({
    id: index === 0 ? firstDayId || `day-${programId}-1` : `day-${programId}-${index + 1}`,
    programId,
    sessionId,
    dayNumber: index + 1,
    label: getProgramDayLabel(index + 1),
    dateLabel: formatProgramDayDateLabel(dateValue),
    dateValue,
    flowOrder: [...DEFAULT_FLOW_ORDER],
    flowMeta: cloneFlowMeta(DEFAULT_FLOW_META),
  }));
}

module.exports = {
  buildBootstrapProgramDays,
  getProgramDayDateValues,
  getProgramDayLabel,
  repairProgramDaysForProgram,
};
