const { query } = require("../postgres.cjs");
const { createId, getStateById, selectClosestProgramDay } = require("./common.cjs");
const { getRawUser } = require("./userStore.cjs");
const {
  calculateProgress,
  createEmptyProgress,
  getPublishedProgramContext,
} = require("./programProgress.cjs");
const { computeParticipantEventAccess } = require("./eventAccess.cjs");

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

function hasField(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function hasText(value) {
  return String(value || "").trim().length > 0;
}

function normalizeReflectionQuestions(value = []) {
  const questions = Array.isArray(value) ? value : [];
  return questions
    .map((question) => {
      const text = String(question?.text || question?.title || "").trim();
      const id = String(question?.id || "").trim();
      if (!id || !text) {
        return null;
      }

      return {
        id,
        text,
        required: Boolean(question?.required),
      };
    })
    .filter(Boolean);
}

function normalizeReflectionAnswers(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, answer]) => [String(key), String(answer || "")]),
  );
}

function validateRequiredReflectionAnswers(questions = [], answers = {}) {
  const missingQuestion = normalizeReflectionQuestions(questions).find(
    (question) => question.required && !hasText(answers[question.id]),
  );

  if (missingQuestion) {
    const error = new Error(`Ответьте на обязательный вопрос: ${missingQuestion.text}`);
    error.status = 400;
    throw error;
  }
}

function mapAvailability(context) {
  if (!context.program || !context.isPublished) {
    return "unpublished";
  }

  return context.events.length ? "ready" : "published-empty";
}

function getEmptyDiary(sessionId, context) {
  return {
    sessionId,
    programStatus: context.program?.status || "draft",
    availability: mapAvailability(context),
    program: context.program,
    progress: createEmptyProgress(),
    currentDayId: null,
    history: [],
  };
}

async function ensureParticipantAccess(viewerId, sessionId) {
  const row = await getRawUser(viewerId, sessionId);
  if (!row || row.effective_role !== "participant" || row.status === "disabled") {
    const error = new Error("Недостаточно прав для дневника участника");
    error.status = row ? 403 : 401;
    throw error;
  }

  return row;
}

async function ensureDiaryRows(userId, sessionId, events) {
  for (const event of events) {
    await query(
      `
        insert into diary_entries (
          id, user_id, session_id, day_id, event_id, state_id, state_level, comment, confidence, source
        )
        values ($1, $2, $3, $4, $5, null, null, '', 'high', 'web')
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

async function getParticipantEntries(userId, sessionId, eventIds) {
  if (!eventIds.length) {
    return [];
  }

  const result = await query(
    `
      select event_id, day_id, state_id, state_level, comment, confidence, responded_at
        , meta
      from diary_entries
      where session_id = $1 and user_id = $2 and event_id = any($3::text[])
    `,
    [sessionId, userId, eventIds],
  );

  return result.rows;
}

async function getParticipantReflections(userId, sessionId, dayIds) {
  if (!dayIds.length) {
    return [];
  }

  const result = await query(
    `
      select day_id, answers, free_text, responded_at
      from daily_reflections
      where session_id = $1 and user_id = $2 and day_id = any($3::text[])
    `,
    [sessionId, userId, dayIds],
  );

  return result.rows;
}

function buildDayProgress(viewerId, dayEvents, reflection) {
  return calculateProgress({
    events: dayEvents,
    participants: [{ id: viewerId }],
    entries: dayEvents
      .map((event) => event._entry)
      .filter(Boolean)
      .map((entry) => ({
        ...entry,
        user_id: viewerId,
      })),
    reflections: reflection
      ? [
          {
            ...reflection,
            user_id: viewerId,
          },
        ]
      : [],
  });
}

async function getParticipantDiary({ viewerId, sessionId }) {
  await ensureParticipantAccess(viewerId, sessionId);

  const context = await getPublishedProgramContext(sessionId);
  if (!context.isPublished || !context.events.length) {
    return getEmptyDiary(sessionId, context);
  }

  await ensureDiaryRows(viewerId, sessionId, context.events);

  const eventIds = context.events.map((event) => event.id);
  const dayIds = context.days.map((day) => day.id);
  const [entries, reflections] = await Promise.all([
    getParticipantEntries(viewerId, sessionId, eventIds),
    getParticipantReflections(viewerId, sessionId, dayIds),
  ]);
  const entryByEvent = new Map(entries.map((entry) => [entry.event_id, entry]));
  const reflectionByDay = new Map(reflections.map((reflection) => [reflection.day_id, reflection]));
  const days = new Map();

  for (const row of context.events) {
    const entry = entryByEvent.get(row.id);
    const answered = Boolean(entry?.responded_at);

    if (!days.has(row.day_id)) {
      const reflection = reflectionByDay.get(row.day_id);
      const reflectionAnswered = Boolean(reflection?.responded_at);
      days.set(row.day_id, {
        id: row.day_id,
        label: row.day_label,
        dateLabel: row.date_label,
        dateValue: row.date_value || "",
        insight: "Динамика дня будет уточняться по мере заполнения дневника.",
        aiHighlights: [
          "Отмечайте состояние после ключевых мероприятий.",
          "Комментарии помогают куратору увидеть причины изменений.",
        ],
        reflection: {
          answers: normalizeReflectionAnswers(reflection?.answers),
          q1: reflection?.answers?.q1 || "",
          q2: reflection?.answers?.q2 || "",
          q3: reflection?.answers?.q3 || "",
          freeText: reflection?.free_text || "",
          answered: reflectionAnswered,
          respondedAt: reflection?.responded_at || null,
        },
        reflectionQuestions: normalizeReflectionQuestions(
          row.reflection_prompts || context.days.find((day) => day.id === row.day_id)?.reflectionQuestions,
        ),
        progress: createEmptyProgress(),
        events: [],
      });
    }

    days.get(row.day_id).events.push({
      id: row.id,
      time: [row.start_time, row.end_time].filter(Boolean).join(" - "),
      title: row.title,
      type: row.event_type,
      tags: row.tags || [],
      reflectionQuestions: normalizeReflectionQuestions(row.meta?.reflectionQuestions),
      reflectionAnswers: normalizeReflectionAnswers(entry?.meta?.reflectionAnswers),
      access: computeParticipantEventAccess(row, context.sessionSettings),
      stateId: answered ? entry?.state_id || null : null,
      comment: entry?.comment || "",
      confidence: entry?.confidence || "high",
      answered,
      respondedAt: entry?.responded_at || null,
      _entry: entry,
    });
  }

  const history = Array.from(days.values()).map((day) => {
    const sourceEvents = context.events.filter((event) => event.day_id === day.id);
    const reflection = reflectionByDay.get(day.id);
    return {
      ...day,
      progress: buildDayProgress(viewerId, sourceEvents.map((event) => ({
        ...event,
        _entry: entryByEvent.get(event.id),
      })), reflection),
      events: day.events.map(({ _entry, ...event }) => event),
    };
  });
  const answeredEntries = entries.filter((entry) => entry.responded_at);
  const answeredReflections = reflections.filter((reflection) => reflection.responded_at);
  const progress = calculateProgress({
    events: context.events,
    participants: [{ id: viewerId }],
    entries: answeredEntries.map((entry) => ({ ...entry, user_id: viewerId })),
    reflections: answeredReflections.map((reflection) => ({ ...reflection, user_id: viewerId })),
  });
  const currentDay = selectClosestProgramDay(history) || history[0];

  return {
    sessionId,
    programStatus: context.program?.status || "draft",
    availability: "ready",
    program: context.program,
    progress,
    currentDayId: currentDay?.id,
    history,
  };
}

async function normalizeStatePatch(patch) {
  if (!hasField(patch, "stateId")) {
    return { stateId: null, stateLevel: null, hasState: false };
  }

  let stateId = patch.stateId || null;
  let state = stateId ? await getStateById(stateId) : null;

  if (stateId && !state) {
    stateId = getStateIdByLevel(3);
    state = await getStateById(stateId);
  }

  return {
    stateId,
    stateLevel: state?.level ?? null,
    hasState: true,
  };
}

async function updateParticipantEntry({ viewerId, sessionId, dayId, entryId, patch }) {
  await ensureParticipantAccess(viewerId, sessionId);
  const context = await getPublishedProgramContext(sessionId);
  const event = context.events.find((item) => item.id === entryId && item.day_id === dayId);

  if (!event) {
    const error = new Error("Мероприятие не найдено в опубликованной программе");
    error.status = context.isPublished ? 404 : 409;
    throw error;
  }

  const access = computeParticipantEventAccess(event, context.sessionSettings);
  if (access.locked) {
    const error = new Error(access.reason || "Оценка этого события пока недоступна");
    error.status = 409;
    error.access = access;
    throw error;
  }

  const statePatch = await normalizeStatePatch(patch);
  const hasComment = hasField(patch, "comment");
  const hasConfidence = hasField(patch, "confidence");
  const hasReflectionAnswers = hasField(patch, "reflectionAnswers");
  const reflectionAnswers = hasReflectionAnswers ? normalizeReflectionAnswers(patch.reflectionAnswers) : {};
  if (!patch.allowIncompleteReflection && (statePatch.hasState || hasReflectionAnswers || hasComment || hasConfidence)) {
    validateRequiredReflectionAnswers(event.meta?.reflectionQuestions, reflectionAnswers);
  }

  const saveResult = await query(
    `
      insert into diary_entries (
        id, user_id, session_id, day_id, event_id, state_id, state_level, comment, confidence, source, meta, responded_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'web', $13::jsonb, now())
      on conflict (user_id, session_id, day_id, event_id)
      do update set
        state_id = case when $10::boolean then excluded.state_id else diary_entries.state_id end,
        state_level = case when $10::boolean then excluded.state_level else diary_entries.state_level end,
        comment = case when $11::boolean then excluded.comment else diary_entries.comment end,
        confidence = case when $12::boolean then excluded.confidence else diary_entries.confidence end,
        meta = case when $14::boolean then coalesce(diary_entries.meta, '{}'::jsonb) || excluded.meta else diary_entries.meta end,
        responded_at = now(),
        updated_at = now()
      returning state_id, state_level, responded_at
    `,
    [
      `entry-${viewerId}-${entryId}`,
      viewerId,
      sessionId,
      dayId,
      entryId,
      statePatch.stateId,
      statePatch.stateLevel,
      patch.comment ?? "",
      patch.confidence ?? "high",
      statePatch.hasState,
      hasComment,
      hasConfidence,
      JSON.stringify(hasReflectionAnswers ? { reflectionAnswers } : {}),
      hasReflectionAnswers,
    ],
  );
  const savedEntry = saveResult.rows[0];

  if (
    !savedEntry ||
    (statePatch.hasState && savedEntry.state_id !== statePatch.stateId) ||
    (statePatch.hasState && savedEntry.state_level !== statePatch.stateLevel) ||
    !savedEntry.responded_at
  ) {
    const error = new Error("Не удалось подтвердить сохранение отметки состояния");
    error.status = 500;
    throw error;
  }

  return getParticipantDiary({ viewerId, sessionId });
}

async function updateParticipantReflection({ viewerId, sessionId, dayId, patch }) {
  await ensureParticipantAccess(viewerId, sessionId);
  const context = await getPublishedProgramContext(sessionId);
  const dayExists = context.events.some((event) => event.day_id === dayId);

  if (!dayExists) {
    const error = new Error("День не найден в опубликованной программе");
    error.status = context.isPublished ? 404 : 409;
    throw error;
  }

  const day = context.days.find((item) => item.id === dayId);
  const configuredQuestions = normalizeReflectionQuestions(day?.reflectionQuestions);
  const answers = configuredQuestions.length
    ? normalizeReflectionAnswers(patch.answers || patch)
    : {
        q1: patch.q1 || "",
        q2: patch.q2 || "",
        q3: patch.q3 || "",
      };
  const freeText = patch.freeText || "";
  const hasMissingRequiredAnswers = configuredQuestions.some(
    (question) => question.required && !hasText(answers[question.id]),
  );
  const answered = (Object.values(answers).some(hasText) || hasText(freeText)) && !hasMissingRequiredAnswers;

  await query(
    `
      insert into daily_reflections (id, user_id, session_id, day_id, answers, free_text, responded_at)
      values ($1, $2, $3, $4, $5::jsonb, $6, case when $7::boolean then now() else null end)
      on conflict (user_id, session_id, day_id)
      do update set
        answers = excluded.answers,
        free_text = excluded.free_text,
        responded_at = excluded.responded_at,
        updated_at = now()
    `,
    [
      createId("reflection"),
      viewerId,
      sessionId,
      dayId,
      JSON.stringify(answers),
      freeText,
      answered,
    ],
  );

  return getParticipantDiary({ viewerId, sessionId });
}

module.exports = {
  getParticipantDiary,
  updateParticipantEntry,
  updateParticipantReflection,
};
