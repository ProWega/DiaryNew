import { useEffect, useState } from "react";
import {
  EventImpactBarChart,
  RiskScatterChart,
  StackedDistributionChart,
} from "../../components/Charts";
import { formatPercent, formatNumber } from "../../lib/format";
import {
  asArray,
  getStatusCopy,
  getSeverityClass,
  formatCuratorText,
  formatAverageState,
  getEventShortLabel,
  getStateByLevel,
  buildReflectionBriefFallback,
  getReportScopeLabel,
  DataStateBanner,
} from "./_helpers";
import { PulseOfDayChart } from "./PulseOfDayChart";
import { GroupScore } from "./GroupScore";
import { ReflectionBriefCard, FactList } from "./ReflectionBriefCard";
import { SelectedParticipantCard } from "./SelectedParticipantCard";
import { EventCommentsAndAiSection } from "./EventCommentsAndAiSection";
import MetricBadge from "../../components/MetricBadge";

const CURATOR_ZONE_SEGMENTS = [
  { id: "low", label: "Низкий ресурс", color: "#4f5759" },
  { id: "mid", label: "Баланс", color: "#78733d" },
  { id: "high", label: "Напряжение", color: "#c95c36" },
];

function buildCuratorDistributionRows(events = [], participants = []) {
  return asArray(events)
    .map((event) => {
      let low = 0;
      let mid = 0;
      let high = 0;

      for (const participant of asArray(participants)) {
        const point = asArray(participant.trajectory).find((item) => item.eventId === event.id);
        const level = Number(point?.stateLevel);
        if (!Number.isFinite(level)) {
          continue;
        }

        if (level <= 1) {
          low += 1;
        } else if (level >= 5) {
          high += 1;
        } else {
          mid += 1;
        }
      }

      const total = low + mid + high;
      return {
        id: event.id,
        label: event.title,
        total,
        segments: CURATOR_ZONE_SEGMENTS.map((segment) => ({
          ...segment,
          value: segment.id === "low" ? low : segment.id === "mid" ? mid : high,
        })).filter((segment) => segment.value > 0),
      };
    })
    .filter((row) => row.total > 0);
}

function buildCuratorRiskEventRows(eventPulse = []) {
  return asArray(eventPulse)
    .filter((event) => Number(event.riskAnswersCount || 0) > 0)
    .map((event) => ({
      id: event.id,
      label: getEventShortLabel(event),
      value: Number(event.riskAnswersCount || 0),
      color: "#6b1f2a",
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
      xValueLabel: formatAverageState(participant.average),
      yValueLabel: formatNumber(participant.amplitude),
      completion: participant.completion,
      commentsCount: participant.commentsCount,
      answeredEvents: participant.answeredEvents,
      totalEvents: participant.totalEvents,
      openRiskSignalsCount: participant.openRiskSignalsCount,
      color:
        participant.status === "risk"
          ? "#6b1f2a"
          : participant.status === "watch"
            ? "#9a7a32"
            : participant.status === "silent"
              ? "#4f5759"
              : "#78733d",
    }));
}

function CuratorDashboardView({ dashboard, initialSelectedParticipantId = null }) {
  const [selectedScatterId, setSelectedScatterId] = useState(initialSelectedParticipantId);
  const reportScopes = asArray(dashboard.reportScopes);
  const [selectedScopeId, setSelectedScopeId] = useState(reportScopes[0]?.scopeId || "all");

  useEffect(() => {
    if (reportScopes.length && !reportScopes.some((scope) => scope.scopeId === selectedScopeId)) {
      setSelectedScopeId(reportScopes[0].scopeId);
    }
  }, [reportScopes, selectedScopeId]);

  const activeReportScope =
    reportScopes.find((scope) => scope.scopeId === selectedScopeId) || reportScopes[0] || null;
  const scopedDashboard = activeReportScope ? { ...dashboard, ...activeReportScope } : dashboard;
  const eventPulse = asArray(scopedDashboard.eventPulse);
  const participantRows = asArray(scopedDashboard.participantRows || scopedDashboard.members);
  const events = asArray(scopedDashboard.events);
  const reflectionPrep = scopedDashboard.reflectionPrep || {};
  const focusEvents = asArray(reflectionPrep.focusEvents);
  const dayReflections = asArray(reflectionPrep.dayReflections);
  const commentClusters = asArray(reflectionPrep.commentClusters);
  const organizerBrief = asArray(scopedDashboard.organizerBrief);
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
      dashboard: scopedDashboard,
    });
  const selectedParticipant =
    participantRows.find((participant) => participant.id === selectedScatterId) || null;

  return (
    <section className="role-view curator-workspace">
      <div className="hero-card curator-hero-card">
        <div>
          <p className="eyebrow">Роль: куратор группы</p>
          <h2>{dashboard.groupName}: пульс дня</h2>
          <p className="subtle">
            Реальные отметки дневников превращены в рабочую карту для вечерней рефлексии, управления
            динамикой группы и живого разговора с организаторами.
          </p>
        </div>

        <div className="hero-stats">
          <MetricBadge label="Участников" value={`${scopedDashboard.participantsCount || 0}`} />
          <MetricBadge label="Заполнение" value={formatPercent(scopedDashboard.completion)} />
          <MetricBadge
            label="Средний пульс"
            value={formatAverageState(scopedDashboard.averageActivation)}
          />
          <MetricBadge label="Открытых рисков" value={`${openRisks.length}`} />
        </div>
      </div>

      {reportScopes.length > 1 ? (
        <article className="panel-card curator-scope-card">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Отчетный срез</p>
              <h3>{getReportScopeLabel(scopedDashboard)}</h3>
            </div>
            <span className="soft-pill is-outline">{events.length} событий</span>
          </div>
          <div className="curator-scope-tabs" role="tablist" aria-label="Отчеты по дням">
            {reportScopes.map((scope) => (
              <button
                key={scope.scopeId}
                type="button"
                role="tab"
                aria-selected={scope.scopeId === scopedDashboard.scopeId}
                className={
                  scope.scopeId === scopedDashboard.scopeId ? "mini-tab is-active" : "mini-tab"
                }
                onClick={() => setSelectedScopeId(scope.scopeId)}
              >
                <span>{getReportScopeLabel(scope)}</span>
              </button>
            ))}
          </div>
        </article>
      ) : null}

      <DataStateBanner state={scopedDashboard.dataState} />

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
          <span>
            <i className="legend-line" /> среднее состояние
          </span>
          <span>
            <i className="legend-dot" /> размер точки = заполнение
          </span>
          <span>
            <i className="legend-risk" /> обводка = ответы в зоне риска
          </span>
          <span>
            <i className="legend-gap" /> разрыв = нет ответов
          </span>
        </div>
      </article>

      <EventCommentsAndAiSection
        events={events}
        eventPulse={eventPulse}
        participantRows={participantRows}
        dayReflections={dayReflections}
        openRisks={openRisks}
        dashboard={scopedDashboard}
      />

      <RiskScatterChart
        title="Карта участников группы"
        description="Размер точки = заполнение, X = среднее состояние, Y = амплитуда дня."
        data={scatterData}
        emptyLabel="Нет траекторий участников для scatter-карты."
        selectedId={selectedScatterId}
        onPointClick={(item) =>
          setSelectedScatterId((current) => (current === item.id ? null : item.id))
        }
        onClearSelection={() => setSelectedScatterId(null)}
      />
      <SelectedParticipantCard
        participant={selectedParticipant}
        onClear={() => setSelectedScatterId(null)}
      />

      <div className="curator-brief-grid curator-organizer-brief-grid">
        <FactList
          eyebrow="Организаторам"
          title="Сигналы для живого разговора"
          items={organizerBrief}
          emptyLabel="Нет подтверждённых сигналов для передачи организаторам."
          renderItem={(item) => (
            <div key={item.id} className={`curator-signal-card ${getSeverityClass(item.severity)}`}>
              <strong>{item.title}</strong>
              <p>{formatCuratorText(item.evidence)}</p>
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
          positiveColor="#6b1f2a"
          negativeColor="#6b1f2a"
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
                Ответов: {day.responsesCount}; свободных комментариев: {day.freeTextCount};
                заполненных полей: {day.answeredPromptsCount}
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
              <span>
                {cluster.count} связанных записей
                {cluster.score !== null ? ` · score ${formatNumber(cluster.score, 2)}` : ""}
              </span>
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
            <span className="confidence-tag">confidence: {reflectionPrep.aiReport.confidence}</span>
          </div>
          <div className="curator-fact-list">
            {asArray(reflectionPrep.aiReport.content?.bullets).map((item) => (
              <div key={item} className="curator-fact-item">
                <p>{formatCuratorText(item)}</p>
              </div>
            ))}
            {reflectionPrep.aiReport.content?.recommendation ? (
              <div className="curator-fact-item is-accent">
                <strong>Рекомендация отчёта</strong>
                <p>{formatCuratorText(reflectionPrep.aiReport.content.recommendation)}</p>
              </div>
            ) : null}
          </div>
        </article>
      ) : null}
    </section>
  );
}

export default CuratorDashboardView;
