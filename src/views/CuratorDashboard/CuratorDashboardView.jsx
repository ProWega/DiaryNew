import { useEffect, useState } from "react";
import { formatPercent } from "../../lib/format";
import {
  asArray,
  getSeverityClass,
  formatCuratorText,
  buildReflectionBriefFallback,
  getReportScopeLabel,
  DataStateBanner,
} from "./_helpers";
import { PulseOfDayChart } from "./PulseOfDayChart";
import { ReflectionBriefCard, FactList } from "./ReflectionBriefCard";
import { EventCommentsAndAiSection } from "./EventCommentsAndAiSection";
import MetricBadge from "../../components/MetricBadge";

// Phase 4.4 (methodology v4): RiskScatterChart / StackedDistributionChart /
// EventImpactBarChart / GroupScore / SelectedParticipantCard removed from this
// view per methodology rules 2 and 4. Their .jsx files stay in the repo as
// dead code for reference; new curator UX lives in src/views/CuratorBrief.
// См. methodology-mapping.md §2.5.

function CuratorDashboardView({ dashboard }) {
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
  const reflectionBrief =
    reflectionPrep.reflectionBrief ||
    buildReflectionBriefFallback({
      focusEvents,
      participantRows,
      openRisks,
      dashboard: scopedDashboard,
    });

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
              <span>{cluster.count} связанных записей</span>
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
