import { useState } from "react";
import MetricBadge from "../components/MetricBadge";
import {
  EventImpactBarChart,
  RiskScatterChart,
  StackedDistributionChart,
} from "../components/Charts";
import { stateScale } from "../data/mockData";

const stateByLevel = Object.fromEntries(stateScale.map((state) => [state.level, state]));
const PULSE_DOMAIN = [0, 6];

const DATA_STATE_COPY = {
  unpublished: {
    title: "Программа еще не опубликована",
    description: "Пульс группы появится после публикации программы организатором.",
  },
  published_empty: {
    title: "В опубликованной программе нет событий",
    description: "Кураторский бриф начнет собираться после появления событий в программе.",
  },
  no_members: {
    title: "В группе пока нет активных участников",
    description: "Данные для кураторской аналитики появятся после назначения участников в группу.",
  },
  no_responses: {
    title: "Ответов пока нет",
    description: "События уже есть, но участники еще не заполнили дневник или дневную рефлексию.",
  },
};

const STATUS_COPY = {
  risk: { label: "Нужно внимание", className: "tone-risk" },
  watch: { label: "Под наблюдением", className: "tone-watch" },
  silent: { label: "Нет ответов", className: "tone-silent" },
  ok: { label: "Стабильно", className: "tone-ok" },
};

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function formatNumber(value, digits = 1) {
  if (!Number.isFinite(Number(value))) {
    return "—";
  }

  return Number(value).toFixed(digits).replace(".", ",");
}

function formatPercent(value) {
  if (!Number.isFinite(Number(value))) {
    return "0%";
  }

  return `${Math.round(Number(value))}%`;
}

function formatDelta(value) {
  if (!Number.isFinite(Number(value))) {
    return "—";
  }

  return `${Number(value) > 0 ? "+" : ""}${formatNumber(value)}`;
}

function clamp(value, min, max) {
  if (!Number.isFinite(Number(value))) {
    return min;
  }

  return Math.max(min, Math.min(Number(value), max));
}

function getStateByLevel(value) {
  if (!Number.isFinite(Number(value))) {
    return null;
  }

  return stateByLevel[Math.round(clamp(Number(value), PULSE_DOMAIN[0], PULSE_DOMAIN[1]))] || null;
}

function getStatusCopy(status) {
  return STATUS_COPY[status] || STATUS_COPY.ok;
}

function getSeverityClass(severity) {
  if (severity === "high") {
    return "is-high";
  }

  if (severity === "low") {
    return "is-low";
  }

  return "is-medium";
}

function getConfidenceLabel(confidence) {
  if (confidence === "high") {
    return "уверенно";
  }
  if (confidence === "low") {
    return "проверить";
  }
  return "рабочая гипотеза";
}

function getCoverageSummary(brief, dashboard) {
  const coverage = brief?.coverage;
  if (coverage) {
    return coverage;
  }

  return {
    confidence: Number(dashboard.completion || 0) >= 75 ? "high" : Number(dashboard.completion || 0) >= 50 ? "medium" : "low",
    completion: Number(dashboard.completion || 0),
    answeredEvents: Number(dashboard.progress?.answeredEvents || 0),
    totalEvents: Number(dashboard.progress?.totalEvents || 0),
    participantsCount: Number(dashboard.participantsCount || 0),
    openRisksCount: asArray(dashboard.reflectionPrep?.openRisks).length,
    summary:
      Number(dashboard.completion || 0) >= 50
        ? "Данных достаточно для рабочего разговора, но выводы стоит проверять с группой."
        : "Данных пока мало: лучше формулировать вопросы, а не выводы.",
  };
}

function buildReflectionBriefFallback({ focusEvents, participantRows, openRisks, dashboard }) {
  return {
    coverage: getCoverageSummary(null, dashboard),
    talkingPoints: asArray(focusEvents).slice(0, 5).map((event) => ({
      id: event.id,
      title: event.title,
      prompt:
        event.confidence === "low"
          ? `Уточнить, что происходило в точке «${event.title}».`
          : `Обсудить точку «${event.title}» и проверить, что повлияло на состояние группы.`,
      confidence: event.confidence || "medium",
      severity: event.severity || "medium",
      evidence: asArray(event.evidence),
    })),
    participantsToCheckIn: asArray(participantRows)
      .filter((participant) => ["risk", "watch", "silent"].includes(participant.status) || Number(participant.openRiskSignalsCount || 0) > 0)
      .slice(0, 6)
      .map((participant) => ({
        id: participant.id,
        name: participant.name,
        status: participant.status,
        confidence: participant.status === "silent" ? "medium" : "high",
        evidence: [
          getStatusCopy(participant.status).label,
          Number(participant.openRiskSignalsCount || 0) > 0 ? `${participant.openRiskSignalsCount} открытых сигналов риска` : "",
          Number.isFinite(Number(participant.amplitude)) ? `амплитуда ${formatNumber(participant.amplitude)}` : "",
          `заполнение ${formatPercent(participant.completion)}`,
        ].filter(Boolean),
      })),
    blindSpots:
      Number(dashboard.completion || 0) < 50
        ? [
            {
              id: "low-coverage",
              title: "Мало данных",
              detail: "Заполнение низкое, поэтому факты лучше использовать как вопросы к группе.",
              confidence: "high",
            },
          ]
        : [],
  };
}

function DataStateBanner({ state }) {
  const copy = DATA_STATE_COPY[state];

  if (!copy) {
    return null;
  }

  return (
    <article className="curator-state-banner">
      <div>
        <p className="eyebrow">Состояние данных</p>
        <h3>{copy.title}</h3>
      </div>
      <p>{copy.description}</p>
    </article>
  );
}

function buildPulseSegments(points) {
  const segments = [];
  let current = [];

  for (const point of points) {
    if (point.value === null) {
      if (current.length) {
        segments.push(current);
        current = [];
      }
      continue;
    }

    current.push(point);
  }

  if (current.length) {
    segments.push(current);
  }

  return segments;
}

function buildPulsePath(points) {
  if (!points.length) {
    return "";
  }

  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }

  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
}

function PulseOfDayChart({ events = [] }) {
  const width = 980;
  const height = 360;
  const margin = { top: 38, right: 34, bottom: 108, left: 56 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const safeEvents = asArray(events);
  const maxIndex = Math.max(safeEvents.length - 1, 1);
  const points = safeEvents.map((event, index) => {
    const value = Number.isFinite(Number(event.averageStateLevel))
      ? Number(event.averageStateLevel)
      : null;
    const x = margin.left + (plotWidth / maxIndex) * index;
    const y =
      value === null
        ? margin.top + plotHeight
        : margin.top + ((PULSE_DOMAIN[1] - value) / (PULSE_DOMAIN[1] - PULSE_DOMAIN[0])) * plotHeight;

    return { ...event, value, x, y };
  });
  const segments = buildPulseSegments(points);
  const empty = !points.some((point) => point.value !== null);

  if (!safeEvents.length) {
    return (
      <div className="curator-chart-empty">
        Нет событий для построения пульса дня.
      </div>
    );
  }

  return (
    <div className="curator-pulse-shell">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="curator-pulse-chart"
        role="img"
        aria-label="Пульс дня по событиям группы"
      >
        <rect x={margin.left} y={margin.top} width={plotWidth} height={plotHeight / 3} className="pulse-zone zone-distress" />
        <rect x={margin.left} y={margin.top + plotHeight / 3} width={plotWidth} height={plotHeight / 3} className="pulse-zone zone-integration" />
        <rect x={margin.left} y={margin.top + (plotHeight / 3) * 2} width={plotWidth} height={plotHeight / 3} className="pulse-zone zone-burnout" />

        {[0, 1, 2, 3, 4, 5, 6].map((level) => {
          const y = margin.top + ((PULSE_DOMAIN[1] - level) / (PULSE_DOMAIN[1] - PULSE_DOMAIN[0])) * plotHeight;
          const state = getStateByLevel(level);

          return (
            <g key={level}>
              <line x1={margin.left} x2={width - margin.right} y1={y} y2={y} className="pulse-grid-line" />
              <text x={18} y={y + 4} className="pulse-axis-label">
                {state?.shortLabel || level}
              </text>
            </g>
          );
        })}

        {points.map((point) => (
          <line
            key={`rail-${point.id}`}
            x1={point.x}
            x2={point.x}
            y1={margin.top}
            y2={margin.top + plotHeight}
            className={point.value === null ? "pulse-event-rail is-empty" : "pulse-event-rail"}
          />
        ))}

        {segments.map((segment, index) => (
          <path key={`segment-${index}`} d={buildPulsePath(segment)} className="pulse-line" />
        ))}

        {points.map((point) => {
          const state = getStateByLevel(point.value);
          const radius = 9 + (Number(point.completion || 0) / 100) * 13;
          const hasRisk = Number(point.riskAnswersCount || 0) > 0;
          const hasSharpDelta = Number.isFinite(Number(point.deltaFromPrevious)) && Math.abs(Number(point.deltaFromPrevious)) >= 1.5;

          return (
            <g key={point.id} className="pulse-point-group">
              {point.value === null ? (
                <circle cx={point.x} cy={point.y} r="10" className="pulse-point is-empty" />
              ) : (
                <>
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={radius}
                    fill={state?.surface || "#f7f8f3"}
                    stroke={state?.color || "#8eab55"}
                    className={hasRisk ? "pulse-point has-risk" : "pulse-point"}
                  />
                  {hasSharpDelta ? (
                    <path
                      d={`M ${point.x - 8} ${point.y - radius - 12} L ${point.x + 8} ${point.y - radius - 12} L ${point.x} ${point.y - radius - 24} Z`}
                      className={Number(point.deltaFromPrevious) > 0 ? "pulse-delta is-up" : "pulse-delta is-down"}
                    />
                  ) : null}
                </>
              )}
              <title>
                {point.title}: {point.value === null ? "нет ответов" : `среднее ${formatNumber(point.value)}, заполнение ${formatPercent(point.completion)}`}
              </title>
            </g>
          );
        })}

        {points.map((point, index) => (
          <g key={`label-${point.id}`} transform={`translate(${point.x}, ${height - 82})`}>
            <text className="pulse-event-index" textAnchor="middle">
              {index + 1}
            </text>
            <text className="pulse-event-label" textAnchor="middle" y="20">
              {point.title.length > 18 ? `${point.title.slice(0, 18)}…` : point.title}
            </text>
            <text className="pulse-event-meta" textAnchor="middle" y="38">
              {point.completion ? formatPercent(point.completion) : "нет ответов"}
            </text>
          </g>
        ))}
      </svg>

      {empty ? (
        <div className="curator-chart-empty">
          Пульс построен по опубликованной программе, но участники пока не оставили отметок состояния.
        </div>
      ) : null}
    </div>
  );
}

function GroupScore({ participants = [], events = [] }) {
  const safeParticipants = asArray(participants);
  const safeEvents = asArray(events);

  if (!safeEvents.length) {
    return <div className="curator-chart-empty">Нет событий для партитуры группы.</div>;
  }

  if (!safeParticipants.length) {
    return <div className="curator-chart-empty">Нет участников для партитуры группы.</div>;
  }

  return (
    <div className="curator-score-wrap">
      <div
        className="curator-score-grid"
        style={{
          gridTemplateColumns: `minmax(190px, 1.2fr) repeat(${safeEvents.length}, minmax(72px, 1fr)) minmax(116px, 0.7fr)`,
        }}
      >
        <div className="curator-score-head">Участник</div>
        {safeEvents.map((event, index) => (
          <div key={event.id} className="curator-score-head" title={event.title}>
            {index + 1}
          </div>
        ))}
        <div className="curator-score-head">Заполнено</div>

        {safeParticipants.map((participant) => {
          const status = getStatusCopy(participant.status);

          return (
            <div key={participant.id} className="curator-score-row">
              <div className="curator-score-person">
                <strong>{participant.name}</strong>
                <span className={`status-pill ${status.className}`}>{status.label}</span>
              </div>

              {safeEvents.map((event) => {
                const point = participant.trajectory?.find((item) => item.eventId === event.id);
                const state = getStateByLevel(point?.stateLevel);

                if (!state) {
                  return (
                    <div key={event.id} className="curator-score-cell is-empty" title={`${event.title}: нет ответа`}>
                      <span>—</span>
                    </div>
                  );
                }

                return (
                  <div
                    key={event.id}
                    className="curator-score-cell"
                    style={{
                      background: state.surface,
                      borderColor: state.color,
                      color: state.textColor,
                    }}
                    title={`${event.title}: ${state.label}${point?.comment ? ` — ${point.comment}` : ""}`}
                  >
                    <strong>{state.level}</strong>
                  </div>
                );
              })}

              <div className="curator-score-progress">
                <strong>{formatPercent(participant.completion)}</strong>
                <span>{participant.answeredEvents}/{participant.totalEvents}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FactList({ title, eyebrow, items = [], emptyLabel, renderItem }) {
  return (
    <article className="panel-card curator-fact-card">
      <div className="panel-head">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h3>{title}</h3>
        </div>
      </div>

      {items.length ? (
        <div className="curator-fact-list">
          {items.map(renderItem)}
        </div>
      ) : (
        <p className="curator-empty-copy">{emptyLabel}</p>
      )}
    </article>
  );
}

function ConfidencePill({ confidence }) {
  return (
    <span className={`curator-confidence-pill is-${confidence || "medium"}`}>
      {getConfidenceLabel(confidence)}
    </span>
  );
}

function ReflectionBriefCard({ brief }) {
  const coverage = brief.coverage || {};
  const talkingPoints = asArray(brief.talkingPoints);
  const participantsToCheckIn = asArray(brief.participantsToCheckIn);
  const blindSpots = asArray(brief.blindSpots);

  return (
    <article className="panel-card curator-reflection-card">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Бриф к рефлексии</p>
          <h3>Что вынести в вечерний круг</h3>
        </div>
        <ConfidencePill confidence={coverage.confidence} />
      </div>

      <div className="curator-coverage-strip">
        <strong>{formatPercent(coverage.completion)}</strong>
        <span>{coverage.summary}</span>
      </div>

      <div className="curator-reflection-columns">
        <section className="curator-reflection-block">
          <h4>Темы для разговора</h4>
          {talkingPoints.length ? (
            <div className="curator-fact-list">
              {talkingPoints.map((point) => (
                <div key={point.id} className={`curator-fact-item ${getSeverityClass(point.severity)}`}>
                  <div className="curator-fact-title-row">
                    <strong>{point.title}</strong>
                    <ConfidencePill confidence={point.confidence} />
                  </div>
                  <p>{point.prompt}</p>
                  {asArray(point.evidence).length ? <span>{asArray(point.evidence).join("; ")}</span> : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="curator-empty-copy">Пока нет подтвержденных тем для выноса в круг.</p>
          )}
        </section>

        <section className="curator-reflection-block">
          <h4>Кого бережно проверить</h4>
          {participantsToCheckIn.length ? (
            <div className="curator-fact-list">
              {participantsToCheckIn.map((participant) => {
                const status = getStatusCopy(participant.status);
                return (
                  <div key={participant.id} className="curator-fact-item">
                    <div className="curator-fact-title-row">
                      <strong>{participant.name}</strong>
                      <span className={`status-pill ${status.className}`}>{status.label}</span>
                    </div>
                    <p>{asArray(participant.evidence).join("; ")}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="curator-empty-copy">Нет участников с подтвержденными сигналами для отдельной проверки.</p>
          )}
        </section>
      </div>

      {blindSpots.length ? (
        <div className="curator-blind-spots">
          <h4>Где не перегревать выводы</h4>
          {blindSpots.map((spot) => (
            <div key={spot.id} className="curator-blind-spot">
              <strong>{spot.title}</strong>
              <p>{spot.detail}</p>
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function SelectedParticipantCard({ participant, onClear }) {
  if (!participant) {
    return (
      <div className="curator-selected-participant is-empty">
        Нажмите на точку на карте, чтобы увидеть имя участника и краткие метрики.
      </div>
    );
  }

  const status = getStatusCopy(participant.status);

  return (
    <article className="curator-selected-participant">
      <div>
        <span className={`status-pill ${status.className}`}>{status.label}</span>
        <h3>{participant.name}</h3>
      </div>
      <div className="curator-selected-metrics">
        <MetricBadge label="Среднее" value={formatNumber(participant.average)} />
        <MetricBadge label="Амплитуда" value={formatNumber(participant.amplitude)} />
        <MetricBadge label="Заполнение" value={formatPercent(participant.completion)} />
        <MetricBadge label="Риски" value={`${participant.openRiskSignalsCount || 0}`} />
      </div>
      <p>
        Комментариев: {participant.commentsCount || 0}; событий заполнено: {participant.answeredEvents || 0}/{participant.totalEvents || 0}.
      </p>
      <button type="button" className="ghost-button curator-clear-selection" onClick={onClear}>
        Снять выбор
      </button>
    </article>
  );
}

const CURATOR_ZONE_SEGMENTS = [
  { id: "low", label: "Низкий ресурс", color: "#6e98d8" },
  { id: "mid", label: "Баланс", color: "#7dae42" },
  { id: "high", label: "Напряжение", color: "#d97757" },
];

function buildCuratorDistributionRows(events = [], participants = []) {
  return asArray(events).map((event) => {
    let low = 0;
    let mid = 0;
    let high = 0;

    for (const participant of asArray(participants)) {
      const point = asArray(participant.trajectory).find((item) => item.eventId === event.id);
      const level = Number(point?.stateLevel);
      if (!Number.isFinite(level)) {
        continue;
      }

      if (level <= 2) {
        low += 1;
      } else if (level === 3) {
        mid += 1;
      } else {
        high += 1;
      }
    }

    const total = low + mid + high;
    return {
      id: event.id,
      label: event.title,
      total,
      segments: CURATOR_ZONE_SEGMENTS.map((segment) => ({
        ...segment,
        value:
          segment.id === "low"
            ? low
            : segment.id === "mid"
              ? mid
              : high,
      })).filter((segment) => segment.value > 0),
    };
  }).filter((row) => row.total > 0);
}

function buildCuratorRiskEventRows(eventPulse = []) {
  return asArray(eventPulse)
    .filter((event) => Number(event.riskAnswersCount || 0) > 0)
    .map((event, index) => ({
      id: event.id,
      label: `${index + 1}`,
      value: Number(event.riskAnswersCount || 0),
      color: "#d97757",
    }));
}

function buildCuratorScatterData(participants = []) {
  return asArray(participants)
    .filter((participant) => Number.isFinite(Number(participant.average)))
    .map((participant, index) => ({
      id: participant.id,
      label: participant.name,
      shortLabel: participant.name?.slice(0, 2)?.toUpperCase() || `${index + 1}`,
      x: Number(participant.average),
      y: Number.isFinite(Number(participant.amplitude)) ? Number(participant.amplitude) : 0,
      size: Math.max(8, Number(participant.completion || 0)),
      status: participant.status,
      average: participant.average,
      amplitude: participant.amplitude,
      completion: participant.completion,
      commentsCount: participant.commentsCount,
      answeredEvents: participant.answeredEvents,
      totalEvents: participant.totalEvents,
      openRiskSignalsCount: participant.openRiskSignalsCount,
      color:
        participant.status === "risk"
          ? "#d97757"
          : participant.status === "watch"
            ? "#f4b84a"
            : participant.status === "silent"
              ? "#a4b2bb"
              : "#7dae42",
    }));
}

function CuratorDashboardView({ dashboard, initialSelectedParticipantId = null }) {
  const [selectedScatterId, setSelectedScatterId] = useState(initialSelectedParticipantId);
  const eventPulse = asArray(dashboard.eventPulse);
  const participantRows = asArray(dashboard.participantRows || dashboard.members);
  const events = asArray(dashboard.events);
  const reflectionPrep = dashboard.reflectionPrep || {};
  const focusEvents = asArray(reflectionPrep.focusEvents);
  const dayReflections = asArray(reflectionPrep.dayReflections);
  const commentClusters = asArray(reflectionPrep.commentClusters);
  const organizerBrief = asArray(dashboard.organizerBrief);
  const openRisks = asArray(reflectionPrep.openRisks);
  const distributionRows = buildCuratorDistributionRows(events, participantRows);
  const riskEventRows = buildCuratorRiskEventRows(eventPulse);
  const scatterData = buildCuratorScatterData(participantRows);
  const reflectionBrief =
    reflectionPrep.reflectionBrief ||
    buildReflectionBriefFallback({
      focusEvents,
      participantRows,
      openRisks,
      dashboard,
    });
  const selectedParticipant = participantRows.find((participant) => participant.id === selectedScatterId) || null;

  return (
    <section className="role-view curator-workspace">
      <div className="hero-card curator-hero-card">
        <div>
          <p className="eyebrow">Роль: куратор группы</p>
          <h2>{dashboard.groupName}: пульс дня</h2>
          <p className="subtle">
            Реальные отметки дневников превращены в рабочую карту для вечерней рефлексии, управления динамикой группы и живого разговора с организаторами.
          </p>
        </div>

        <div className="hero-stats">
          <MetricBadge label="Участников" value={`${dashboard.participantsCount || 0}`} />
          <MetricBadge label="Заполнение" value={formatPercent(dashboard.completion)} />
          <MetricBadge label="Средний пульс" value={formatNumber(dashboard.averageActivation)} />
          <MetricBadge label="Открытых рисков" value={`${openRisks.length}`} />
        </div>
      </div>

      <DataStateBanner state={dashboard.dataState} />

      <ReflectionBriefCard brief={reflectionBrief} />

      <article className="panel-card curator-pulse-card">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Пульс дня</p>
            <h3>Ритм событий, перегруз и восстановление</h3>
          </div>
          <span className="soft-pill">Куратор: {dashboard.curator}</span>
        </div>
        <PulseOfDayChart events={eventPulse} />
        <div className="curator-pulse-legend">
          <span><i className="legend-line" /> среднее состояние</span>
          <span><i className="legend-dot" /> размер точки = заполнение</span>
          <span><i className="legend-risk" /> обводка = ответы в зоне риска</span>
          <span><i className="legend-gap" /> разрыв = нет ответов</span>
        </div>
      </article>

      <RiskScatterChart
        title="Карта участников группы"
        description="Размер точки = заполнение, X = среднее состояние, Y = амплитуда дня."
        data={scatterData}
        emptyLabel="Нет траекторий участников для scatter-карты."
        selectedId={selectedScatterId}
        onPointClick={(item) => setSelectedScatterId((current) => (current === item.id ? null : item.id))}
        onClearSelection={() => setSelectedScatterId(null)}
      />
      <SelectedParticipantCard participant={selectedParticipant} onClear={() => setSelectedScatterId(null)} />

      <div className="curator-brief-grid curator-organizer-brief-grid">
        <FactList
          eyebrow="Организаторам"
          title="Сигналы для живого разговора"
          items={organizerBrief}
          emptyLabel="Нет подтверждённых сигналов для передачи организаторам."
          renderItem={(item) => (
            <div key={item.id} className={`curator-signal-card ${getSeverityClass(item.severity)}`}>
              <strong>{item.title}</strong>
              <p>{item.evidence}</p>
            </div>
          )}
        />
      </div>

      <article className="panel-card curator-score-card">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Партитура группы</p>
            <h3>Кто и как прошёл события дня</h3>
          </div>
          <span className="soft-pill is-outline">Пропуски остаются пустыми</span>
        </div>
        <GroupScore participants={participantRows} events={events} />
      </article>

      <div className="curator-brief-grid curator-secondary-analytics">
        <StackedDistributionChart
          title="Распределение состояний по событиям"
          description="Только реальные ответы группы: пропуски остаются пустыми и не маскируются нейтральным значением."
          rows={distributionRows}
          emptyLabel="Недостаточно ответов, чтобы собрать распределение по событиям."
        />
        <EventImpactBarChart
          title="События с риском"
          description="Высота столбца показывает, сколько ответов по событию попали в крайние зоны шкалы."
          data={riskEventRows}
          emptyLabel="Пока нет событий с ответами в зоне риска."
          positiveColor="#d97757"
          negativeColor="#d97757"
        />
      </div>

      <div className="curator-brief-grid curator-secondary-analytics">
        <FactList
          eyebrow="Дневная рефлексия"
          title="Факты по завершению дня"
          items={dayReflections}
          emptyLabel="Дневные рефлексии ещё не заполнены."
          renderItem={(day) => (
            <div key={day.id} className="curator-fact-item">
              <strong>{day.label}</strong>
              <span>{day.dateLabel || "Дата не задана"}</span>
              <p>
                Ответов: {day.responsesCount}; свободных комментариев: {day.freeTextCount}; заполненных полей: {day.answeredPromptsCount}
              </p>
              {day.excerpts?.length ? (
                <div className="curator-quote-stack">
                  {day.excerpts.map((excerpt) => (
                    <q key={excerpt}>{excerpt}</q>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        />

        <FactList
          eyebrow="Кластеры и отчёты"
          title="Что уже посчитано аналитикой"
          items={commentClusters}
          emptyLabel="Кластеры комментариев пока не рассчитаны."
          renderItem={(cluster) => (
            <div key={cluster.id || cluster.label} className="curator-fact-item">
              <strong>{cluster.label}</strong>
              <span>{cluster.count} связанных записей{cluster.score !== null ? ` · score ${formatNumber(cluster.score, 2)}` : ""}</span>
              {cluster.summary ? <p>{cluster.summary}</p> : null}
            </div>
          )}
        />
      </div>

      {reflectionPrep.aiReport ? (
        <article className="panel-card curator-ai-card">
          <div className="panel-head">
            <div>
              <p className="eyebrow">AI-отчёт</p>
              <h3>{reflectionPrep.aiReport.title}</h3>
            </div>
            <span className="confidence-tag">
              confidence: {reflectionPrep.aiReport.confidence}
            </span>
          </div>
          <div className="curator-fact-list">
            {asArray(reflectionPrep.aiReport.content?.bullets).map((item) => (
              <div key={item} className="curator-fact-item">
                <p>{item}</p>
              </div>
            ))}
            {reflectionPrep.aiReport.content?.recommendation ? (
              <div className="curator-fact-item is-accent">
                <strong>Рекомендация отчёта</strong>
                <p>{reflectionPrep.aiReport.content.recommendation}</p>
              </div>
            ) : null}
          </div>
        </article>
      ) : null}
    </section>
  );
}

export default CuratorDashboardView;
