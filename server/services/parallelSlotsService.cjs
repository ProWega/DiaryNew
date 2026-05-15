"use strict";

/**
 * Параллельные слоты + хранение выбора участника.
 *
 * Слот идентифицируется парой `(day_id, start_time)`. Слот считается
 * **параллельным**, если в нём ≥2 события с РАЗНЫМИ значениями `parallel_group`.
 * События со `start_time = null` или одиночные в слоте — обычные.
 *
 * Storage: таблица `participant_parallel_selections` (миграция 1755), отдельно
 * от `diary_entries`. Это важно — смена выбора не теряет предыдущий коммент.
 */

const { query } = require("../db/postgres.cjs");
const { createId } = require("../db/repositories/common.cjs");

/**
 * Нормализованный ключ слота: `start_time` строкой ("09:00"), либо пустая
 * строка для событий без времени (одиночное поведение).
 */
function buildSlotKey(event) {
  if (!event) return "";
  const value = event.start_time ?? event.startTime ?? null;
  if (value === null || value === undefined || value === "") return "";
  return String(value).trim();
}

function getParallelGroup(event) {
  return event?.parallel_group ?? event?.parallelGroup ?? "A";
}

/**
 * Чистая функция: группирует массив program_events в массив слотов.
 *
 * Возвращает [{ key, dayId, startTime, events: [...], isParallel, parallelGroups: Set }].
 * События со `start_time = null/""` становятся каждое в своём слоте (key = "no-time-<event_id>"),
 * чтобы не схлопываться в один не-параллельный псевдо-слот.
 *
 * Порядок слотов: сначала по `start_time` (лексикографически = по времени HH:MM),
 * потом по `sort_order` первого события в группе, чтобы стабильно сортировать
 * слоты внутри дня.
 */
function groupEventsBySlot(events) {
  if (!Array.isArray(events) || events.length === 0) return [];

  const slots = new Map();
  for (const event of events) {
    if (!event) continue;
    const slotKey = buildSlotKey(event);
    // События без времени каждое в своём слоте, чтобы не путать одиночные
    // безвременные события с «параллельными».
    const groupingKey = slotKey === "" ? `__no-time-${event.id || Math.random()}` : slotKey;

    if (!slots.has(groupingKey)) {
      slots.set(groupingKey, {
        key: slotKey,
        dayId: event.day_id ?? event.dayId ?? null,
        startTime: slotKey || null,
        endTime: event.end_time ?? event.endTime ?? null,
        events: [],
        parallelGroups: new Set(),
      });
    }
    const slot = slots.get(groupingKey);
    slot.events.push(event);
    slot.parallelGroups.add(getParallelGroup(event));
    // endTime берём максимально длинный из событий слота, чтобы карточка
    // показала полный диапазон.
    const eventEnd = event.end_time ?? event.endTime ?? null;
    if (eventEnd && (!slot.endTime || eventEnd > slot.endTime)) {
      slot.endTime = eventEnd;
    }
  }

  return Array.from(slots.values())
    .map((slot) => ({
      ...slot,
      isParallel: slot.parallelGroups.size > 1,
      parallelGroups: Array.from(slot.parallelGroups).sort(),
    }))
    .sort((a, b) => {
      if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
      if (a.startTime) return -1;
      if (b.startTime) return 1;
      // Оба без времени — сортируем по sort_order первого события.
      const aSort = a.events[0]?.sort_order ?? a.events[0]?.sortOrder ?? 0;
      const bSort = b.events[0]?.sort_order ?? b.events[0]?.sortOrder ?? 0;
      return aSort - bSort;
    });
}

/**
 * Загружает выборы участника на сессию (опционально на конкретный день).
 * Возвращает Map<slotKey, eventId>, где slotKey формат как в `buildSlotKey`.
 *
 * Ключ Map'а — это `${dayId}|${slotKey}`, потому что один slotKey (например "09:00")
 * может встречаться в разные дни.
 */
async function getSelectionsForUser({ userId, sessionId, dayId = null }) {
  const params = [userId, sessionId];
  let sql = `
    select day_id, slot_key, event_id
      from participant_parallel_selections
     where user_id = $1 and session_id = $2`;
  if (dayId) {
    params.push(dayId);
    sql += ` and day_id = $${params.length}`;
  }
  const result = await query(sql, params);
  const map = new Map();
  for (const row of result.rows) {
    map.set(`${row.day_id}|${row.slot_key}`, row.event_id);
  }
  return map;
}

/**
 * Записывает выбор участника. Проверяет, что:
 *  - event существует и принадлежит сессии;
 *  - event.day_id и slot_key совпадают с параметрами;
 *  - в слоте действительно есть параллельные опции (>1 события с разными
 *    parallel_group) — иначе выбор бессмыслен.
 *
 * UPSERT через ON CONFLICT (user, session, day, slot_key).
 * Возвращает запись { id, dayId, slotKey, eventId, selectedAt, previousEventId }.
 */
async function setSelection({ userId, sessionId, dayId, slotKey, eventId }) {
  const normalizedSlotKey = String(slotKey || "").trim();
  if (!normalizedSlotKey) {
    const err = new Error("Слот должен иметь время начала (slotKey).");
    err.status = 400;
    throw err;
  }
  if (!eventId) {
    const err = new Error("eventId обязателен.");
    err.status = 400;
    throw err;
  }

  // 1. Проверяем что event в слоте + слот действительно параллельный.
  const slotEventsResult = await query(
    `select id, start_time, parallel_group
       from program_events
      where session_id = $1 and day_id = $2 and start_time = $3`,
    [sessionId, dayId, normalizedSlotKey],
  );
  const slotEvents = slotEventsResult.rows;
  if (!slotEvents.find((e) => e.id === eventId)) {
    const err = new Error("Это мероприятие не относится к выбранному слоту.");
    err.status = 400;
    throw err;
  }
  const distinctGroups = new Set(slotEvents.map((e) => e.parallel_group || "A"));
  if (distinctGroups.size < 2) {
    const err = new Error("В этом слоте нет параллельных опций — выбор не требуется.");
    err.status = 400;
    throw err;
  }

  // 2. Получаем предыдущий выбор для audit/возврата.
  const prev = await query(
    `select event_id from participant_parallel_selections
       where user_id = $1 and session_id = $2 and day_id = $3 and slot_key = $4
       limit 1`,
    [userId, sessionId, dayId, normalizedSlotKey],
  );
  const previousEventId = prev.rows[0]?.event_id || null;

  // 3. UPSERT.
  const id = createId("ppsel");
  const upsertResult = await query(
    `insert into participant_parallel_selections
       (id, user_id, session_id, day_id, slot_key, event_id)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (user_id, session_id, day_id, slot_key)
     do update set event_id = excluded.event_id, selected_at = now()
     returning id, day_id, slot_key, event_id, selected_at`,
    [id, userId, sessionId, dayId, normalizedSlotKey, eventId],
  );
  const row = upsertResult.rows[0];

  return {
    id: row.id,
    dayId: row.day_id,
    slotKey: row.slot_key,
    eventId: row.event_id,
    selectedAt: row.selected_at,
    previousEventId,
    changed: previousEventId !== null && previousEventId !== eventId,
  };
}

/**
 * Подсчёт выбравших каждое event'о для нужд статистики куратора.
 * Возвращает Map<eventId, count>. Если таблица ещё не создана (миграция 1755
 * не накатилась) — мягко возвращает пустую Map, чтобы аналитика не падала
 * целиком; статистика будет вести себя как до фичи параллельных слотов
 * (без учёта выборов). Это важно для dev-стенда и для случая, когда сервер
 * запущен с кодом из новой версии, а БД ещё не мигрирована.
 */
async function countSelectionsByEvent({ sessionId, eventIds }) {
  if (!Array.isArray(eventIds) || eventIds.length === 0) return new Map();
  try {
    const result = await query(
      `select event_id, count(distinct user_id)::int as n
         from participant_parallel_selections
        where session_id = $1 and event_id = ANY($2)
        group by event_id`,
      [sessionId, eventIds],
    );
    const map = new Map();
    for (const row of result.rows) {
      map.set(row.event_id, row.n);
    }
    return map;
  } catch (error) {
    // 42P01 — relation does not exist (миграция 1755 не накатилась).
    if (error?.code === "42P01") return new Map();
    throw error;
  }
}

module.exports = {
  buildSlotKey,
  getParallelGroup,
  groupEventsBySlot,
  getSelectionsForUser,
  setSelection,
  countSelectionsByEvent,
};
