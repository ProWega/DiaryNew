const { query } = require("../postgres.cjs");
const { createId, getStateById } = require("./common.cjs");
const { getRawUser } = require("./userStore.cjs");

function getStateIdByLevel(level) {
  switch (Number(level)) {
    case 0:
      return "apathy";
    case 1:
      return "passive";
    case 2:
      return "relaxed";
    case 3:
      return "balance";
    case 4:
      return "engaged";
    case 5:
      return "overstimulated";
    case 6:
      return "panic";
    default:
      return "balance";
  }
}

async function ensureParticipantAccess(viewerId, sessionId) {
  const row = await getRawUser(viewerId, sessionId);
  if (!row || row.effective_role !== "participant") {
    const error = new Error("Недостаточно прав для дневника участника");
    error.status = row ? 403 : 401;
    throw error;
  }

  return row;
}

async function getEvents(sessionId) {
  const result = await query(
    `
      select
        e.*,
        d.label as day_label,
        d.date_label,
        coalesce(array_agg(t.tag order by t.tag) filter (where t.tag is not null), '{}') as tags
      from program_events e
      join program_days d on d.id = e.day_id
      left join event_tags t on t.event_id = e.id
      where e.session_id = $1
      group by e.id, d.id
      order by d.day_number, e.sort_order, e.start_time, e.title
    `,
    [sessionId],
  );

  return result.rows;
}

async function ensureDiaryRows(userId, sessionId) {
  const events = await getEvents(sessionId);

  for (const event of events) {
    await query(
      `
        insert into diary_entries (
          id, user_id, session_id, day_id, event_id, state_id, state_level, comment, confidence, source
        )
        values ($1, $2, $3, $4, $5, 'balance', 3, '', 'high', 'web')
        on conflict (user_id, session_id, day_id, event_id) do nothing
      `,
      [`entry-${userId}-${event.id}`, userId, sessionId, event.day_id, event.id],
    );
  }

  const dayIds = Array.from(new Set(events.map((event) => event.day_id)));
  for (const dayId of dayIds) {
    await query(
      `
        insert into daily_reflections (id, user_id, session_id, day_id, answers, free_text)
        values ($1, $2, $3, $4, '{}'::jsonb, '')
        on conflict (user_id, session_id, day_id) do nothing
      `,
      [`reflection-${userId}-${dayId}`, userId, sessionId, dayId],
    );
  }
}

async function getParticipantDiary({ viewerId, sessionId }) {
  await ensureParticipantAccess(viewerId, sessionId);
  await ensureDiaryRows(viewerId, sessionId);

  const result = await query(
    `
      select
        e.id as event_id,
        e.title,
        e.event_type,
        e.start_time,
        e.end_time,
        e.day_id,
        d.label as day_label,
        d.date_label,
        d.day_number,
        de.state_id,
        de.comment,
        de.confidence,
        coalesce(array_agg(t.tag order by t.tag) filter (where t.tag is not null), '{}') as tags
      from program_events e
      join program_days d on d.id = e.day_id
      left join diary_entries de
        on de.event_id = e.id and de.user_id = $2 and de.session_id = $1
      left join event_tags t on t.event_id = e.id
      where e.session_id = $1
      group by e.id, d.id, de.id
      order by d.day_number, e.sort_order, e.start_time, e.title
    `,
    [sessionId, viewerId],
  );

  const reflectionResult = await query(
    `
      select day_id, answers, free_text
      from daily_reflections
      where session_id = $1 and user_id = $2
    `,
    [sessionId, viewerId],
  );
  const reflectionByDay = new Map(reflectionResult.rows.map((row) => [row.day_id, row]));
  const days = new Map();

  for (const row of result.rows) {
    if (!days.has(row.day_id)) {
      const reflection = reflectionByDay.get(row.day_id);
      days.set(row.day_id, {
        id: row.day_id,
        label: row.day_label,
        dateLabel: row.date_label,
        insight: "Динамика дня будет уточняться по мере заполнения дневника.",
        aiHighlights: [
          "Отмечайте состояние после ключевых мероприятий.",
          "Комментарии помогают куратору увидеть причины изменений.",
        ],
        reflection: {
          q1: reflection?.answers?.q1 || "",
          q2: reflection?.answers?.q2 || "",
          q3: reflection?.answers?.q3 || "",
          freeText: reflection?.free_text || "",
        },
        events: [],
      });
    }

    days.get(row.day_id).events.push({
      id: row.event_id,
      time: [row.start_time, row.end_time].filter(Boolean).join(" - "),
      title: row.title,
      type: row.event_type,
      tags: row.tags || [],
      stateId: row.state_id || "balance",
      comment: row.comment || "",
      confidence: row.confidence || "high",
    });
  }

  const history = Array.from(days.values());
  const currentDay = history.find((day) => day.id.includes("day-2")) || history[0];

  return {
    sessionId,
    currentDayId: currentDay?.id,
    history,
  };
}

async function updateParticipantEntry({ viewerId, sessionId, dayId, entryId, patch }) {
  await ensureParticipantAccess(viewerId, sessionId);
  const state = patch.stateId ? await getStateById(patch.stateId) : null;

  await query(
    `
      insert into diary_entries (
        id, user_id, session_id, day_id, event_id, state_id, state_level, comment, confidence, source
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'web')
      on conflict (user_id, session_id, day_id, event_id)
      do update set
        state_id = coalesce(excluded.state_id, diary_entries.state_id),
        state_level = coalesce(excluded.state_level, diary_entries.state_level),
        comment = case when $10::boolean then excluded.comment else diary_entries.comment end,
        confidence = case when $11::boolean then excluded.confidence else diary_entries.confidence end,
        updated_at = now()
    `,
    [
      `entry-${viewerId}-${entryId}`,
      viewerId,
      sessionId,
      dayId,
      entryId,
      patch.stateId || null,
      state?.level ?? null,
      patch.comment ?? "",
      patch.confidence ?? "high",
      Object.prototype.hasOwnProperty.call(patch, "comment"),
      Object.prototype.hasOwnProperty.call(patch, "confidence"),
    ],
  );

  if (patch.stateId && !state) {
    const fallback = getStateIdByLevel(3);
    await query(
      `
        update diary_entries
        set state_id = $1, state_level = 3
        where user_id = $2 and session_id = $3 and day_id = $4 and event_id = $5
      `,
      [fallback, viewerId, sessionId, dayId, entryId],
    );
  }

  return getParticipantDiary({ viewerId, sessionId });
}

async function updateParticipantReflection({ viewerId, sessionId, dayId, patch }) {
  await ensureParticipantAccess(viewerId, sessionId);

  await query(
    `
      insert into daily_reflections (id, user_id, session_id, day_id, answers, free_text)
      values ($1, $2, $3, $4, $5::jsonb, $6)
      on conflict (user_id, session_id, day_id)
      do update set
        answers = excluded.answers,
        free_text = excluded.free_text,
        updated_at = now()
    `,
    [
      createId("reflection"),
      viewerId,
      sessionId,
      dayId,
      JSON.stringify({ q1: patch.q1 || "", q2: patch.q2 || "", q3: patch.q3 || "" }),
      patch.freeText || "",
    ],
  );

  return getParticipantDiary({ viewerId, sessionId });
}

module.exports = {
  getParticipantDiary,
  updateParticipantEntry,
  updateParticipantReflection,
};
