"use strict";

/**
 * Curator narrative brief — методическая «записка к вечерней рефлексии».
 *
 * Phase 4.1: deterministic rules engine. LLM enrichment is a Phase 5 follow-up.
 * The output strings comply with the methodology glossary (no «риск/уровень/
 * прогресс/диагноз/статус/метрика» on the curator surface — see
 * docs/architecture/methodology-mapping.md §1).
 *
 * Two exports:
 *  - buildNarrativeBrief(scope) — pure function for unit tests
 *  - getCuratorNarrativeBrief({viewerId, sessionId, groupId, dayId}) — DB-driven
 *    wrapper that applies privacy filter and joins methodology fields.
 */

const { query } = require("../db/postgres.cjs");
const { applyToList } = require("../lib/privacy.cjs");
const { ensureCuratorAccess } = require("../db/repositories/analyticsStore.cjs");

// 7-id stateId → 5 methodology labels (mirrors src/data/methodology.ts).
const STATE_TO_METHODOLOGY = Object.freeze({
  apathy: "silence",
  passive: "silence",
  relaxed: "tuning",
  balance: "harmony",
  engaged: "lift",
  overstimulated: "breakdown",
  panic: "breakdown",
});

const METHODOLOGY_LABEL_RU = Object.freeze({
  silence: "Тишина",
  tuning: "Настройка",
  harmony: "Лад",
  lift: "Подъём",
  breakdown: "Сбой",
});

const JOURNEY_STAGES = Object.freeze(["search", "verification", "support", "transmission"]);

const CONVERSATION_POINT_LIMIT = 5;
const EVENT_QUOTE_LIMIT = 3;
const SHIFT_DOWN_FROM = new Set(["tuning", "harmony", "lift"]);
const SHIFT_DOWN_TO = new Set(["breakdown"]);

function methodologyOf(stateId) {
  return STATE_TO_METHODOLOGY[stateId] || null;
}

function pickDominant(counts) {
  let topKey = null;
  let topCount = 0;
  for (const [key, value] of Object.entries(counts)) {
    if (value > topCount) {
      topCount = value;
      topKey = key;
    }
  }
  return topKey;
}

function buildPicture({ members, todayEntries }) {
  const totalParticipants = members.length;
  const userIdsToday = new Set(
    todayEntries.map((entry) => entry.userId).filter((id) => id != null),
  );
  const counts = { silence: 0, tuning: 0, harmony: 0, lift: 0, breakdown: 0 };
  for (const entry of todayEntries) {
    const label = methodologyOf(entry.stateId);
    if (label) counts[label] += 1;
  }
  const dominantState = pickDominant(counts);
  const carefulCount = members.filter((member) => member.isCarefulMode).length;

  return {
    totalParticipants,
    respondedToday: userIdsToday.size,
    dominantState,
    dominantStateLabel: dominantState ? METHODOLOGY_LABEL_RU[dominantState] : null,
    carefulCount,
  };
}

function buildStageResonance({ members }) {
  const counts = { search: 0, verification: 0, support: 0, transmission: 0, careful: 0 };
  for (const member of members) {
    if (JOURNEY_STAGES.includes(member.journeyStage)) {
      counts[member.journeyStage] += 1;
    }
    if (member.isCarefulMode) {
      counts.careful += 1;
    }
  }
  return counts;
}

function findFirstEntryByUser(entries, userId) {
  if (userId == null) return null;
  return entries.find((entry) => entry.userId === userId) || null;
}

function buildConversationPoints({ members, todayEntries, yesterdayEntries }) {
  const points = [];
  const seenUserIds = new Set();

  function add(point) {
    if (!point.participantId || seenUserIds.has(point.participantId)) return;
    seenUserIds.add(point.participantId);
    points.push(point);
  }

  // Rule 1 (highest priority): участник сам обозначил, что сейчас хочется
  // бережности — стоит подойти деликатно.
  for (const member of members) {
    if (member.isCarefulMode) {
      add({
        participantId: member.id,
        displayName: member.fullName || "Участник без имени",
        reason: "careful_mode",
        note: "Сейчас «бережно» — стоит подойти деликатно, без давления.",
      });
    }
  }

  // Rule 2: резкая динамика — вчера был в одной из «средних» групп (Настройка/Лад/
  // Подъём) и сегодня в Сбое. Без слов «риск» / «срыв».
  for (const member of members) {
    const todayEntry = findFirstEntryByUser(todayEntries, member.id);
    const yesterdayEntry = findFirstEntryByUser(yesterdayEntries, member.id);
    if (!todayEntry || !yesterdayEntry) continue;
    const todayLabel = methodologyOf(todayEntry.stateId);
    const yesterdayLabel = methodologyOf(yesterdayEntry.stateId);
    if (SHIFT_DOWN_FROM.has(yesterdayLabel) && SHIFT_DOWN_TO.has(todayLabel)) {
      add({
        participantId: member.id,
        displayName: member.fullName || "Участник без имени",
        reason: "shift_down",
        note: `Вчера в ${METHODOLOGY_LABEL_RU[yesterdayLabel]}, сегодня в ${METHODOLOGY_LABEL_RU[todayLabel]}.`,
      });
    }
  }

  // Rule 3: затяжная Тишина — два дня подряд в группе silence. Подойти можно
  // мягко, без давления.
  for (const member of members) {
    const todayEntry = findFirstEntryByUser(todayEntries, member.id);
    const yesterdayEntry = findFirstEntryByUser(yesterdayEntries, member.id);
    if (!todayEntry || !yesterdayEntry) continue;
    if (
      methodologyOf(todayEntry.stateId) === "silence" &&
      methodologyOf(yesterdayEntry.stateId) === "silence"
    ) {
      add({
        participantId: member.id,
        displayName: member.fullName || "Участник без имени",
        reason: "silence_streak",
        note: "Второй день в Тишине — может быть, стоит просто побыть рядом.",
      });
    }
  }

  return points.slice(0, CONVERSATION_POINT_LIMIT);
}

function buildEventList({ events, todayEntries }) {
  return events.map((event) => {
    const eventEntries = todayEntries.filter((entry) => entry.eventId === event.id);
    const quotes = eventEntries
      .filter((entry) => !entry.isAnonymous && entry.userId != null)
      .map((entry) => (entry.comment || "").trim())
      .filter(Boolean)
      .slice(0, EVENT_QUOTE_LIMIT);
    return {
      id: event.id,
      title: event.title,
      responseCount: eventEntries.length,
      quotes,
    };
  });
}

function buildNarrativeBrief({
  dayId = null,
  dayLabel = "",
  members = [],
  todayEntries = [],
  yesterdayEntries = [],
  events = [],
}) {
  return {
    dayId,
    dayLabel,
    picture: buildPicture({ members, todayEntries }),
    conversationPoints: buildConversationPoints({ members, todayEntries, yesterdayEntries }),
    stageResonance: buildStageResonance({ members }),
    events: buildEventList({ events, todayEntries }),
  };
}

// ─── DB-driven wrapper ─────────────────────────────────────────────────────

async function fetchTargetDay(sessionId, dayId) {
  if (dayId) {
    const result = await query(
      `select id, label, date_label, date_value
       from program_days
       where id = $1 and session_id = $2 limit 1`,
      [dayId, sessionId],
    );
    return result.rows[0] || null;
  }
  // Default: latest published day with at least one entry today.
  const result = await query(
    `select id, label, date_label, date_value
     from program_days
     where session_id = $1
     order by ordinal asc`,
    [sessionId],
  );
  return result.rows[result.rows.length - 1] || null;
}

async function fetchMembersForGroup(sessionId, groupId) {
  const result = await query(
    `select u.id, u.full_name, su.journey_stage, su.is_careful_mode
     from session_users su
     join users u on u.id = su.user_id
     where su.session_id = $1 and su.group_id = $2
       and su.role = 'participant' and su.status = 'active'`,
    [sessionId, groupId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    fullName: row.full_name,
    journeyStage: row.journey_stage || null,
    isCarefulMode: Boolean(row.is_careful_mode),
  }));
}

async function fetchEntriesForDay(sessionId, groupId, dayId) {
  const result = await query(
    `select de.id, de.user_id, de.event_id, de.state_id, de.state_level,
            de.comment, de.is_anonymous, de.is_hidden_from_curator,
            de.responded_at, e.day_id
     from diary_entries de
     join events e on e.id = de.event_id
     join session_users su on su.user_id = de.user_id and su.session_id = de.session_id
     where de.session_id = $1 and su.group_id = $2 and e.day_id = $3`,
    [sessionId, groupId, dayId],
  );
  return result.rows;
}

async function fetchEventsForDay(sessionId, dayId) {
  const result = await query(
    `select id, title from events where session_id = $1 and day_id = $2 order by ordinal`,
    [sessionId, dayId],
  );
  return result.rows;
}

function previousDayId(allDays, currentDayId) {
  const index = allDays.findIndex((day) => day.id === currentDayId);
  if (index <= 0) return null;
  return allDays[index - 1].id;
}

async function fetchAllDays(sessionId) {
  const result = await query(
    `select id from program_days where session_id = $1 order by ordinal asc`,
    [sessionId],
  );
  return result.rows;
}

function normaliseEntry(row) {
  return {
    id: row.id,
    userId: row.user_id,
    eventId: row.event_id,
    stateId: row.state_id || null,
    stateLevel: Number.isFinite(Number(row.state_level)) ? Number(row.state_level) : null,
    comment: row.comment || "",
    isAnonymous: Boolean(row.is_anonymous),
    isHiddenFromCurator: Boolean(row.is_hidden_from_curator),
    respondedAt: row.responded_at || null,
  };
}

async function getCuratorNarrativeBrief({ viewerId, sessionId, groupId, dayId = null }) {
  await ensureCuratorAccess(viewerId, sessionId, groupId);

  const targetDay = await fetchTargetDay(sessionId, dayId);
  if (!targetDay) {
    return buildNarrativeBrief({});
  }

  const allDays = await fetchAllDays(sessionId);
  const yesterdayId = previousDayId(allDays, targetDay.id);

  const [members, todayRows, yesterdayRows, events] = await Promise.all([
    fetchMembersForGroup(sessionId, groupId),
    fetchEntriesForDay(sessionId, groupId, targetDay.id),
    yesterdayId ? fetchEntriesForDay(sessionId, groupId, yesterdayId) : Promise.resolve([]),
    fetchEventsForDay(sessionId, targetDay.id),
  ]);

  const todayEntries = applyToList(todayRows.map(normaliseEntry), "curator");
  const yesterdayEntries = applyToList(yesterdayRows.map(normaliseEntry), "curator");

  return buildNarrativeBrief({
    dayId: targetDay.id,
    dayLabel: targetDay.label || targetDay.date_label || "",
    members,
    todayEntries,
    yesterdayEntries,
    events,
  });
}

module.exports = {
  buildNarrativeBrief,
  getCuratorNarrativeBrief,
  // Exposed for tests:
  STATE_TO_METHODOLOGY,
  METHODOLOGY_LABEL_RU,
};
