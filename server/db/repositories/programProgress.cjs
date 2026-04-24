const { query } = require("../postgres.cjs");
const { repairProgramDaysForProgram } = require("./programDays.cjs");
const { getParticipantEventAccessSettings } = require("./eventAccess.cjs");

function mapProgram(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    title: row.title,
    status: row.status || "draft",
    participantEventAccessMode: getParticipantEventAccessSettings(row.session_settings)
      .participantEventAccessMode,
  };
}

function uniqueBy(values, keyGetter) {
  const seen = new Set();
  const result = [];

  for (const value of values) {
    const key = keyGetter(value);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(value);
  }

  return result;
}

function createEmptyProgress() {
  return {
    completion: 0,
    answeredEvents: 0,
    totalEvents: 0,
    answeredReflections: 0,
    totalReflections: 0,
  };
}

function calculateProgress({ events = [], participants = [], entries = [], reflections = [] } = {}) {
  const dayIds = uniqueBy(events, (event) => event.day_id || event.dayId).map(
    (event) => event.day_id || event.dayId,
  );
  const participantIds = participants.map((participant) => participant.id).filter(Boolean);
  const answeredEventKeys = new Set(
    entries
      .filter((entry) => entry.responded_at || entry.respondedAt)
      .map((entry) => `${entry.user_id || entry.userId}:${entry.event_id || entry.eventId}`),
  );
  const answeredReflectionKeys = new Set(
    reflections
      .filter((reflection) => reflection.responded_at || reflection.respondedAt)
      .map((reflection) => `${reflection.user_id || reflection.userId}:${reflection.day_id || reflection.dayId}`),
  );

  const totalEvents = events.length * participantIds.length;
  const totalReflections = dayIds.length * participantIds.length;
  const total = totalEvents + totalReflections;
  const answeredEvents = answeredEventKeys.size;
  const answeredReflections = answeredReflectionKeys.size;
  const answered = answeredEvents + answeredReflections;

  return {
    completion: total ? Math.round((answered / total) * 100) : 0,
    answeredEvents,
    totalEvents,
    answeredReflections,
    totalReflections,
  };
}

async function getCanonicalProgram(sessionId) {
  const result = await query(
    `
      select p.id, p.title, p.status, p.start_date, p.end_date, s.date_label as session_date_label
        , s.settings as session_settings
      from programs p
      join sessions s on s.id = p.session_id
      where p.session_id = $1
      order by p.is_current desc, p.created_at, p.title
      limit 1
    `,
    [sessionId],
  );

  return result.rows[0] || null;
}

async function getProgramDays(sessionId, programId) {
  if (!programId) {
    return [];
  }

  const result = await query(
    `
      select *
      from program_days
      where session_id = $1 and program_id = $2
      order by day_number, date_value nulls last, label
    `,
    [sessionId, programId],
  );

  return result.rows;
}

async function getProgramEvents(sessionId, programId) {
  if (!programId) {
    return [];
  }

  const result = await query(
    `
      select
        e.*,
        d.label as day_label,
        d.date_label,
        d.date_value,
        d.day_number,
        coalesce(array_agg(t.tag order by t.tag) filter (where t.tag is not null), '{}') as tags
      from program_events e
      join program_days d on d.id = e.day_id
      left join event_tags t on t.event_id = e.id
      where e.session_id = $1 and e.program_id = $2
      group by e.id, d.id
      order by d.day_number, e.sort_order, e.start_time, e.title
    `,
    [sessionId, programId],
  );

  return result.rows;
}

async function getPublishedProgramContext(sessionId) {
  const canonicalProgram = await getCanonicalProgram(sessionId);
  const program = mapProgram(canonicalProgram);

  if (!program || program.status !== "published") {
    return {
      program,
      isPublished: false,
      events: [],
      days: [],
      sessionSettings: getParticipantEventAccessSettings(canonicalProgram?.session_settings),
    };
  }

  let events = await getProgramEvents(sessionId, program.id);
  const eventsByDay = new Map();
  for (const event of events) {
    if (!eventsByDay.has(event.day_id)) {
      eventsByDay.set(event.day_id, []);
    }
    eventsByDay.get(event.day_id).push(event);
  }

  const repairedDays = await repairProgramDaysForProgram({
    sessionId,
    sessionDateLabel: canonicalProgram?.session_date_label || "",
    program: canonicalProgram,
    days: await getProgramDays(sessionId, program.id),
    eventsByDay,
  });

  if (repairedDays.length) {
    events = await getProgramEvents(sessionId, program.id);
  }

  const eventDayIds = new Set(events.map((event) => event.day_id));
  const days = (repairedDays.length
    ? repairedDays
        .filter((day) => eventDayIds.has(day.id))
        .map((day) => ({
          id: day.id,
          label: day.label,
          dateLabel: day.dateLabel || "",
          dateValue: day.dateValue || null,
          dayNumber: day.dayNumber,
        }))
    : uniqueBy(events, (event) => event.day_id).map((event) => ({
        id: event.day_id,
        label: event.day_label,
        dateLabel: event.date_label || "",
        dateValue: event.date_value || null,
        dayNumber: event.day_number,
      })));

  return {
    program,
    isPublished: true,
    events,
    days,
    sessionSettings: getParticipantEventAccessSettings(canonicalProgram?.session_settings),
  };
}

async function getActiveParticipants(sessionId, groupId = null) {
  const result = await query(
    `
      select u.id, u.full_name, su.group_id, g.name as group_name
      from session_users su
      join users u on u.id = su.user_id
      left join groups g on g.id = su.group_id
      where su.session_id = $1
        and su.role = 'participant'
        and su.status = 'active'
        and ($2::text is null or su.group_id = $2)
      order by g.name, u.full_name
    `,
    [sessionId, groupId || null],
  );

  return result.rows;
}

async function getAnsweredEntries(sessionId, eventIds, groupId = null) {
  if (!eventIds.length) {
    return [];
  }

  const result = await query(
    `
      select de.user_id, de.event_id, de.day_id, de.state_id, de.state_level, de.comment, de.responded_at
      from diary_entries de
      join session_users su on su.user_id = de.user_id and su.session_id = de.session_id
      where de.session_id = $1
        and de.event_id = any($2::text[])
        and de.responded_at is not null
        and su.role = 'participant'
        and su.status = 'active'
        and ($3::text is null or su.group_id = $3)
    `,
    [sessionId, eventIds, groupId || null],
  );

  return result.rows;
}

async function getAnsweredReflections(sessionId, dayIds, groupId = null) {
  if (!dayIds.length) {
    return [];
  }

  const result = await query(
    `
      select dr.user_id, dr.day_id, dr.answers, dr.free_text, dr.responded_at
      from daily_reflections dr
      join session_users su on su.user_id = dr.user_id and su.session_id = dr.session_id
      where dr.session_id = $1
        and dr.day_id = any($2::text[])
        and dr.responded_at is not null
        and su.role = 'participant'
        and su.status = 'active'
        and ($3::text is null or su.group_id = $3)
    `,
    [sessionId, dayIds, groupId || null],
  );

  return result.rows;
}

async function getPublishedParticipationData(sessionId, { groupId = null } = {}) {
  const context = await getPublishedProgramContext(sessionId);
  const participants = await getActiveParticipants(sessionId, groupId);
  const eventIds = context.events.map((event) => event.id);
  const dayIds = context.days.map((day) => day.id);
  const [entries, reflections] = await Promise.all([
    getAnsweredEntries(sessionId, eventIds, groupId),
    getAnsweredReflections(sessionId, dayIds, groupId),
  ]);

  return {
    ...context,
    participants,
    entries,
    reflections,
    progress: calculateProgress({
      events: context.events,
      participants,
      entries,
      reflections,
    }),
  };
}

module.exports = {
  calculateProgress,
  createEmptyProgress,
  getActiveParticipants,
  getCanonicalProgram,
  getProgramEvents,
  getPublishedParticipationData,
  getPublishedProgramContext,
};
