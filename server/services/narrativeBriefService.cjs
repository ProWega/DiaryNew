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
const { enrichWithNarrative } = require("./narrativeBriefLLM.cjs");
const guard = require("./curatorLlmGuard.cjs");
const eventConceptsStore = require("../db/repositories/eventConceptsStore.cjs");

// 7-балльная активационная шкала «от Апатии до Паники». Лейблы синхронизированы
// с src/data/stateScaleModel.js STATE_SCALE_META и server/db/repositories/
// stateScaleStore.cjs DEFAULT_STATES.
const STATE_LABEL_RU = Object.freeze({
  apathy: "Апатия",
  passive: "Пассивность",
  relaxed: "Расслабленность",
  balance: "Баланс",
  engaged: "Включённость",
  overstimulated: "Перевозбуждённость",
  panic: "Паника",
});

// Группировка по зонам активации — используется для аналитики и для правил
// «нужен ли разговор». Соответствует STATE_SCALE_ZONES в stateScaleModel.js.
const LOW_ACTIVATION = new Set(["apathy", "passive"]);
const WORKING_ACTIVATION = new Set(["relaxed", "balance", "engaged"]);
const HIGH_ACTIVATION = new Set(["overstimulated", "panic"]);

function zoneOf(stateId) {
  if (LOW_ACTIVATION.has(stateId)) return "low";
  if (WORKING_ACTIVATION.has(stateId)) return "working";
  if (HIGH_ACTIVATION.has(stateId)) return "high";
  return null;
}

const JOURNEY_STAGES = Object.freeze(["search", "verification", "support", "transmission"]);
const JOURNEY_STAGE_RU = Object.freeze({
  search: "Поиск",
  verification: "Проверка",
  support: "Опора",
  transmission: "Передача",
});

const CONVERSATION_POINT_LIMIT = 5;
const EVENT_QUOTE_LIMIT = 3;

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
  // Count по 7-балльной шкале + сводка по зонам активации.
  const stateCounts = {
    apathy: 0,
    passive: 0,
    relaxed: 0,
    balance: 0,
    engaged: 0,
    overstimulated: 0,
    panic: 0,
  };
  let lowActivationCount = 0;
  let workingActivationCount = 0;
  let highActivationCount = 0;
  for (const entry of todayEntries) {
    if (!entry.stateId || !(entry.stateId in stateCounts)) continue;
    stateCounts[entry.stateId] += 1;
    const zone = zoneOf(entry.stateId);
    if (zone === "low") lowActivationCount += 1;
    else if (zone === "working") workingActivationCount += 1;
    else if (zone === "high") highActivationCount += 1;
  }
  const dominantState = pickDominant(stateCounts);

  return {
    totalParticipants,
    respondedToday: userIdsToday.size,
    dominantState,
    dominantStateLabel: dominantState ? STATE_LABEL_RU[dominantState] : null,
    lowActivationCount,
    workingActivationCount,
    highActivationCount,
  };
}

function buildStageResonance({ members }) {
  const counts = { search: 0, verification: 0, support: 0, transmission: 0 };
  for (const member of members) {
    if (JOURNEY_STAGES.includes(member.journeyStage)) {
      counts[member.journeyStage] += 1;
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

  // Rule 1: высокая активация — Перевозбуждённость или Паника сегодня. Стоит
  // мягко проверить состояние; формулировки без диагностики.
  for (const member of members) {
    const todayEntry = findFirstEntryByUser(todayEntries, member.id);
    if (!todayEntry) continue;
    if (HIGH_ACTIVATION.has(todayEntry.stateId)) {
      add({
        participantId: member.id,
        displayName: member.fullName || "Участник без имени",
        reason: "high_activation",
        note: `Сегодня в ${STATE_LABEL_RU[todayEntry.stateId]} — стоит проверить, нужна ли пауза или разговор.`,
      });
    }
  }

  // Rule 2: резкая смена — вчера была рабочая активация, сегодня высокая.
  for (const member of members) {
    const todayEntry = findFirstEntryByUser(todayEntries, member.id);
    const yesterdayEntry = findFirstEntryByUser(yesterdayEntries, member.id);
    if (!todayEntry || !yesterdayEntry) continue;
    if (WORKING_ACTIVATION.has(yesterdayEntry.stateId) && HIGH_ACTIVATION.has(todayEntry.stateId)) {
      add({
        participantId: member.id,
        displayName: member.fullName || "Участник без имени",
        reason: "shift_down",
        note: `Вчера в ${STATE_LABEL_RU[yesterdayEntry.stateId]}, сегодня в ${STATE_LABEL_RU[todayEntry.stateId]}.`,
      });
    }
  }

  // Rule 3: затяжная низкая активация — два дня подряд Апатия или Пассивность.
  // Подойти можно мягко, без давления.
  for (const member of members) {
    const todayEntry = findFirstEntryByUser(todayEntries, member.id);
    const yesterdayEntry = findFirstEntryByUser(yesterdayEntries, member.id);
    if (!todayEntry || !yesterdayEntry) continue;
    if (LOW_ACTIVATION.has(todayEntry.stateId) && LOW_ACTIVATION.has(yesterdayEntry.stateId)) {
      add({
        participantId: member.id,
        displayName: member.fullName || "Участник без имени",
        reason: "low_activation_streak",
        note: "Второй день в низкой активации — стоит просто побыть рядом.",
      });
    }
  }

  return points.slice(0, CONVERSATION_POINT_LIMIT);
}

function stateLabelForId(stateId) {
  if (!stateId || !(stateId in STATE_LABEL_RU)) return null;
  return { id: stateId, ru: STATE_LABEL_RU[stateId] };
}

function buildParticipantCards({ members, todayEntries, yesterdayEntries, conversationPoints }) {
  const hintByUserId = new Map(
    conversationPoints.map((point) => [
      point.participantId,
      { reason: point.reason, note: point.note },
    ]),
  );

  return members.map((member) => {
    const todayEntry = findFirstEntryByUser(todayEntries, member.id);
    const yesterdayEntry = findFirstEntryByUser(yesterdayEntries, member.id);
    const hint = hintByUserId.get(member.id) || null;

    return {
      userId: member.id,
      displayName: member.fullName || "Участник без имени",
      journeyStage: member.journeyStage || null,
      journeyStageLabel: member.journeyStage ? JOURNEY_STAGE_RU[member.journeyStage] || null : null,
      today: stateLabelForId(todayEntry?.stateId),
      yesterday: stateLabelForId(yesterdayEntry?.stateId),
      conversationHint: hint,
    };
  });
}

function buildProgramArc({ programDays, entriesByDay }) {
  if (!Array.isArray(programDays) || programDays.length === 0) return { dayBreakdown: [] };

  const dayBreakdown = programDays.map((day) => {
    const dayEntries = entriesByDay[day.id] || [];
    const counts = {
      apathy: 0,
      passive: 0,
      relaxed: 0,
      balance: 0,
      engaged: 0,
      overstimulated: 0,
      panic: 0,
    };
    const respondedUserIds = new Set();
    for (const entry of dayEntries) {
      if (entry.stateId && entry.stateId in counts) counts[entry.stateId] += 1;
      if (entry.userId != null) respondedUserIds.add(entry.userId);
    }
    const dominantState = pickDominant(counts);

    return {
      dayId: day.id,
      dayLabel: day.label || day.dateLabel || "",
      respondedCount: respondedUserIds.size,
      totalEntries: dayEntries.length,
      dominantState,
      dominantStateLabel: dominantState ? STATE_LABEL_RU[dominantState] : null,
    };
  });

  return { dayBreakdown };
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
  programDays = [],
  entriesByDay = {},
}) {
  const conversationPoints = buildConversationPoints({ members, todayEntries, yesterdayEntries });
  return {
    dayId,
    dayLabel,
    picture: buildPicture({ members, todayEntries }),
    conversationPoints,
    stageResonance: buildStageResonance({ members }),
    events: buildEventList({ events, todayEntries }),
    participantCards: buildParticipantCards({
      members,
      todayEntries,
      yesterdayEntries,
      conversationPoints,
    }),
    programArc: buildProgramArc({ programDays, entriesByDay }),
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
     order by day_number asc`,
    [sessionId],
  );
  return result.rows[result.rows.length - 1] || null;
}

async function fetchMembersForGroup(sessionId, groupId) {
  const result = await query(
    `select u.id, u.full_name, su.journey_stage
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
  }));
}

async function fetchEventsForDay(sessionId, dayId) {
  const result = await query(
    `select id, title from program_events
     where session_id = $1 and day_id = $2
     order by sort_order`,
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
    `select id, label, date_label, day_number
     from program_days where session_id = $1 order by day_number asc`,
    [sessionId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    label: row.label,
    dateLabel: row.date_label,
    ordinal: row.day_number,
  }));
}

async function fetchEntriesAcrossDays(sessionId, groupId) {
  const result = await query(
    `select de.id, de.user_id, de.event_id, de.state_id, de.state_level,
            de.comment, de.is_anonymous, de.is_hidden_from_curator,
            de.responded_at, e.day_id
     from diary_entries de
     join program_events e on e.id = de.event_id
     join session_users su on su.user_id = de.user_id and su.session_id = de.session_id
     where de.session_id = $1 and su.group_id = $2`,
    [sessionId, groupId],
  );
  return result.rows;
}

function normaliseEntry(row) {
  return {
    id: row.id,
    userId: row.user_id,
    eventId: row.event_id,
    dayId: row.day_id || null,
    stateId: row.state_id || null,
    stateLevel: Number.isFinite(Number(row.state_level)) ? Number(row.state_level) : null,
    comment: row.comment || "",
    isAnonymous: Boolean(row.is_anonymous),
    isHiddenFromCurator: Boolean(row.is_hidden_from_curator),
    respondedAt: row.responded_at || null,
  };
}

async function getCuratorNarrativeBrief({
  viewerId,
  sessionId,
  groupId,
  dayId = null,
  force = false,
  model: requestedModel,
  maxTokens: requestedMaxTokens,
}) {
  await ensureCuratorAccess(viewerId, sessionId, groupId);

  // Резолвим модель и max_tokens из sessions.llm_settings. Если requested
  // не входит в allowedModels — мягко падаем на default.
  const { model, maxTokens } = await guard.resolveModel({
    sessionId,
    requestedModel,
  });
  const effectiveMaxTokens = requestedMaxTokens || maxTokens;

  // Бюджет проверяем только если будет реальный LLM-вызов: для force всегда,
  // для GET-пути — если кеш miss приведёт к вызову. Проще — проверять всегда:
  // 402 при превышении даже на cache-hit это нежелательно, поэтому пропустим
  // тут и проверим внутри enrich перед самим вызовом… но enrich не знает
  // про бюджет. Компромисс: для force всегда; для обычного — заведём проверку
  // только когда action явно дорогой (regen). Для обычного brief позволим
  // даже при превышенном бюджете отдавать кеш-версию.
  if (force) {
    await guard.ensureBudget({ sessionId, curatorId: viewerId });
  }

  const allDays = await fetchAllDays(sessionId);
  const targetDay = (await fetchTargetDay(sessionId, dayId)) || allDays[allDays.length - 1] || null;

  if (!targetDay) {
    const empty = buildNarrativeBrief({});
    const enriched = await enrichWithNarrative(empty, {
      sessionId,
      groupId,
      viewerId,
      force,
      model,
      maxTokens: effectiveMaxTokens,
    });
    await recordIfLlmCall({
      enriched,
      sessionId,
      curatorId: viewerId,
      groupId,
      kind: force ? "regen" : "brief",
      model,
    });
    return enriched;
  }

  const yesterdayId = previousDayId(allDays, targetDay.id);

  const [members, allEntriesRows, events] = await Promise.all([
    fetchMembersForGroup(sessionId, groupId),
    fetchEntriesAcrossDays(sessionId, groupId),
    fetchEventsForDay(sessionId, targetDay.id),
  ]);

  const filteredAll = applyToList(allEntriesRows.map(normaliseEntry), "curator");
  const entriesByDay = filteredAll.reduce((acc, entry) => {
    const key = entry.dayId;
    if (!key) return acc;
    if (!acc[key]) acc[key] = [];
    acc[key].push(entry);
    return acc;
  }, {});
  const todayEntries = entriesByDay[targetDay.id] || [];
  const yesterdayEntries = (yesterdayId && entriesByDay[yesterdayId]) || [];

  const brief = buildNarrativeBrief({
    dayId: targetDay.id,
    dayLabel: targetDay.label || targetDay.date_label || targetDay.dateLabel || "",
    members,
    todayEntries,
    yesterdayEntries,
    events,
    programDays: allDays,
    entriesByDay,
  });

  // Concepts для signals: для каждого события дня — список загруженных
  // концепций (storage_filename = sha256-prefix контента, меняется при
  // замене файла → fingerprint автоматически инвалидирует кеш).
  const eventIds = events.map((e) => e.id);
  const concepts = await collectConceptSignals(eventIds);

  const signalEntries = [...todayEntries, ...yesterdayEntries].map((entry) => ({
    id: entry.id,
    userId: entry.userId,
    eventId: entry.eventId,
    stateId: entry.stateId,
    isAnonymous: entry.isAnonymous,
    isHiddenFromCurator: entry.isHiddenFromCurator,
    comment: entry.comment,
  }));

  const enriched = await enrichWithNarrative(brief, {
    sessionId,
    groupId,
    dayId: targetDay.id,
    viewerId,
    force,
    model,
    maxTokens: effectiveMaxTokens,
    signals: {
      sessionId,
      groupId,
      dayId: targetDay.id,
      members,
      entries: signalEntries,
      events: events.map((e, idx) => ({ id: e.id, sortOrder: idx })),
      concepts,
    },
  });

  await recordIfLlmCall({
    enriched,
    sessionId,
    curatorId: viewerId,
    groupId,
    kind: force ? "regen" : "brief",
    model,
  });

  return enriched;
}

async function collectConceptSignals(eventIds) {
  if (!eventIds || !eventIds.length) return [];
  const all = [];
  for (const eventId of eventIds) {
    try {
      const rows = await eventConceptsStore.listByEvent(eventId);
      for (const row of rows) {
        all.push({ eventId, storageFilename: row.storageFilename });
      }
    } catch (error) {
      // 42P01 = undefined_table (миграция 1753 ещё не накатилась). Концепции
      // не критичны для brief — продолжаем с пустым набором.
      if (error?.code !== "42P01") throw error;
      return [];
    }
  }
  return all;
}

async function recordIfLlmCall({ enriched, sessionId, curatorId, groupId, kind, model }) {
  // Только когда был реальный SDK-вызов (source === "llm"); cache-hit и
  // fallback не считаем — токены не тратили.
  const usage = enriched?.narrative?.usage;
  if (enriched?.narrative?.source !== "llm" || !usage) return;
  await guard.recordUsage({
    sessionId,
    curatorId,
    groupId,
    kind,
    model,
    usage,
  });
}

/**
 * Список дней программы для куратора: тот же `fetchAllDays`, плюс флаг
 * `hasEntries` для каждого дня (есть ли хоть одна `diary_entry` от
 * участников этой группы). Нужен фронту для day-picker'а: подсвечивает
 * дни с активностью, не-активные показывает приглушённо.
 */
async function listSessionDaysForCurator({ viewerId, sessionId, groupId }) {
  await ensureCuratorAccess(viewerId, sessionId, groupId);

  const days = await fetchAllDays(sessionId);
  if (!days.length) return [];

  const statsResult = await query(
    `select e.day_id, count(distinct de.id)::int as entry_count
     from diary_entries de
     join program_events e on e.id = de.event_id
     join session_users su on su.user_id = de.user_id and su.session_id = de.session_id
     where de.session_id = $1 and su.group_id = $2
     group by e.day_id`,
    [sessionId, groupId],
  );
  const entriesByDay = new Map(statsResult.rows.map((row) => [row.day_id, row.entry_count]));

  return days.map((day) => ({
    id: day.id,
    label: day.label,
    dateLabel: day.dateLabel,
    dayNumber: day.ordinal,
    hasEntries: (entriesByDay.get(day.id) || 0) > 0,
    entriesCount: entriesByDay.get(day.id) || 0,
  }));
}

module.exports = {
  buildNarrativeBrief,
  getCuratorNarrativeBrief,
  listSessionDaysForCurator,
  // Exposed for tests:
  STATE_LABEL_RU,
  LOW_ACTIVATION,
  WORKING_ACTIVATION,
  HIGH_ACTIVATION,
};
