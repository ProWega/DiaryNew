const { query } = require("../postgres.cjs");
const { calculateProgress, getPublishedParticipationData } = require("./programProgress.cjs");
const {
  groupEventsBySlot,
  countSelectionsByEvent,
} = require("../../services/parallelSlotsService.cjs");

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

function formatTimeRange(event) {
  const start = trimText(event.start_time);
  const end = trimText(event.end_time);

  if (start && end) {
    return `${start} - ${end}`;
  }

  return start || end || "";
}

function getDataState({ participation }) {
  if (!participation.isPublished) {
    return "unpublished";
  }

  if (!participation.events.length) {
    return "published_empty";
  }

  if (!participation.participants.length) {
    return "no_members";
  }

  if (!participation.entries.length && !participation.reflections.length) {
    return "no_responses";
  }

  return "ready";
}

/**
 * Версия для кабинета организатора. `participantCount` — общее число активных
 * участников сессии. Для параллельных событий знаменатель меняется на
 * `selectedCount` (см. analyticsStore.buildEventPulse для curator-side
 * комментариев).
 */
function buildEventPulse({
  events,
  participantCount,
  entriesByEvent,
  parallelSelectionsByEvent = new Map(),
}) {
  let previousAverage = null;
  const isParallelById = new Map();
  for (const slot of groupEventsBySlot(events)) {
    if (slot.isParallel) {
      for (const evt of slot.events) isParallelById.set(evt.id, true);
    }
  }

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

    const isParallel = Boolean(isParallelById.get(event.id));
    const selectedCount = isParallel
      ? parallelSelectionsByEvent.get(event.id) || 0
      : participantCount;
    const denominator = isParallel ? selectedCount : participantCount;
    const completion = denominator ? Math.round((entries.length / denominator) * 100) : 0;

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
      parallelGroup: event.parallel_group || "A",
      tags: event.tags || [],
      answersCount: entries.length,
      participantsCount: denominator,
      groupTotal: participantCount,
      selectedCount,
      isParallel,
      completion,
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

function countStateDistribution(entries = []) {
  const buckets = new Map();
  for (const entry of entries) {
    const level = Number(entry.state_level);
    if (!Number.isFinite(level)) {
      continue;
    }

    const rounded = Math.max(0, Math.min(6, Math.round(level)));
    buckets.set(rounded, (buckets.get(rounded) || 0) + 1);
  }

  return Array.from(buckets.entries())
    .sort((left, right) => left[0] - right[0])
    .map(([level, count]) => ({
      level,
      count,
    }));
}

function getRiskSeverity(value, mediumThreshold, highThreshold) {
  if (value >= highThreshold) {
    return "high";
  }

  if (value >= mediumThreshold) {
    return "medium";
  }

  return "low";
}

async function getOrganizerAnalyticsSnapshot(sessionId) {
  const [groupsResult, alertsResult, participation] = await Promise.all([
    query(
      `
        select
          g.id,
          g.name,
          g.description,
          g.curator_id,
          u.full_name as curator_name
        from groups g
        left join users u on u.id = g.curator_id
        where g.session_id = $1
        order by g.name
      `,
      [sessionId],
    ),
    query(
      `
        select *
        from risk_signals
        where session_id = $1
        order by created_at desc
      `,
      [sessionId],
    ),
    getPublishedParticipationData(sessionId),
  ]);

  const groupRows = groupsResult.rows;
  const participantCount = participation.participants.length;
  const participantsById = new Map(
    participation.participants.map((participant) => [participant.id, participant]),
  );
  const participantsByGroup = new Map();
  const entriesByEvent = new Map();
  const entriesByUser = new Map();
  const entriesByGroup = new Map();
  const entriesByGroupEvent = new Map();

  for (const participant of participation.participants) {
    if (!participantsByGroup.has(participant.group_id || "")) {
      participantsByGroup.set(participant.group_id || "", []);
    }
    participantsByGroup.get(participant.group_id || "").push(participant);
  }

  for (const entry of participation.entries) {
    if (!entriesByEvent.has(entry.event_id)) {
      entriesByEvent.set(entry.event_id, []);
    }
    entriesByEvent.get(entry.event_id).push(entry);

    if (!entriesByUser.has(entry.user_id)) {
      entriesByUser.set(entry.user_id, []);
    }
    entriesByUser.get(entry.user_id).push(entry);

    const participant = participantsById.get(entry.user_id);
    const groupId = participant?.group_id || "";
    if (!entriesByGroup.has(groupId)) {
      entriesByGroup.set(groupId, []);
    }
    entriesByGroup.get(groupId).push(entry);

    const groupEventKey = `${groupId}:${entry.event_id}`;
    if (!entriesByGroupEvent.has(groupEventKey)) {
      entriesByGroupEvent.set(groupEventKey, []);
    }
    entriesByGroupEvent.get(groupEventKey).push(entry);
  }

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
  const openAlerts = alerts.filter((alert) => alert.status !== "resolved" && !alert.resolvedAt);
  const parallelSelectionsByEvent = await countSelectionsByEvent({
    sessionId,
    eventIds: participation.events.map((event) => event.id),
  });
  const eventPulse = buildEventPulse({
    events: participation.events,
    participantCount,
    entriesByEvent,
    parallelSelectionsByEvent,
  });

  const groupPulse = groupRows.map((group, groupIndex) => {
    const groupParticipants = participantsByGroup.get(group.id) || [];
    const groupEntries = entriesByGroup.get(group.id) || [];
    const levels = groupEntries.map((entry) => Number(entry.state_level)).filter(Number.isFinite);
    const progress = calculateProgress({
      events: participation.events,
      participants: groupParticipants,
      entries: groupEntries,
      reflections: participation.reflections.filter((reflection) =>
        groupParticipants.some((participant) => participant.id === reflection.user_id),
      ),
    });
    const openRiskSignalsCount = openAlerts.filter((alert) => alert.groupId === group.id).length;
    const trajectory = participation.events.map((event) => {
      const eventEntries = entriesByGroupEvent.get(`${group.id}:${event.id}`) || [];
      return roundMetric(
        averageOrNull(
          eventEntries.map((entry) => Number(entry.state_level)).filter(Number.isFinite),
        ),
      );
    });

    return {
      id: group.id,
      name: group.name,
      shortLabel: `${groupIndex + 1}`,
      curator: group.curator_name || "Куратор не назначен",
      curatorId: group.curator_id || "",
      description: group.description || "",
      participantsCount: groupParticipants.length,
      completion: progress.completion,
      averageActivation: roundMetric(averageOrNull(levels)),
      amplitude: roundMetric(amplitudeOrNull(levels)),
      riskCases: levels.filter((level) => level >= 5 || level <= 1).length,
      openRiskSignalsCount,
      trajectory,
      stateDistribution: countStateDistribution(groupEntries),
    };
  });

  const participantScatter = participation.participants.map((participant) => {
    const entries = entriesByUser.get(participant.id) || [];
    const levels = entries.map((entry) => Number(entry.state_level)).filter(Number.isFinite);
    const completion = participation.events.length
      ? Math.round((entries.length / participation.events.length) * 100)
      : 0;

    return {
      id: participant.id,
      label: participant.full_name,
      shortLabel: participant.full_name.split(" ")[0].slice(0, 2).toUpperCase(),
      groupId: participant.group_id || "",
      groupLabel: participant.group_name || "Без группы",
      avgActivation: roundMetric(averageOrNull(levels)),
      amplitude: roundMetric(amplitudeOrNull(levels)),
      completion,
      answeredEvents: entries.length,
      size: Math.max(1, completion),
      riskSignalsCount: openAlerts.filter((alert) => alert.userId === participant.id).length,
    };
  });

  const operationalBrief = [];

  for (const group of groupPulse.filter((item) => !item.curatorId)) {
    operationalBrief.push({
      id: `group-no-curator-${group.id}`,
      type: "group_without_curator",
      severity: "high",
      title: `${group.name} без куратора`,
      evidence: "Группа уже участвует в программе, но за ней не закреплен куратор.",
      anchor: group.id,
    });
  }

  for (const alert of openAlerts.slice(0, 4)) {
    operationalBrief.push({
      id: `open-risk-${alert.id}`,
      type: "open_risk",
      severity: alert.severity || "medium",
      title: alert.title,
      evidence: alert.detail || "Открытый риск-сигнал по заезду.",
      anchor: alert.groupId || "risk_signals",
    });
  }

  for (const event of eventPulse) {
    if (!event.hasResponses) {
      continue;
    }

    if (event.completion < 60) {
      operationalBrief.push({
        id: `event-low-completion-${event.id}`,
        type: "low_completion",
        severity: getRiskSeverity(100 - event.completion, 30, 45),
        title: `Мало данных по событию: ${event.title}`,
        evidence: `Заполнение ${event.completion}% при ${event.answersCount} ответах из ${event.participantsCount}.`,
        anchor: event.id,
      });
    }

    if (event.deltaFromPrevious !== null && Math.abs(event.deltaFromPrevious) >= 1.5) {
      operationalBrief.push({
        id: `event-delta-${event.id}`,
        type: "sharp_transition",
        severity: Math.abs(event.deltaFromPrevious) >= 2 ? "high" : "medium",
        title: `Резкий переход: ${event.title}`,
        evidence: `Среднее состояние изменилось на ${event.deltaFromPrevious > 0 ? "+" : ""}${event.deltaFromPrevious} относительно предыдущего события с ответами.`,
        anchor: event.id,
      });
    }
  }

  for (const group of groupPulse.filter(
    (item) => item.openRiskSignalsCount > 0 || item.completion < 60,
  )) {
    operationalBrief.push({
      id: `group-pressure-${group.id}`,
      type: "group_pressure",
      severity: group.openRiskSignalsCount > 1 || group.completion < 45 ? "high" : "medium",
      title: `Требует внимания: ${group.name}`,
      evidence: [
        group.openRiskSignalsCount ? `${group.openRiskSignalsCount} открытых риск-сигналов` : null,
        `заполнение ${group.completion}%`,
      ]
        .filter(Boolean)
        .join(", "),
      anchor: group.id,
    });
  }

  return {
    sessionId,
    progress: participation.progress,
    dataState: getDataState({ participation }),
    eventPulse,
    groupPulse,
    participantScatter,
    operationalBrief: operationalBrief.slice(0, 10),
    openRiskSignalsCount: openAlerts.length,
    averageActivation: roundMetric(
      averageOrNull(
        participation.entries.map((entry) => Number(entry.state_level)).filter(Number.isFinite),
      ),
    ),
    riskCases: participation.entries.filter((entry) => {
      const level = Number(entry.state_level);
      return Number.isFinite(level) && (level >= 5 || level <= 1);
    }).length,
  };
}

module.exports = {
  getOrganizerAnalyticsSnapshot,
};
