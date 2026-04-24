const { query } = require("../postgres.cjs");
const { getRawUser } = require("./userStore.cjs");
const { calculateProgress, getPublishedParticipationData } = require("./programProgress.cjs");

function average(values) {
  const finite = values.map(Number).filter(Number.isFinite);
  if (!finite.length) {
    return 0;
  }
  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
}

function averageOrNull(values) {
  const finite = values.map(Number).filter(Number.isFinite);
  if (!finite.length) {
    return null;
  }
  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
}

function amplitude(values) {
  const finite = values.map(Number).filter(Number.isFinite);
  if (!finite.length) {
    return 0;
  }
  return Math.max(...finite) - Math.min(...finite);
}

function amplitudeOrNull(values) {
  const finite = values.map(Number).filter(Number.isFinite);
  if (!finite.length) {
    return null;
  }
  return Math.max(...finite) - Math.min(...finite);
}

function roundMetric(value) {
  if (!Number.isFinite(Number(value))) {
    return null;
  }

  return Math.round(Number(value) * 10) / 10;
}

function trimText(value) {
  return String(value || "").trim();
}

function normalizeJson(value, fallback = {}) {
  if (!value) {
    return fallback;
  }

  if (typeof value === "object") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function formatTimeRange(event) {
  const start = trimText(event.start_time);
  const end = trimText(event.end_time);

  if (start && end) {
    return `${start} - ${end}`;
  }

  return start || end || "";
}

function getMemberStatus(levels) {
  if (!levels.length) {
    return "silent";
  }

  if (levels.some((level) => level >= 6) || amplitude(levels) >= 4) {
    return "risk";
  }

  if (levels.some((level) => level >= 5 || level <= 1) || amplitude(levels) >= 3) {
    return "watch";
  }

  return "ok";
}

function getDataState({ participation, members }) {
  if (!participation.isPublished) {
    return "unpublished";
  }

  if (!participation.events.length) {
    return "published_empty";
  }

  if (!members.length) {
    return "no_members";
  }

  if (!participation.entries.length && !participation.reflections.length) {
    return "no_responses";
  }

  return "ready";
}

function riskWeight(status) {
  switch (status) {
    case "risk":
      return 4;
    case "watch":
      return 3;
    case "silent":
      return 2;
    default:
      return 1;
  }
}

function buildEventPulse({ events, members, entriesByEvent }) {
  let previousAverage = null;

  return events.map((event, index) => {
    const entries = entriesByEvent.get(event.id) || [];
    const levels = entries.map((entry) => Number(entry.state_level)).filter(Number.isFinite);
    const averageStateLevel = averageOrNull(levels);
    const deltaFromPrevious =
      averageStateLevel === null || previousAverage === null
        ? null
        : roundMetric(averageStateLevel - previousAverage);

    if (averageStateLevel !== null) {
      previousAverage = averageStateLevel;
    }

    return {
      id: event.id,
      dayId: event.day_id,
      dayLabel: event.day_label || "",
      dateLabel: event.date_label || "",
      index: index + 1,
      title: event.title,
      type: event.event_type || "",
      timeLabel: formatTimeRange(event),
      location: event.location || "",
      track: event.track || "",
      tags: event.tags || [],
      answersCount: entries.length,
      participantsCount: members.length,
      completion: members.length ? Math.round((entries.length / members.length) * 100) : 0,
      averageStateLevel: roundMetric(averageStateLevel),
      minStateLevel: levels.length ? Math.min(...levels) : null,
      maxStateLevel: levels.length ? Math.max(...levels) : null,
      amplitude: amplitudeOrNull(levels),
      deltaFromPrevious,
      commentsCount: entries.filter((entry) => trimText(entry.comment)).length,
      riskAnswersCount: levels.filter((level) => level >= 5 || level <= 1).length,
      hasResponses: entries.length > 0,
    };
  });
}

function countReflectionAnswers(reflection) {
  const answers = normalizeJson(reflection.answers);
  return Object.values(answers).filter((value) => trimText(value)).length;
}

function buildReflectionDays({ days, reflections }) {
  return days.map((day) => {
    const dayReflections = reflections.filter((reflection) => reflection.day_id === day.id);
    const freeTextCount = dayReflections.filter((reflection) => trimText(reflection.free_text)).length;

    return {
      id: day.id,
      label: day.label,
      dateLabel: day.dateLabel || "",
      responsesCount: dayReflections.length,
      freeTextCount,
      answeredPromptsCount: dayReflections.reduce(
        (sum, reflection) => sum + countReflectionAnswers(reflection),
        0,
      ),
      excerpts: dayReflections
        .map((reflection) => trimText(reflection.free_text))
        .filter(Boolean)
        .slice(0, 3),
    };
  });
}

function getConfidenceByCompletion(completion) {
  const value = Number(completion || 0);
  if (value >= 75) {
    return "high";
  }
  if (value >= 50) {
    return "medium";
  }
  return "low";
}

function getEventSeverity(event) {
  const riskRatio = event.answersCount ? event.riskAnswersCount / event.answersCount : 0;
  const deltaAbs = Math.abs(Number(event.deltaFromPrevious || 0));

  if (riskRatio >= 0.5 || deltaAbs >= 2.5) {
    return "high";
  }
  if (riskRatio > 0 || deltaAbs >= 1 || event.completion < 60) {
    return "medium";
  }
  return "low";
}

function buildFocusEvents(eventPulse) {
  return eventPulse
    .filter((event) => event.hasResponses)
    .map((event) => {
      const evidence = [];
      const riskRatio = event.answersCount ? event.riskAnswersCount / event.answersCount : 0;
      const commentDensity = event.answersCount ? event.commentsCount / event.answersCount : 0;
      const deltaAbs = Math.abs(Number(event.deltaFromPrevious || 0));
      const confidence = getConfidenceByCompletion(event.completion);

      if (event.riskAnswersCount > 0) {
        evidence.push(`${event.riskAnswersCount} из ${event.answersCount} ответов в зоне риска`);
      }

      if (event.deltaFromPrevious !== null && Math.abs(event.deltaFromPrevious) >= 1) {
        evidence.push(`переход относительно прошлого события: ${event.deltaFromPrevious > 0 ? "+" : ""}${event.deltaFromPrevious}`);
      }

      if (event.completion < 60) {
        evidence.push(`низкая видимость данных: ${event.completion}% заполнения`);
      }

      if (event.commentsCount > 0 && (event.commentsCount >= 2 || commentDensity >= 0.5)) {
        evidence.push(`${event.commentsCount} комментариев`);
      }

      const prompt =
        confidence === "low"
          ? `Уточнить у группы, что происходило в точке «${event.title}»: данных пока мало.`
          : `Обсудить с группой точку «${event.title}» и проверить, что помогло или дало напряжение.`;

      return {
        id: event.id,
        title: event.title,
        dayLabel: event.dayLabel,
        timeLabel: event.timeLabel,
        type: event.type,
        averageStateLevel: event.averageStateLevel,
        completion: event.completion,
        riskAnswersCount: event.riskAnswersCount,
        deltaFromPrevious: event.deltaFromPrevious,
        confidence,
        severity: getEventSeverity(event),
        prompt,
        evidence,
        score:
          riskRatio * 10 +
          deltaAbs * 2 +
          commentDensity * 3 +
          (event.completion < 60 ? 1 : 0),
      };
    })
    .filter((event) => event.evidence.length)
    .sort((left, right) => right.score - left.score)
    .slice(0, 5)
    .map(({ score, ...event }) => event);
}

function buildReflectionBrief({ eventPulse, participantRows, dayReflections, alerts, focusEvents }) {
  const safeEvents = eventPulse.filter((event) => event.hasResponses);
  const answeredEvents = safeEvents.length;
  const totalEvents = eventPulse.length;
  const averageCompletion = totalEvents
    ? Math.round(eventPulse.reduce((sum, event) => sum + Number(event.completion || 0), 0) / totalEvents)
    : 0;
  const coverageConfidence = getConfidenceByCompletion(averageCompletion);
  const openAlerts = alerts.filter((alert) => alert.status !== "resolved" && !alert.resolvedAt);
  const talkingPoints = focusEvents.slice(0, 5).map((event) => ({
    id: event.id,
    title: event.confidence === "low" ? `Уточнить: ${event.title}` : event.title,
    prompt: event.prompt,
    confidence: event.confidence,
    severity: event.severity,
    anchor: event.id,
    evidence: event.evidence,
  }));
  const participantsToCheckIn = participantRows
    .filter((participant) => {
      return (
        participant.status === "risk" ||
        participant.status === "watch" ||
        participant.status === "silent" ||
        Number(participant.openRiskSignalsCount || 0) > 0 ||
        Number(participant.completion || 0) < 50
      );
    })
    .map((participant) => {
      const evidence = [];

      if (participant.status === "silent") {
        evidence.push("нет ответов по событиям");
      }
      if (participant.status === "risk") {
        evidence.push("статус групповой карты: нужно внимание");
      } else if (participant.status === "watch") {
        evidence.push("статус групповой карты: под наблюдением");
      }
      if (Number(participant.openRiskSignalsCount || 0) > 0) {
        evidence.push(`${participant.openRiskSignalsCount} открытых сигналов риска`);
      }
      if (Number.isFinite(Number(participant.amplitude)) && Number(participant.amplitude) >= 3) {
        evidence.push(`амплитуда дня ${participant.amplitude}`);
      }
      if (Number(participant.completion || 0) < 50) {
        evidence.push(`заполнение ${participant.completion}%`);
      }

      return {
        id: participant.id,
        name: participant.name,
        status: participant.status,
        confidence: participant.completion >= 50 || participant.status === "silent" ? "medium" : "low",
        evidence: evidence.slice(0, 4),
      };
    })
    .filter((participant) => participant.evidence.length)
    .slice(0, 6);
  const blindSpots = [];

  if (totalEvents && answeredEvents < totalEvents) {
    blindSpots.push({
      id: "events-without-responses",
      title: "Не по всем событиям есть ответы",
      detail: `${answeredEvents} из ${totalEvents} событий имеют данные. Остальное не стоит интерпретировать как нейтральное состояние.`,
      confidence: "high",
    });
  }

  eventPulse
    .filter((event) => event.hasResponses && event.completion < 50)
    .slice(0, 3)
    .forEach((event) => {
      blindSpots.push({
        id: `low-coverage-${event.id}`,
        title: `Мало данных: ${event.title}`,
        detail: `Заполнение ${event.completion}%, поэтому выводы лучше проверить в круге.`,
        confidence: "high",
      });
    });

  const reflectionResponses = dayReflections.reduce((sum, day) => sum + Number(day.responsesCount || 0), 0);
  if (participantRows.length && reflectionResponses === 0) {
    blindSpots.push({
      id: "no-day-reflections",
      title: "Нет дневной рефлексии",
      detail: "Подготовка опирается только на отметки по событиям и риск-сигналы.",
      confidence: "high",
    });
  }

  return {
    coverage: {
      confidence: coverageConfidence,
      completion: averageCompletion,
      answeredEvents,
      totalEvents,
      participantsCount: participantRows.length,
      openRisksCount: openAlerts.length,
      summary:
        coverageConfidence === "low"
          ? "Данных пока недостаточно для уверенных выводов: лучше формулировать вопросы."
          : "Данных достаточно для рабочего брифа куратора.",
    },
    talkingPoints,
    participantsToCheckIn,
    blindSpots: blindSpots.slice(0, 5),
  };
}

function buildOrganizerBrief({ eventPulse, alerts }) {
  const cards = [];
  const seenAnchors = new Set();
  const openAlerts = alerts.filter((alert) => alert.status !== "resolved" && !alert.resolvedAt);

  for (const alert of openAlerts) {
    cards.push({
      id: `risk-${alert.id}`,
      type: "risk_signal",
      severity: alert.severity,
      confidence: "high",
      title: alert.title,
      evidence: alert.detail || "Открытый сигнал риска по группе.",
      anchor: "risk_signals",
    });
    if (alert.userId) {
      seenAnchors.add(`user-${alert.userId}`);
    }
  }

  for (const event of eventPulse) {
    if (!event.hasResponses) {
      continue;
    }

    const anchorKey = `event-${event.id}`;
    if (seenAnchors.has(anchorKey)) {
      continue;
    }

    if (event.riskAnswersCount > 0) {
      cards.push({
        id: `event-risk-${event.id}`,
        type: "event_risk",
        severity: event.riskAnswersCount > 1 ? "high" : "medium",
        confidence: getConfidenceByCompletion(event.completion),
        title: `Пик напряжения: ${event.title}`,
        evidence: `${event.riskAnswersCount} из ${event.answersCount} ответов попали в крайние зоны шкалы.`,
        anchor: event.id,
      });
      seenAnchors.add(anchorKey);
      continue;
    }

    if (event.deltaFromPrevious !== null && Math.abs(event.deltaFromPrevious) >= 1.5) {
      cards.push({
        id: `event-delta-${event.id}`,
        type: "sharp_transition",
        severity: Math.abs(event.deltaFromPrevious) >= 2 ? "high" : "medium",
        confidence: getConfidenceByCompletion(event.completion),
        title: `Резкий переход: ${event.title}`,
        evidence: `Среднее состояние изменилось на ${event.deltaFromPrevious > 0 ? "+" : ""}${event.deltaFromPrevious} относительно предыдущего события с ответами.`,
        anchor: event.id,
      });
      seenAnchors.add(anchorKey);
      continue;
    }

    if (event.completion < 50) {
      cards.push({
        id: `event-visibility-${event.id}`,
        type: "low_visibility",
        severity: "low",
        confidence: "high",
        title: `Мало данных: ${event.title}`,
        evidence: `Заполнено ${event.completion}% дневников по событию, выводы стоит проверять в разговоре.`,
        anchor: event.id,
      });
      seenAnchors.add(anchorKey);
    }
  }

  return cards.slice(0, 6);
}

function buildEntriesMaps(entries) {
  const entriesByUser = new Map();
  const entriesByEvent = new Map();

  for (const row of entries) {
    if (!entriesByUser.has(row.user_id)) {
      entriesByUser.set(row.user_id, []);
    }
    entriesByUser.get(row.user_id).push(row);

    if (!entriesByEvent.has(row.event_id)) {
      entriesByEvent.set(row.event_id, []);
    }
    entriesByEvent.get(row.event_id).push(row);
  }

  return { entriesByEvent, entriesByUser };
}

function mapCuratorEvent(event) {
  return {
    id: event.id,
    dayId: event.day_id,
    dayLabel: event.day_label || "",
    dateLabel: event.date_label || "",
    title: event.title,
    type: event.event_type || "",
    timeLabel: formatTimeRange(event),
    location: event.location || "",
    track: event.track || "",
    tags: event.tags || [],
  };
}

function mapAiReport(report) {
  return report
    ? {
        id: report.id,
        title: report.title,
        scope: report.scope,
        dayId: report.day_id || null,
        confidence: report.confidence,
        version: report.version,
        content: report.content || {},
        createdAt: report.created_at,
      }
    : null;
}

function selectAiReport(reports, dayId, groupId) {
  const matchingReports = reports.filter((report) =>
    dayId ? report.day_id === dayId : !report.day_id,
  );
  const fallbackReports = dayId ? reports.filter((report) => !report.day_id) : [];

  return [...matchingReports, ...fallbackReports].sort((left, right) => {
    const groupScore =
      Number(right.group_id === groupId) - Number(left.group_id === groupId);
    if (groupScore) {
      return groupScore;
    }

    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
  })[0] || null;
}

function filterCommentClustersForDay(commentClusters, dayId) {
  if (!dayId) {
    return commentClusters;
  }

  return commentClusters.filter((cluster) => {
    const dayIds = Array.isArray(cluster.dayIds) ? cluster.dayIds : [];
    return !dayIds.length || dayIds.includes(dayId);
  });
}

function buildCuratorReportScope({
  scopeId,
  label,
  day = null,
  participation,
  memberRows,
  entryRows,
  reflectionRows,
  commentClusters,
  reports,
  alerts,
  groupId,
}) {
  const eventRows = day
    ? participation.events.filter((event) => event.day_id === day.id)
    : participation.events;
  const eventIds = new Set(eventRows.map((event) => event.id));
  const dayIds = new Set(day ? [day.id] : participation.days.map((item) => item.id));
  const scopedEntries = entryRows.filter((entry) => eventIds.has(entry.event_id));
  const scopedReflections = reflectionRows.filter((reflection) => dayIds.has(reflection.day_id));
  const { entriesByEvent, entriesByUser } = buildEntriesMaps(scopedEntries);

  const members = memberRows.map((member) => {
    const entries = entriesByUser.get(member.id) || [];
    const levels = entries.map((entry) => Number(entry.state_level)).filter(Number.isFinite);
    const memberAverage = averageOrNull(levels);
    const status = getMemberStatus(levels);
    const participantProgress = eventRows.length
      ? Math.round((entries.length / Math.max(eventRows.length, 1)) * 100)
      : 0;
    const userAlerts = alerts.filter((alert) => alert.userId === member.id);

    return {
      id: member.id,
      name: member.full_name,
      status,
      trajectory: eventRows.map((event) => {
        const entry = entries.find((item) => item.event_id === event.id);
        return {
          eventId: event.id,
          dayId: event.day_id,
          stateLevel: Number.isFinite(Number(entry?.state_level)) ? Number(entry.state_level) : null,
          stateId: entry?.state_id || null,
          answered: Boolean(entry),
          comment: trimText(entry?.comment),
          respondedAt: entry?.responded_at || null,
        };
      }),
      typology: member.typology || normalizeJson(member.meta).emotionalProfile || null,
      average: roundMetric(memberAverage),
      amplitude: amplitudeOrNull(levels),
      answeredEvents: entries.length,
      totalEvents: eventRows.length,
      completion: eventRows.length ? participantProgress : 0,
      commentsCount: entries.filter((entry) => trimText(entry.comment)).length,
      riskSignalsCount: userAlerts.length,
      openRiskSignalsCount: userAlerts.filter((alert) => alert.status !== "resolved" && !alert.resolvedAt).length,
    };
  });
  const progress = calculateProgress({
    events: eventRows,
    participants: memberRows,
    entries: scopedEntries,
    reflections: scopedReflections,
  });
  const allLevels = scopedEntries.map((entry) => Number(entry.state_level)).filter(Number.isFinite);
  const eventPulse = buildEventPulse({
    events: eventRows,
    members,
    entriesByEvent,
  });
  const participantRows = [...members].sort((left, right) => {
    const riskDifference = riskWeight(right.status) - riskWeight(left.status);
    if (riskDifference) {
      return riskDifference;
    }

    return left.completion - right.completion || left.name.localeCompare(right.name, "ru");
  });
  const heatmap = {
    columns: members.map((member) => member.name.split(" ")[0]),
    rows: eventRows.slice(0, 8).map((event) => ({
      label: event.title,
      values: members.map((member) => {
        const point = member.trajectory.find((item) => item.eventId === event.id);
        return Number.isFinite(Number(point?.stateLevel)) ? Number(point.stateLevel) : null;
      }),
    })),
  };
  const focusEvents = buildFocusEvents(eventPulse);
  const dayReflections = buildReflectionDays({
    days: day ? [day] : participation.days,
    reflections: scopedReflections,
  });
  const scopedCommentClusters = filterCommentClustersForDay(commentClusters, day?.id || null);
  const aiReport = mapAiReport(selectAiReport(reports, day?.id || null, groupId));
  const reflectionPrep = {
    focusEvents,
    dayReflections,
    commentClusters: scopedCommentClusters,
    openRisks: alerts.filter((alert) => alert.status !== "resolved" && !alert.resolvedAt),
    aiReport,
  };
  reflectionPrep.reflectionBrief = buildReflectionBrief({
    eventPulse,
    participantRows,
    dayReflections,
    alerts,
    focusEvents,
  });

  return {
    scopeId,
    label,
    dayId: day?.id || null,
    dateLabel: day?.dateLabel || "",
    events: eventRows.map(mapCuratorEvent),
    dataState: getDataState({
      participation: {
        ...participation,
        events: eventRows,
        entries: scopedEntries,
        reflections: scopedReflections,
      },
      members,
    }),
    progress,
    participantsCount: members.length,
    completion: progress.completion,
    averageActivation: roundMetric(averageOrNull(allLevels)),
    riskCases: members.filter((member) => member.status === "risk" || member.status === "watch").length,
    eventPulse,
    participantRows,
    reflectionPrep,
    organizerBrief: buildOrganizerBrief({ eventPulse, alerts }),
    heatmap,
    topThemes: scopedCommentClusters,
    aiSummary: aiReport,
    members: participantRows,
  };
}

async function ensureCuratorAccess(viewerId, sessionId, groupId) {
  const row = await getRawUser(viewerId, sessionId);
  if (!row) {
    const error = new Error("Пользователь не найден");
    error.status = 401;
    throw error;
  }

  if (row.effective_role === "admin" || row.effective_role === "organizer") {
    return row;
  }

  if (row.effective_role === "curator" && row.group_id === groupId) {
    return row;
  }

  const error = new Error("Недостаточно прав для просмотра группы");
  error.status = 403;
  throw error;
}

async function getCuratorDashboard({ viewerId, sessionId, groupId }) {
  await ensureCuratorAccess(viewerId, sessionId, groupId);

  const groupResult = await query(
    `
      select g.*, u.full_name as curator_name
      from groups g
      left join users u on u.id = g.curator_id
      where g.id = $1 and g.session_id = $2
      limit 1
    `,
    [groupId, sessionId],
  );
  const group = groupResult.rows[0];

  if (!group) {
    const error = new Error("Группа не найдена");
    error.status = 404;
    throw error;
  }

  const membersResult = await query(
    `
      select u.*, su.group_id, g.name as group_name, ta.typology
      from session_users su
      join users u on u.id = su.user_id
      join groups g on g.id = su.group_id
      left join typology_assignments ta on ta.user_id = u.id and ta.session_id = su.session_id
      where su.session_id = $1 and su.group_id = $2 and su.role = 'participant' and su.status = 'active'
      order by u.full_name
    `,
    [sessionId, groupId],
  );

  const participation = await getPublishedParticipationData(sessionId, { groupId });
  const alertsResult = await query(
    `
      select *
      from risk_signals
      where session_id = $1 and group_id = $2
      order by created_at desc
      limit 12
    `,
    [sessionId, groupId],
  );

  const alerts = alertsResult.rows.map((alert) => ({
    id: alert.id,
    userId: alert.user_id || null,
    groupId: alert.group_id || null,
    severity: alert.severity,
    status: alert.status,
    title: alert.title,
    detail: alert.detail || "",
    createdAt: alert.created_at,
    resolvedAt: alert.resolved_at || null,
  }));

  const clustersResult = await query(
    `
      select
        c.id,
        c.label,
        c.summary,
        c.score,
        count(ci.diary_entry_id)::int as count,
        coalesce(array_agg(distinct de.day_id) filter (where de.day_id is not null), '{}') as day_ids
      from comment_clusters c
      left join comment_cluster_items ci on ci.cluster_id = c.id
      left join diary_entries de on de.id = ci.diary_entry_id
      where c.session_id = $1 and c.group_id = $2
      group by c.id
      order by count desc, c.score desc nulls last, c.label
      limit 6
    `,
    [sessionId, groupId],
  );

  const reportResult = await query(
    `
      select *
      from ai_reports
      where session_id = $1 and (group_id = $2 or group_id is null)
      order by
        case when group_id = $2 then 0 else 1 end,
        created_at desc
    `,
    [sessionId, groupId],
  );
  const commentClusters = clustersResult.rows.map((cluster) => ({
    id: cluster.id,
    label: cluster.label,
    summary: cluster.summary || "",
    score: cluster.score === null ? null : Number(cluster.score),
    count: cluster.count,
    dayIds: cluster.day_ids || [],
  }));
  const allScope = buildCuratorReportScope({
    scopeId: "all",
    label: "Все дни",
    participation,
    memberRows: membersResult.rows,
    entryRows: participation.entries,
    reflectionRows: participation.reflections,
    commentClusters,
    reports: reportResult.rows,
    alerts,
    groupId,
  });
  const dayScopes = participation.days.map((day) =>
    buildCuratorReportScope({
      scopeId: day.id,
      label: day.label,
      day,
      participation,
      memberRows: membersResult.rows,
      entryRows: participation.entries,
      reflectionRows: participation.reflections,
      commentClusters,
      reports: reportResult.rows,
      alerts,
      groupId,
    }),
  );
  const reportScopes = [allScope, ...dayScopes];

  return {
    sessionId,
    groupId,
    groupName: group.name,
    curator: group.curator_name || "Куратор не назначен",
    program: participation.program
      ? {
          id: participation.program.id,
          title: participation.program.title,
          status: participation.program.status,
          isPublished: participation.isPublished,
        }
      : null,
    days: participation.days,
    reportScopes,
    ...allScope,
    alerts,
  };
}

async function getAdminDashboard() {
  const auditResult = await query(
    `
      select a.*, u.full_name as actor_name
      from audit_log a
      left join users u on u.id = a.actor_id
      order by a.created_at desc
      limit 10
    `,
  );

  return {
    accessMatrix: [
      { role: "Участник", rights: "Заполнение своего дневника и просмотр своей динамики" },
      { role: "Куратор", rights: "Аналитика только своей группы" },
      { role: "Организатор", rights: "Управление программой, группами, опросами и отчётами заезда" },
      { role: "Администратор", rights: "Пользователи, безопасность, аудит и интеграции" },
    ],
    securityCards: [
      { title: "RBAC", detail: "Доступ ограничивается ролью, заездом и группой." },
      { title: "PostgreSQL", detail: "Основные данные хранятся в нормализованных таблицах." },
      { title: "AI privacy", detail: "ИИ-контур должен получать обезличенные агрегаты." },
    ],
    auditLog: auditResult.rows.map((row) => ({
      time: new Date(row.created_at).toLocaleString("ru-RU"),
      actor: row.actor_name || "Система",
      action: row.action,
    })),
  };
}

module.exports = {
  getAdminDashboard,
  getCuratorDashboard,
};
