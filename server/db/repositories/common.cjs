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

  return {
    id: row.id,
    fullName: row.full_name,
    role: row.effective_role || row.role,
    roleLabel: roleLabels[row.effective_role || row.role] || row.role,
    sessionId: row.session_id ?? null,
    sessionLabel: row.session_name ?? null,
    groupId: row.group_id ?? null,
    groupLabel: row.group_name ?? null,
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
  cloneJson,
  createId,
  getSession,
  getSessionInfo,
  getStateById,
  getStateScale,
  normalizeList,
  roleLabels,
  toPublicUser,
};
