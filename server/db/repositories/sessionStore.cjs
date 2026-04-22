const { query } = require("../postgres.cjs");
const { createId, getSessionInfo, normalizeDateInput, toIsoDate } = require("./common.cjs");

const REGISTRATION_STATUSES = new Set(["draft", "open", "closed", "archived"]);

function normalizeRegistrationStatus(status) {
  return REGISTRATION_STATUSES.has(status) ? status : "draft";
}

function normalizeDate(value) {
  return normalizeDateInput(value);
}

function normalizeCapacity(value) {
  if (value === "" || value === undefined || value === null) {
    return null;
  }

  const capacity = Number(value);
  return Number.isFinite(capacity) && capacity >= 0 ? Math.floor(capacity) : null;
}

function mapSession(row) {
  if (!row) {
    return null;
  }

  const participants = Number(row.participants_count || 0);
  const capacity = row.registration_capacity === null || row.registration_capacity === undefined
    ? null
    : Number(row.registration_capacity);

  return {
    id: row.id,
    name: row.name,
    cycle: row.cycle || "",
    dateLabel: row.date_label || "",
    location: row.location || "",
    startDate: toIsoDate(row.start_date),
    endDate: toIsoDate(row.end_date),
    description: row.description || "",
    editWindow: row.edit_window || "",
    registrationStatus: row.registration_status || "draft",
    registrationStartsAt: row.registration_starts_at || null,
    registrationEndsAt: row.registration_ends_at || null,
    registrationCapacity: capacity,
    registrationPolicy: row.registration_policy || {},
    participantsCount: participants,
    availableSeats: capacity === null ? null : Math.max(capacity - participants, 0),
    createdBy: row.created_by || null,
    updatedBy: row.updated_by || null,
  };
}

async function getSessionInfoById(sessionId) {
  const result = await query("select * from sessions where id = $1 limit 1", [sessionId]);
  return result.rows[0] ? getSessionInfo(result.rows[0]) : null;
}

async function listSessions({ organizerId } = {}) {
  const params = [];
  const organizerFilter = organizerId
    ? `
      join session_users osu
        on osu.session_id = s.id
        and osu.user_id = $1
        and osu.role = 'organizer'
        and osu.status = 'active'
    `
    : "";

  if (organizerId) {
    params.push(organizerId);
  }

  const result = await query(
    `
      select
        s.*,
        count(distinct su.user_id) filter (where su.role = 'participant' and su.status = 'active')::int as participants_count
      from sessions s
      ${organizerFilter}
      left join session_users su on su.session_id = s.id
      group by s.id
      order by s.start_date desc nulls last, s.name
    `,
    params,
  );

  return result.rows.map(mapSession);
}

async function listPublicEvents() {
  const result = await query(
    `
      select
        s.*,
        count(distinct su.user_id) filter (where su.role = 'participant' and su.status = 'active')::int as participants_count
      from sessions s
      left join session_users su on su.session_id = s.id
      where
        s.registration_status = 'open'
        and (s.registration_starts_at is null or s.registration_starts_at <= now())
        and (s.registration_ends_at is null or s.registration_ends_at >= now())
      group by s.id
      having
        s.registration_capacity is null
        or count(distinct su.user_id) filter (where su.role = 'participant' and su.status = 'active') < s.registration_capacity
      order by s.start_date nulls last, s.name
    `,
  );

  return result.rows.map((row) => {
    const session = mapSession(row);
    return {
      id: session.id,
      label: session.name,
      description: [session.cycle, session.dateLabel, session.location].filter(Boolean).join(" · "),
      capacity: session.registrationCapacity,
      participantsCount: session.participantsCount,
      availableSeats: session.availableSeats,
      registrationStatus: session.registrationStatus,
    };
  });
}

async function assertRegistrationAvailable(sessionId) {
  const result = await query(
    `
      select
        s.*,
        count(distinct su.user_id) filter (where su.role = 'participant' and su.status = 'active')::int as participants_count
      from sessions s
      left join session_users su on su.session_id = s.id
      where s.id = $1
      group by s.id
      limit 1
    `,
    [sessionId],
  );
  const session = mapSession(result.rows[0]);

  if (!session) {
    const error = new Error("Событие не найдено");
    error.status = 404;
    throw error;
  }

  if (session.registrationStatus !== "open") {
    const error = new Error("Регистрация на это событие сейчас закрыта");
    error.status = 403;
    throw error;
  }

  const now = Date.now();
  if (session.registrationStartsAt && new Date(session.registrationStartsAt).getTime() > now) {
    const error = new Error("Регистрация на это событие ещё не началась");
    error.status = 403;
    throw error;
  }

  if (session.registrationEndsAt && new Date(session.registrationEndsAt).getTime() < now) {
    const error = new Error("Регистрация на это событие уже завершена");
    error.status = 403;
    throw error;
  }

  if (session.registrationCapacity !== null && session.participantsCount >= session.registrationCapacity) {
    const error = new Error("На это событие уже нет свободных мест");
    error.status = 409;
    throw error;
  }

  return session;
}

async function createSession({ actorId, payload = {}, assignOrganizerId } = {}) {
  const sessionId = payload.id || createId("session");
  const startsAt = normalizeDate(payload.registrationStartsAt);
  const endsAt = normalizeDate(payload.registrationEndsAt);
  const registrationStatus = normalizeRegistrationStatus(payload.registrationStatus);
  const capacity = normalizeCapacity(payload.registrationCapacity);

  await query(
    `
      insert into sessions (
        id, name, cycle, date_label, location, start_date, end_date, description,
        registration_status, registration_starts_at, registration_ends_at,
        registration_capacity, registration_policy, created_by, updated_by, updated_at
      )
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$14,now())
      on conflict (id)
      do update set
        name = excluded.name,
        cycle = excluded.cycle,
        date_label = excluded.date_label,
        location = excluded.location,
        start_date = excluded.start_date,
        end_date = excluded.end_date,
        description = excluded.description,
        registration_status = excluded.registration_status,
        registration_starts_at = excluded.registration_starts_at,
        registration_ends_at = excluded.registration_ends_at,
        registration_capacity = excluded.registration_capacity,
        registration_policy = excluded.registration_policy,
        updated_by = excluded.updated_by,
        updated_at = now()
    `,
    [
      sessionId,
      payload.name || payload.title || "Новый заезд",
      payload.cycle || "",
      payload.dateLabel || "",
      payload.location || "",
      normalizeDate(payload.startDate),
      normalizeDate(payload.endDate),
      payload.description || "",
      registrationStatus,
      startsAt,
      endsAt,
      capacity,
      JSON.stringify(payload.registrationPolicy || { mode: "public" }),
      actorId || null,
    ],
  );

  const groupId = payload.defaultGroupId || `group-${sessionId.replace(/^session-/, "")}-1`;
  await query(
    `
      insert into groups (id, session_id, name, description, updated_at)
      values ($1, $2, $3, $4, now())
      on conflict (id)
      do update set name = excluded.name, description = excluded.description, updated_at = now()
    `,
    [groupId, sessionId, payload.defaultGroupName || "Группа 1", "Автоматически созданная группа для регистрации."],
  );

  const programId = payload.defaultProgramId || `program-${sessionId.replace(/^session-/, "")}`;
  await query(
    `
      insert into programs (
        id, session_id, title, description, event_title, event_type, venue,
        start_date, end_date, participant_count, event_description, is_current, status, updated_at
      )
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,'draft',now())
      on conflict (id)
      do update set
        title = excluded.title,
        description = excluded.description,
        event_title = excluded.event_title,
        event_type = excluded.event_type,
        venue = excluded.venue,
        start_date = excluded.start_date,
        end_date = excluded.end_date,
        participant_count = excluded.participant_count,
        event_description = excluded.event_description,
        is_current = true,
        status = 'draft',
        updated_at = now()
    `,
    [
      programId,
      sessionId,
      payload.programTitle || "Основная программа",
      payload.programDescription || "Черновик программы заезда.",
      payload.name || payload.title || "Новый заезд",
      payload.eventType || "Форумное событие",
      payload.location || "",
      normalizeDate(payload.startDate),
      normalizeDate(payload.endDate),
      capacity || 0,
      payload.description || "",
    ],
  );

  const dayId = payload.defaultDayId || `day-${programId}-1`;
  await query(
    `
      insert into program_days (
        id, program_id, session_id, day_number, label, date_label, date_value,
        flow_order, flow_meta, updated_at
      )
      values ($1,$2,$3,1,'День 1',$4,$5,'["A"]'::jsonb,'{"A":{"label":"A","track":""}}'::jsonb,now())
      on conflict (id)
      do update set
        label = excluded.label,
        date_label = excluded.date_label,
        date_value = excluded.date_value,
        flow_order = excluded.flow_order,
        flow_meta = excluded.flow_meta,
        updated_at = now()
    `,
    [dayId, programId, sessionId, payload.dateLabel || "", normalizeDate(payload.startDate)],
  );

  if (assignOrganizerId) {
    await query(
      `
        insert into session_users (session_id, user_id, group_id, role, status, updated_at)
        values ($1,$2,null,'organizer','active',now())
        on conflict (session_id, user_id)
        do update set role = 'organizer', group_id = null, status = 'active', updated_at = now()
      `,
      [sessionId, assignOrganizerId],
    );
  }

  await query(
    `
      insert into audit_log (id, actor_id, session_id, action, entity_type, entity_id, payload)
      values ($1,$2,$3,$4,'session',$3,$5::jsonb)
    `,
    [createId("audit"), actorId || null, sessionId, "create session", JSON.stringify({ registrationStatus })],
  );

  const visibleSessions = await listSessions(assignOrganizerId ? { organizerId: assignOrganizerId } : {});
  return visibleSessions.find((session) => session.id === sessionId);
}

async function updateSession({ actorId, sessionId, payload = {} }) {
  await query(
    `
      update sessions
      set
        name = coalesce($2, name),
        cycle = coalesce($3, cycle),
        date_label = coalesce($4, date_label),
        location = coalesce($5, location),
        start_date = coalesce($6, start_date),
        end_date = coalesce($7, end_date),
        description = coalesce($8, description),
        updated_by = $9,
        updated_at = now()
      where id = $1
    `,
    [
      sessionId,
      payload.name ?? null,
      payload.cycle ?? null,
      payload.dateLabel ?? null,
      payload.location ?? null,
      normalizeDate(payload.startDate),
      normalizeDate(payload.endDate),
      payload.description ?? null,
      actorId || null,
    ],
  );

  await query(
    `
      insert into audit_log (id, actor_id, session_id, action, entity_type, entity_id, payload)
      values ($1,$2,$3,'update session','session',$3,$4::jsonb)
    `,
    [createId("audit"), actorId || null, sessionId, JSON.stringify(payload)],
  );

  return (await listSessions()).find((session) => session.id === sessionId);
}

async function updateRegistration({ actorId, sessionId, payload = {} }) {
  const status = normalizeRegistrationStatus(payload.registrationStatus || payload.status);
  const capacity = normalizeCapacity(payload.registrationCapacity ?? payload.capacity);

  await query(
    `
      update sessions
      set
        registration_status = $2,
        registration_starts_at = $3,
        registration_ends_at = $4,
        registration_capacity = $5,
        registration_policy = $6::jsonb,
        updated_by = $7,
        updated_at = now()
      where id = $1
    `,
    [
      sessionId,
      status,
      normalizeDate(payload.registrationStartsAt ?? payload.startsAt),
      normalizeDate(payload.registrationEndsAt ?? payload.endsAt),
      capacity,
      JSON.stringify(payload.registrationPolicy || payload.policy || { mode: "public" }),
      actorId || null,
    ],
  );

  await query(
    `
      insert into audit_log (id, actor_id, session_id, action, entity_type, entity_id, payload)
      values ($1,$2,$3,'update registration','session',$3,$4::jsonb)
    `,
    [createId("audit"), actorId || null, sessionId, JSON.stringify({ status, capacity })],
  );

  return (await listSessions()).find((session) => session.id === sessionId);
}

module.exports = {
  assertRegistrationAvailable,
  createSession,
  getSessionInfoById,
  listPublicEvents,
  listSessions,
  mapSession,
  updateRegistration,
  updateSession,
};
