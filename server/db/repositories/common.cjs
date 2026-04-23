const { randomUUID } = require("node:crypto");
const { query } = require("../postgres.cjs");

const roleLabels = {
  participant: "Участник",
  curator: "Куратор",
  organizer: "Организатор",
  admin: "Администратор",
};

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function createId(prefix) {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

function formatDateObject(value) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoDateParts(value) {
  const match = String(value || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
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

function formatIsoDateParts(parts) {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function toIsoDate(value) {
  if (value === "" || value === undefined || value === null) {
    return "";
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : formatDateObject(value);
  }

  const stringValue = String(value).trim();
  if (!stringValue) {
    return "";
  }

  const isoMatch = stringValue.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) {
    return isoMatch[1];
  }

  if (!/\b\d{4}\b/.test(stringValue)) {
    return "";
  }

  const parsed = new Date(stringValue);
  return Number.isNaN(parsed.getTime()) ? "" : formatDateObject(parsed);
}

function normalizeDateInput(value) {
  return toIsoDate(value) || null;
}

function getIsoDateDayStamp(value) {
  const parts = parseIsoDateParts(value);
  if (!parts) {
    return null;
  }

  return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / 86400000);
}

function getTodayIsoDate() {
  return formatDateObject(new Date());
}

function addDaysToIsoDate(value, days) {
  const stamp = getIsoDateDayStamp(value);
  if (stamp === null) {
    return "";
  }

  const nextDate = new Date((stamp + Number(days || 0)) * 86400000);
  return formatIsoDateParts({
    year: nextDate.getUTCFullYear(),
    month: nextDate.getUTCMonth() + 1,
    day: nextDate.getUTCDate(),
  });
}

function formatProgramDayDateLabel(value) {
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

function selectClosestProgramDay(days, todayIso = getTodayIsoDate()) {
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

  let bestMatch = null;
  for (const day of safeDays) {
    const stamp = getIsoDateDayStamp(day?.dateValue);
    if (stamp === null) {
      continue;
    }

    const distance = Math.abs(stamp - todayStamp);
    const isPast = stamp < todayStamp;

    if (!bestMatch || distance < bestMatch.distance || (distance === bestMatch.distance && isPast && !bestMatch.isPast)) {
      bestMatch = { day, distance, isPast };
    }
  }

  return bestMatch?.day || safeDays[0];
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

function toPublicUser(row) {
  if (!row) {
    return null;
  }

  const assignments = (Array.isArray(row.assignments) ? row.assignments : row.session_id ? [row] : [])
    .map((assignment) => {
      const role = assignment.effective_role || assignment.role || assignment.assignment_role || row.role;
      const sessionId = assignment.session_id ?? assignment.sessionId ?? null;

      if (!sessionId) {
        return null;
      }

      return {
        sessionId,
        sessionLabel: assignment.session_name ?? assignment.sessionLabel ?? null,
        groupId: assignment.group_id ?? assignment.groupId ?? null,
        groupLabel: assignment.group_name ?? assignment.groupLabel ?? null,
        role,
        roleLabel: roleLabels[role] || role,
        status: assignment.assignment_status ?? assignment.status ?? "active",
      };
    })
    .filter(Boolean);
  const role = row.effective_role || row.role;

  return {
    id: row.id,
    fullName: row.full_name,
    role,
    baseRole: row.role,
    roleLabel: roleLabels[role] || row.role,
    sessionId: row.session_id ?? null,
    sessionLabel: row.session_name ?? null,
    groupId: row.group_id ?? null,
    groupLabel: row.group_name ?? null,
    assignments,
    age: row.age ?? null,
    gender: row.gender ?? null,
    status: row.status ?? "active",
    emotionalProfile: row.meta?.emotionalProfile ?? null,
    identityStatus: row.meta?.identityStatus ?? null,
  };
}

async function getStateScale(sessionId) {
  const result = await query(
    `
      select id, label, short_label, icon, level, color, surface, text_color
      from state_scale_levels
      where enabled = true and (session_id = $1 or session_id is null)
      order by level
    `,
    [sessionId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    label: row.label,
    shortLabel: row.short_label || row.label,
    icon: row.icon,
    level: row.level,
    color: row.color,
    surface: row.surface,
    textColor: row.text_color,
  }));
}

async function getStateById(stateId) {
  const result = await query(
    `
      select id, level
      from state_scale_levels
      where id = $1
      limit 1
    `,
    [stateId],
  );

  return result.rows[0] || null;
}

function getSessionInfo(row) {
  const settings = row?.settings || {};

  return {
    id: row.id,
    name: row.name,
    cycle: row.cycle,
    dateLabel: row.date_label,
    location: row.location,
    description: row.description,
    editWindow: row.edit_window || "Редактирование до 03:00 следующего дня",
    registration: {
      status: row.registration_status || "draft",
      startsAt: row.registration_starts_at || null,
      endsAt: row.registration_ends_at || null,
      capacity: row.registration_capacity ?? null,
      policy: row.registration_policy || {},
    },
    scaleNote: settings.scaleNote || "Шкала активации: от апатии до паники",
    aiPolicy: settings.aiPolicy || "ИИ-аналитика без лишних персональных данных",
  };
}

async function getSession(sessionId) {
  const result = await query("select * from sessions where id = $1 limit 1", [sessionId]);
  return result.rows[0] || null;
}

module.exports = {
  addDaysToIsoDate,
  cloneJson,
  createId,
  formatProgramDayDateLabel,
  getSession,
  getSessionInfo,
  getIsoDateDayStamp,
  getStateById,
  getStateScale,
  getTodayIsoDate,
  normalizeDateInput,
  normalizeList,
  roleLabels,
  selectClosestProgramDay,
  toIsoDate,
  toPublicUser,
};
