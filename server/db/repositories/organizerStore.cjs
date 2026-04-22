const { query } = require("../postgres.cjs");
const { createId, normalizeDateInput, normalizeList, toIsoDate } = require("./common.cjs");
const { calculateProgress, getPublishedParticipationData } = require("./programProgress.cjs");

const DEFAULT_EVENT_TYPES = [
  "Лекция",
  "Мастер-класс",
  "Практикум",
  "Экскурсия",
  "Групповая работа",
  "Рефлексия",
  "Поддержка",
  "Логистика",
];

function normalizeFlowOrder(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item : item?.id || item?.value || item?.parallelGroup || ""))
      .map((item) => String(item).trim())
      .filter(Boolean);
  }

  return [];
}

function normalizeFlowId(value, fallback = "A") {
  const id = String(value || "").trim();
  return id || fallback;
}

function normalizeFlowMeta(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([rawId, rawMeta]) => {
        const id = normalizeFlowId(rawId, "");
        if (!id) {
          return null;
        }

        const meta = rawMeta && typeof rawMeta === "object" && !Array.isArray(rawMeta) ? rawMeta : { label: rawMeta };
        return [
          id,
          {
            label: String(meta.label || meta.title || id).trim() || id,
            track: String(meta.track || "").trim(),
          },
        ];
      })
      .filter(Boolean),
  );
}

function buildDayFlows(flowOrder = [], flowMeta = {}, events = []) {
  const ids = normalizeFlowOrder(flowOrder);
  for (const event of events || []) {
    const id = normalizeFlowId(event.parallelGroup || event.parallel_group);
    if (!ids.includes(id)) {
      ids.push(id);
    }
  }

  const safeMeta = normalizeFlowMeta(flowMeta);
  const flows = ids.map((id) => {
    const firstEvent = (events || []).find(
      (event) => normalizeFlowId(event.parallelGroup || event.parallel_group) === id,
    );
    const meta = safeMeta[id] || {};
    return {
      id,
      label: String(meta.label || id).trim() || id,
      track: String(meta.track || firstEvent?.track || "").trim(),
    };
  });

  return flows.length ? flows : [{ id: "A", label: "A", track: "" }];
}

function normalizeDayFlowOrder(day) {
  const flowSource = Array.isArray(day?.flows) && day.flows.length ? day.flows : day?.flowOrder;
  const order = normalizeFlowOrder(flowSource);
  for (const event of day?.events || []) {
    const id = normalizeFlowId(event.parallelGroup);
    if (!order.includes(id)) {
      order.push(id);
    }
  }

  return order.length ? order : ["A"];
}

function normalizeDayFlowMeta(day) {
  const meta = normalizeFlowMeta(day?.flowMeta || day?.flow_meta);
  for (const flow of day?.flows || []) {
    const id = normalizeFlowId(flow?.id || flow?.value || flow?.parallelGroup, "");
    if (!id) {
      continue;
    }
    meta[id] = {
      label: String(flow?.label || meta[id]?.label || id).trim() || id,
      track: String(flow?.track || meta[id]?.track || "").trim(),
    };
  }

  return meta;
}

function average(values) {
  const finite = values.map(Number).filter(Number.isFinite);
  if (!finite.length) {
    return 0;
  }

  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
}

async function getSessionRow(sessionId) {
  const result = await query("select * from sessions where id = $1 limit 1", [sessionId]);
  return result.rows[0] || null;
}

async function getGroupsSummary(sessionId) {
  const result = await query(
    `
      select
        g.*,
        u.full_name as curator_name,
        count(distinct su.user_id) filter (where su.role = 'participant')::int as participants,
        coalesce(avg(de.state_level), 0)::float as avg_activation,
        count(distinct de.user_id) filter (where de.state_level >= 5 or de.state_level <= 1)::int as risk_cases,
        case
          when (count(distinct pe.id) + count(distinct pe.day_id)) * greatest(count(distinct su.user_id) filter (where su.role = 'participant'), 1) = 0 then 0
          else round(
            (count(distinct de.id) + count(distinct dr.id))::numeric /
            ((count(distinct pe.id) + count(distinct pe.day_id)) * greatest(count(distinct su.user_id) filter (where su.role = 'participant'), 1))::numeric * 100
          )::int
        end as completion
      from groups g
      left join users u on u.id = g.curator_id
      left join session_users su on su.group_id = g.id and su.session_id = g.session_id and su.status = 'active'
      left join program_events pe on pe.session_id = g.session_id
        and exists (
          select 1
          from programs p
          where p.id = pe.program_id
            and p.status = 'published'
            and p.id = (
              select cp.id
              from programs cp
              where cp.session_id = g.session_id
              order by cp.is_current desc, cp.created_at, cp.title
              limit 1
            )
        )
      left join diary_entries de on de.session_id = g.session_id and de.user_id = su.user_id and de.event_id = pe.id and de.responded_at is not null
      left join daily_reflections dr on dr.session_id = g.session_id and dr.user_id = su.user_id and dr.day_id = pe.day_id and dr.responded_at is not null
      where g.session_id = $1
      group by g.id, u.full_name
      order by g.name
    `,
    [sessionId],
  );

  const alertsResult = await query(
    `
      select *
      from risk_signals
      where session_id = $1
      order by created_at desc
      limit 6
    `,
    [sessionId],
  );

  return {
    groups: result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      curator: row.curator_name || "Куратор не назначен",
      participants: row.participants,
      avgActivation: Number(row.avg_activation || 0).toFixed(1),
      riskCases: row.risk_cases,
      completion: row.completion,
      progress: { completion: row.completion },
      focus: row.description || "Описание группы не задано.",
    })),
    alerts: alertsResult.rows.map((row) => ({
      id: row.id,
      severity: row.severity,
      title: row.title,
      detail: row.detail,
    })),
  };
}

async function getAudiencePool(sessionId) {
  const result = await query(
    `
      select u.*, su.group_id, g.name as group_name, ta.typology
      from session_users su
      join users u on u.id = su.user_id
      left join groups g on g.id = su.group_id
      left join typology_assignments ta on ta.user_id = u.id and ta.session_id = su.session_id
      where su.session_id = $1 and su.role = 'participant' and su.status = 'active'
      order by g.name, u.full_name
    `,
    [sessionId],
  );
  const participation = await getPublishedParticipationData(sessionId);
  const entriesByUser = new Map();
  const reflectionsByUser = new Map();

  for (const entry of participation.entries) {
    if (!entriesByUser.has(entry.user_id)) {
      entriesByUser.set(entry.user_id, []);
    }
    entriesByUser.get(entry.user_id).push(entry);
  }

  for (const reflection of participation.reflections) {
    if (!reflectionsByUser.has(reflection.user_id)) {
      reflectionsByUser.set(reflection.user_id, []);
    }
    reflectionsByUser.get(reflection.user_id).push(reflection);
  }

  return result.rows.map((row) => ({
    progress: calculateProgress({
      events: participation.events,
      participants: [{ id: row.id }],
      entries: entriesByUser.get(row.id) || [],
      reflections: reflectionsByUser.get(row.id) || [],
    }),
    avgActivation: average((entriesByUser.get(row.id) || []).map((entry) => entry.state_level)).toFixed(1),
    id: row.id,
    fullName: row.full_name,
    groupId: row.group_id,
    groupLabel: row.group_name,
    age: row.age || 0,
    gender: row.gender || "не указан",
    emotionalProfile: row.typology || row.meta?.emotionalProfile || "не рассчитан",
    identityStatus: row.meta?.identityStatus || "не пройден",
  }));
}

async function getProgramWorkspace(sessionId) {
  const programsResult = await query(
    `
      with canonical_program as (
        select id
        from programs
        where session_id = $1
        order by is_current desc, created_at, title
        limit 1
      )
      select p.*
      from programs p
      join canonical_program c on c.id = p.id
      order by p.is_current desc, p.created_at, p.title
    `,
    [sessionId],
  );

  const daysResult = await query(
    `
      select *
      from program_days
      where session_id = $1
      order by day_number, date_value nulls last, label
    `,
    [sessionId],
  );

  const eventsResult = await query(
    `
      select e.*, s.name as speaker_name,
        coalesce(array_agg(t.tag order by t.tag) filter (where t.tag is not null), '{}') as tags
      from program_events e
      left join speakers s on s.id = e.speaker_id
      left join event_tags t on t.event_id = e.id
      where e.session_id = $1
      group by e.id, s.name
      order by e.sort_order, e.start_time, e.title
    `,
    [sessionId],
  );

  const speakersResult = await query(
    `
      select *
      from speakers
      where session_id = $1
      order by name
    `,
    [sessionId],
  );

  const daysByProgram = new Map();
  for (const day of daysResult.rows) {
    if (!daysByProgram.has(day.program_id)) {
      daysByProgram.set(day.program_id, []);
    }
    daysByProgram.get(day.program_id).push(day);
  }

  const eventsByDay = new Map();
  for (const event of eventsResult.rows) {
    if (!eventsByDay.has(event.day_id)) {
      eventsByDay.set(event.day_id, []);
    }
    eventsByDay.get(event.day_id).push(event);
  }

  const programs = programsResult.rows.map((program) => ({
    id: program.id,
    title: program.title,
    description: program.description || "",
    status: program.status || "draft",
    eventContext: {
      id: `event-context-${program.id}`,
      title: program.event_title || program.title,
      eventType: program.event_type || "Форумное событие",
      venue: program.venue || "",
      startDate: toIsoDate(program.start_date),
      endDate: toIsoDate(program.end_date),
      participantCount: program.participant_count || 0,
      description: program.event_description || program.description || "",
    },
    days: (daysByProgram.get(program.id) || []).map((day) => {
      const events = (eventsByDay.get(day.id) || []).map((event) => ({
        id: event.id,
        title: event.title,
        start: event.start_time || "",
        end: event.end_time || "",
        type: event.event_type || "",
        speakerId: event.speaker_id || "",
        speakerName: event.speaker_name || "",
        location: event.location || "",
        track: event.track || "",
        parallelGroup: event.parallel_group || "A",
        status: event.status || "planned",
        tags: event.tags || [],
        description: event.description || "",
      }));
      const flowMeta = normalizeFlowMeta(day.flow_meta);
      const flows = buildDayFlows(day.flow_order, flowMeta, events);

      return {
        id: day.id,
        label: day.label,
        dateLabel: day.date_label || "",
        dateValue: toIsoDate(day.date_value),
        flowOrder: flows.map((flow) => flow.id),
        flowMeta,
        flows,
        events,
      };
    }),
  }));

  const currentProgram = programsResult.rows.find((program) => program.is_current) || programsResult.rows[0];
  const activeEvent = eventsResult.rows.find((event) => event.status === "active") || eventsResult.rows[0];

  return {
    currentProgramId: currentProgram?.id || null,
    activeEventId: activeEvent?.id || null,
    reference: {
      eventTypes: DEFAULT_EVENT_TYPES,
    },
    speakersCatalog: speakersResult.rows.map((speaker) => ({
      id: speaker.id,
      name: speaker.name,
      role: speaker.role || "Спикер / ведущий",
      topics: speaker.topics || [],
    })),
    programs,
  };
}

async function getSurveyWorkspace(sessionId, audiencePool) {
  const surveysResult = await query(
    `
      select *
      from surveys
      where session_id = $1
      order by created_at desc
    `,
    [sessionId],
  );
  const questionsResult = await query(
    `
      select q.*
      from survey_questions q
      join surveys s on s.id = q.survey_id
      where s.session_id = $1
      order by q.sort_order, q.created_at
    `,
    [sessionId],
  );
  const publicationsResult = await query(
    `
      select *
      from survey_publications
      where session_id = $1
      order by published_at desc
    `,
    [sessionId],
  );

  const questionsBySurvey = new Map();
  for (const question of questionsResult.rows) {
    if (!questionsBySurvey.has(question.survey_id)) {
      questionsBySurvey.set(question.survey_id, []);
    }
    questionsBySurvey.get(question.survey_id).push(question);
  }

  const unique = (values) => Array.from(new Set(values)).filter(Boolean);

  return {
    filterOptions: {
      genders: unique(audiencePool.map((item) => item.gender)),
      emotionalProfiles: unique(audiencePool.map((item) => item.emotionalProfile)),
      identityStatuses: unique(audiencePool.map((item) => item.identityStatus)),
      groupIds: unique(audiencePool.map((item) => item.groupId)),
    },
    surveys: surveysResult.rows.map((survey) => ({
      id: survey.id,
      title: survey.title,
      category: survey.category,
      cadence: survey.cadence,
      source: survey.source,
      description: survey.description,
      status: survey.status,
      questions: (questionsBySurvey.get(survey.id) || []).map((question) => ({
        id: question.id,
        type: question.question_type,
        title: question.title,
        options: Array.isArray(question.options) ? question.options : [],
      })),
    })),
    publications: publicationsResult.rows.map((publication) => ({
      id: publication.id,
      surveyId: publication.survey_id,
      status: publication.status,
      publishedAt: publication.published_at,
      audienceSummary: publication.audience_summary,
      recipientsCount: publication.recipients_count,
      filters: publication.filters || {},
    })),
  };
}

async function getSpeakerLectureSummary(sessionId) {
  const eventsResult = await query(
    `
      select e.*, s.name as speaker_name, s.role as speaker_role, s.topics,
        coalesce(array_agg(t.tag order by t.tag) filter (where t.tag is not null), '{}') as tags,
        d.label as day_label
      from program_events e
      left join speakers s on s.id = e.speaker_id
      left join event_tags t on t.event_id = e.id
      join program_days d on d.id = e.day_id
      join programs p on p.id = e.program_id
      where e.session_id = $1
        and p.status = 'published'
        and p.id = (
          select cp.id
          from programs cp
          where cp.session_id = $1
          order by cp.is_current desc, cp.created_at, cp.title
          limit 1
        )
      group by e.id, s.id, d.id
      order by d.day_number, e.sort_order
    `,
    [sessionId],
  );

  const participation = await getPublishedParticipationData(sessionId);
  const participantCount = participation.participants.length;
  const answeredByEvent = new Map();
  for (const entry of participation.entries) {
    answeredByEvent.set(entry.event_id, (answeredByEvent.get(entry.event_id) || 0) + 1);
  }

  const speakerMap = new Map();
  for (const event of eventsResult.rows) {
    const speakerId = event.speaker_id || "speaker-program-team";
    const speaker = speakerMap.get(speakerId) || {
      id: speakerId,
      name: event.speaker_name || "Команда программы",
      role: event.speaker_role || "Спикер / ведущий",
      topics: event.topics?.length ? event.topics : [],
      eventsLed: 0,
      activationLift: "н/д",
      feedbackTone: "Аналитика появится после накопления ответов.",
      recommendation: "Использовать как наблюдаемую единицу программы.",
    };
    speaker.eventsLed += 1;
    speakerMap.set(speakerId, speaker);
  }

  return {
    speakers: Array.from(speakerMap.values()),
    lectures: eventsResult.rows.map((event) => ({
      id: `lecture-${event.id}`,
      eventId: event.id,
      title: event.title,
      speakerId: event.speaker_id,
      speakerName: event.speaker_name || "Команда программы",
      day: event.day_label,
      start: event.start_time,
      end: event.end_time,
      avgActivationDelta: "н/д",
      completion: participantCount ? Math.round(((answeredByEvent.get(event.id) || 0) / participantCount) * 100) : 0,
      topThemes: event.tags || [],
      note: "Аналитика по этому блоку появится после накопления ответов участников.",
    })),
  };
}

async function getSessionSummary(sessionId) {
  const statsResult = await query(
    `
      select
        count(distinct su.user_id) filter (where su.role = 'participant')::int as participants,
        count(de.id) filter (where nullif(btrim(de.comment), '') is not null)::int as comments,
        coalesce(avg(de.state_level), 0)::float as avg_activation
      from session_users su
      left join diary_entries de on de.user_id = su.user_id and de.session_id = su.session_id
        and de.responded_at is not null
        and exists (
          select 1
          from program_events pe
          join programs p on p.id = pe.program_id
          where pe.id = de.event_id
            and p.status = 'published'
            and p.id = (
              select cp.id
              from programs cp
              where cp.session_id = su.session_id
              order by cp.is_current desc, cp.created_at, cp.title
              limit 1
            )
        )
      where su.session_id = $1 and su.status = 'active'
    `,
    [sessionId],
  );
  const stats = statsResult.rows[0] || {};
  const participation = await getPublishedParticipationData(sessionId);

  const reportsResult = await query(
    `
      select *
      from ai_reports
      where session_id = $1
      order by created_at desc
      limit 4
    `,
    [sessionId],
  );

  return {
    progress: participation.progress,
    keyStats: [
      { id: "stat-1", label: "Участников", value: String(stats.participants || 0) },
      { id: "stat-2", label: "Средняя активация", value: Number(stats.avg_activation || 0).toFixed(1) },
      { id: "stat-3", label: "Комментариев", value: String(stats.comments || 0) },
      { id: "stat-4", label: "Заполнено", value: `${participation.progress.completion}%` },
    ],
    eventHealth: [],
    aiReports: reportsResult.rows.map((report) => ({
      id: report.id,
      title: report.title,
      confidence: report.confidence,
      bullets: report.content?.bullets || [],
    })),
    typologies: [],
  };
}

async function getOrganizerWorkspace(sessionId) {
  const session = await getSessionRow(sessionId);
  if (!session) {
    const error = new Error("Заезд не найден");
    error.status = 404;
    throw error;
  }

  const audiencePool = await getAudiencePool(sessionId);
  const programWorkspace = await getProgramWorkspace(sessionId);
  const groupsSummary = await getGroupsSummary(sessionId);
  const surveyWorkspace = await getSurveyWorkspace(sessionId, audiencePool);
  const speakerLectureSummary = await getSpeakerLectureSummary(sessionId);
  const sessionSummary = await getSessionSummary(sessionId);
  const activeEvent = programWorkspace.programs
    .flatMap((program) => program.days.flatMap((day) => day.events))
    .find((event) => event.id === programWorkspace.activeEventId);

  return {
    sessionId,
    sessionLabel: session.name,
    title: "Личный кабинет организатора",
    meta: {
      revision: 1,
      updatedAt: new Date().toISOString(),
      storageMode: "postgres",
    },
    summary: {
      activeEventLabel: activeEvent ? `${activeEvent.type}: ${activeEvent.title}` : "Текущее мероприятие не выбрано",
      programsCount: programWorkspace.programs.length,
      groupsCount: groupsSummary.groups.length,
      speakersCount: programWorkspace.speakersCatalog.length,
      surveysCount: surveyWorkspace.surveys.length,
    },
    registration: {
      status: session.registration_status || "draft",
      startsAt: session.registration_starts_at || null,
      endsAt: session.registration_ends_at || null,
      capacity: session.registration_capacity ?? null,
      policy: session.registration_policy || {},
      participantsCount: audiencePool.length,
      availableSeats:
        session.registration_capacity === null || session.registration_capacity === undefined
          ? null
          : Math.max(Number(session.registration_capacity) - audiencePool.length, 0),
    },
    groupsSummary,
    sessionSummary,
    speakerLectureSummary,
    audiencePool,
    programWorkspace,
    surveyWorkspace,
  };
}

async function saveWorkspaceCache(sessionId, workspace) {
  await query(
    `
      insert into organizer_workspaces (session_id, workspace, updated_at)
      values ($1, $2::jsonb, now())
      on conflict (session_id)
      do update set workspace = excluded.workspace, updated_at = excluded.updated_at
    `,
    [sessionId, JSON.stringify(workspace)],
  );
}

async function persistWorkspace(sessionId, workspace) {
  for (const program of workspace.programWorkspace?.programs || []) {
    await query(
      `
        insert into programs (
          id, session_id, title, description, event_title, event_type, venue,
          start_date, end_date, participant_count, event_description, is_current, status, updated_at
        )
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now())
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
          is_current = excluded.is_current,
          status = excluded.status,
          updated_at = now()
      `,
      [
        program.id,
        sessionId,
        program.title,
        program.description || "",
        program.eventContext?.title || program.title,
        program.eventContext?.eventType || "",
        program.eventContext?.venue || "",
        normalizeDateInput(program.eventContext?.startDate),
        normalizeDateInput(program.eventContext?.endDate),
        Number(program.eventContext?.participantCount || 0),
        program.eventContext?.description || "",
        workspace.programWorkspace.currentProgramId === program.id,
        program.status || "draft",
      ],
    );

    for (const [dayIndex, day] of (program.days || []).entries()) {
      await query(
        `
          insert into program_days (id, program_id, session_id, day_number, label, date_label, date_value, flow_order, flow_meta, updated_at)
          values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,now())
          on conflict (id)
          do update set
            label = excluded.label,
            date_label = excluded.date_label,
            date_value = excluded.date_value,
            flow_order = excluded.flow_order,
            flow_meta = excluded.flow_meta,
            updated_at = now()
        `,
        [
          day.id,
          program.id,
          sessionId,
          dayIndex + 1,
          day.label,
          day.dateLabel || "",
          normalizeDateInput(day.dateValue),
          JSON.stringify(normalizeDayFlowOrder(day)),
          JSON.stringify(normalizeDayFlowMeta(day)),
        ],
      );

      for (const [eventIndex, event] of (day.events || []).entries()) {
        if (event.speakerId && event.speakerName) {
          await query(
            `
              insert into speakers (id, session_id, name, role, topics, meta, updated_at)
              values ($1,$2,$3,'Спикер / ведущий','{}','{}'::jsonb,now())
              on conflict (id)
              do update set name = excluded.name, updated_at = now()
            `,
            [event.speakerId, sessionId, event.speakerName],
          );
        }

        await query(
          `
            insert into program_events (
              id, session_id, program_id, day_id, speaker_id, title, start_time,
              end_time, event_type, location, track, parallel_group, status,
              description, sort_order, meta, updated_at
            )
            values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'{}'::jsonb,now())
            on conflict (id)
            do update set
              speaker_id = excluded.speaker_id,
              title = excluded.title,
              start_time = excluded.start_time,
              end_time = excluded.end_time,
              event_type = excluded.event_type,
              location = excluded.location,
              track = excluded.track,
              parallel_group = excluded.parallel_group,
              status = excluded.status,
              description = excluded.description,
              sort_order = excluded.sort_order,
              updated_at = now()
          `,
          [
            event.id,
            sessionId,
            program.id,
            day.id,
            event.speakerId || null,
            event.title,
            event.start || "",
            event.end || "",
            event.type || "",
            event.location || "",
            event.track || "",
            event.parallelGroup || "A",
            event.status || "planned",
            event.description || "",
            eventIndex,
          ],
        );

        await query("delete from event_tags where event_id = $1", [event.id]);
        for (const tag of normalizeList(event.tags)) {
          await query(
            `
              insert into event_tags (event_id, tag)
              values ($1, $2)
              on conflict (event_id, tag) do nothing
            `,
            [event.id, tag],
          );
        }
      }

      const eventIds = (day.events || []).map((event) => event.id).filter(Boolean);
      await query("delete from program_events where day_id = $1 and not (id = any($2::text[]))", [
        day.id,
        eventIds,
      ]);
    }

    const dayIds = (program.days || []).map((day) => day.id).filter(Boolean);
    await query("delete from program_days where program_id = $1 and not (id = any($2::text[]))", [
      program.id,
      dayIds,
    ]);
  }

  for (const survey of workspace.surveyWorkspace?.surveys || []) {
    await query(
      `
        insert into surveys (id, session_id, title, category, cadence, source, description, status, updated_at)
        values ($1,$2,$3,$4,$5,$6,$7,$8,now())
        on conflict (id)
        do update set
          title = excluded.title,
          category = excluded.category,
          cadence = excluded.cadence,
          source = excluded.source,
          description = excluded.description,
          status = excluded.status,
          updated_at = now()
      `,
      [
        survey.id,
        sessionId,
        survey.title,
        survey.category || "",
        survey.cadence || "",
        survey.source || "",
        survey.description || "",
        survey.status || "draft",
      ],
    );

    for (const [index, question] of (survey.questions || []).entries()) {
      await query(
        `
          insert into survey_questions (id, survey_id, question_type, title, options, sort_order, meta, updated_at)
          values ($1,$2,$3,$4,$5::jsonb,$6,'{}'::jsonb,now())
          on conflict (id)
          do update set
            question_type = excluded.question_type,
            title = excluded.title,
            options = excluded.options,
            sort_order = excluded.sort_order,
            updated_at = now()
        `,
        [
          question.id,
          survey.id,
          question.type || "scale",
          question.title,
          JSON.stringify(question.options || []),
          index,
        ],
      );
    }
  }

  for (const publication of workspace.surveyWorkspace?.publications || []) {
    await query(
      `
        insert into survey_publications (
          id, survey_id, session_id, status, published_at, audience_summary,
          recipients_count, filters
        )
        values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
        on conflict (id)
        do update set
          status = excluded.status,
          audience_summary = excluded.audience_summary,
          recipients_count = excluded.recipients_count,
          filters = excluded.filters
      `,
      [
        publication.id,
        publication.surveyId,
        sessionId,
        publication.status || "active",
        publication.publishedAt || new Date().toISOString(),
        publication.audienceSummary || "",
        publication.recipientsCount || 0,
        JSON.stringify(publication.filters || {}),
      ],
    );
  }

  const freshWorkspace = await getOrganizerWorkspace(sessionId);
  await saveWorkspaceCache(sessionId, freshWorkspace);
  return freshWorkspace;
}

module.exports = {
  getOrganizerWorkspace,
  persistWorkspace,
  saveWorkspaceCache,
};
