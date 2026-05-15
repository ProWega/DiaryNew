import { asArray, getStatusCopy, getStateLabel, formatCuratorText } from "./_helpers";
import { formatPercent } from "../../lib/format";

const AI_SUMMARY_PLACEHOLDER = "ИИ-сводка появится после подключения аналитического контура.";

function getNumericMetric(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function getEventPulseMetrics(event, eventPulse = []) {
  return asArray(eventPulse).find((item) => item.id === event.id) || event || {};
}

function getParticipantEventPoint(participant, eventId) {
  return asArray(participant?.trajectory).find((point) => point.eventId === eventId) || null;
}

function getEventComments(event, participantRows = []) {
  return asArray(participantRows)
    .map((participant) => {
      const point = getParticipantEventPoint(participant, event.id);
      const comment = String(point?.comment || "").trim();

      if (!comment) {
        return null;
      }

      const status = getStatusCopy(participant.status);

      return {
        id: `${event.id}:${participant.id}`,
        participantName: participant.name || "Участник",
        statusLabel: status.label,
        statusClassName: status.className,
        stateLabel: getStateLabel(point?.stateLevel, "Состояние не указано"),
        comment,
      };
    })
    .filter(Boolean);
}

function buildEventCommentSections(events = [], eventPulse = [], participantRows = []) {
  return asArray(events).map((event) => ({
    event,
    pulse: getEventPulseMetrics(event, eventPulse),
    comments: getEventComments(event, participantRows),
  }));
}

function sumMetrics(items = [], getter) {
  return asArray(items).reduce((sum, item) => sum + getNumericMetric(getter(item)), 0);
}

function AiSummaryZone({ eyebrow, title, metrics = [], children, variant = "" }) {
  return (
    <section className={`curator-ai-zone ${variant ? `is-${variant}` : ""}`}>
      <div className="curator-ai-zone-head">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h4>{title}</h4>
        </div>
      </div>
      <div className="curator-ai-metrics">
        {asArray(metrics).map((metric) => (
          <div key={`${metric.label}-${metric.value}`} className="curator-comment-metric">
            <strong>{metric.value}</strong>
            <span>{metric.label}</span>
          </div>
        ))}
      </div>
      <p className="curator-ai-placeholder">{AI_SUMMARY_PLACEHOLDER}</p>
      {children}
    </section>
  );
}

export function EventCommentsAndAiSection({
  events,
  eventPulse,
  participantRows,
  dayReflections,
  openRisks,
  dashboard,
}) {
  const sections = buildEventCommentSections(events, eventPulse, participantRows);
  const commentsCount = sumMetrics(sections, (section) => section.comments.length);
  const dayReflectionResponses = sumMetrics(dayReflections, (day) => day.responsesCount);
  const dayReflectionFreeText = sumMetrics(dayReflections, (day) => day.freeTextCount);
  const dayReflectionAnsweredPrompts = sumMetrics(
    dayReflections,
    (day) => day.answeredPromptsCount,
  );
  const reflectionExcerpts = asArray(dayReflections)
    .flatMap((day) => asArray(day.excerpts))
    .slice(0, 4);
  const eventPulseRows = asArray(eventPulse);
  const eventsWithResponses = eventPulseRows.filter(
    (event) => event.hasResponses || getNumericMetric(event.answersCount) > 0,
  ).length;
  const eventCommentsCount = sumMetrics(eventPulseRows, (event) => event.commentsCount);
  const progress = dashboard?.progress || {};

  return (
    <article className="panel-card curator-comments-card">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Комментарии</p>
          <h3>Комментарии по событиям и зоны ИИ-сводок</h3>
          <p className="subtle">
            Рабочий срез для чтения ответов участников: события идут в порядке программы, а рядом
            уже подготовлены зоны для будущих аналитических сводок.
          </p>
        </div>
        <span className="soft-pill is-outline">{commentsCount} комментариев</span>
      </div>

      <div className="curator-comments-layout">
        <section className="curator-event-comments-column" aria-label="Комментарии по событиям дня">
          {sections.length ? (
            sections.map(({ event, pulse, comments }, index) => {
              const answersCount = getNumericMetric(pulse.answersCount);
              const pulseCommentsCount = Number.isFinite(Number(pulse.commentsCount))
                ? Number(pulse.commentsCount)
                : comments.length;
              const riskAnswersCount = getNumericMetric(pulse.riskAnswersCount);

              return (
                <div key={event.id} className="curator-comment-event">
                  <div className="curator-comment-event-head">
                    <div>
                      <span className="curator-comment-event-index">#{index + 1}</span>
                      <h4>
                        {event.title}
                        {pulse.isParallel ? (
                          <span
                            className="soft-pill is-parallel"
                            title="Параллельный блок — заполненность считается от тех, кто выбрал этот блок"
                          >
                            ⚡ {pulse.parallelGroup || ""}
                          </span>
                        ) : null}
                      </h4>
                      <p className="curator-comment-event-meta">
                        {[event.timeLabel, event.type].filter(Boolean).join(" · ") ||
                          "Время и тип не указаны"}
                      </p>
                    </div>
                  </div>

                  <div className="curator-comment-metrics">
                    <div className="curator-comment-metric">
                      <strong>{formatPercent(pulse.completion)}</strong>
                      <span>заполненность</span>
                    </div>
                    {pulse.isParallel ? (
                      <div
                        className="curator-comment-metric is-parallel-selection"
                        title="Сколько участников выбрали именно этот параллельный блок из общего состава группы"
                      >
                        <strong>
                          {getNumericMetric(pulse.selectedCount)}/
                          {getNumericMetric(pulse.groupTotal)}
                        </strong>
                        <span>выбрали блок</span>
                      </div>
                    ) : null}
                    <div className="curator-comment-metric">
                      <strong>{answersCount}</strong>
                      <span>ответов</span>
                    </div>
                    <div className="curator-comment-metric">
                      <strong>{pulseCommentsCount}</strong>
                      <span>комментариев</span>
                    </div>
                    <div className="curator-comment-metric">
                      <strong>{riskAnswersCount}</strong>
                      <span>риск-ответов</span>
                    </div>
                  </div>

                  <div className="curator-comment-list">
                    {comments.length ? (
                      comments.map((comment) => (
                        <div key={comment.id} className="curator-comment-row">
                          <div className="curator-comment-author">
                            <strong>{comment.participantName}</strong>
                            <span className={`status-pill ${comment.statusClassName}`}>
                              {comment.statusLabel}
                            </span>
                          </div>
                          <span className="curator-comment-state">{comment.stateLabel}</span>
                          <blockquote>{comment.comment}</blockquote>
                        </div>
                      ))
                    ) : (
                      <p className="curator-empty-copy">
                        По этому событию пока нет текстовых комментариев. Метрики заполненности
                        остаются видимыми.
                      </p>
                    )}
                  </div>

                  <AiSummaryZone
                    eyebrow="ИИ-зона"
                    title="ИИ-сводка по событию"
                    variant="event"
                    metrics={[
                      { label: "заполненность", value: formatPercent(pulse.completion) },
                      { label: "ответов", value: answersCount },
                      { label: "комментариев", value: pulseCommentsCount },
                      { label: "риск-ответов", value: riskAnswersCount },
                    ]}
                  />
                </div>
              );
            })
          ) : (
            <p className="curator-empty-copy">
              В выбранном срезе нет событий для группировки комментариев.
            </p>
          )}
        </section>

        <aside className="curator-ai-side" aria-label="Зоны ИИ-сводок по дню">
          <AiSummaryZone
            eyebrow="ИИ-зона"
            title="ИИ-сводка итоговой рефлексии дня"
            metrics={[
              { label: "ответов", value: dayReflectionResponses },
              { label: "свободных комментариев", value: dayReflectionFreeText },
              { label: "заполненных полей", value: dayReflectionAnsweredPrompts },
            ]}
          >
            {reflectionExcerpts.length ? (
              <div className="curator-quote-stack">
                {reflectionExcerpts.map((excerpt) => (
                  <q key={excerpt}>{excerpt}</q>
                ))}
              </div>
            ) : (
              <p className="curator-empty-copy">
                Итоговая рефлексия дня пока без текстовых фрагментов.
              </p>
            )}
          </AiSummaryZone>

          <AiSummaryZone
            eyebrow="ИИ-зона"
            title="ИИ-сводка дня в целом"
            metrics={[
              {
                label: "заполнение",
                value: formatPercent(dashboard?.completion ?? progress.completion),
              },
              { label: "участников", value: getNumericMetric(dashboard?.participantsCount) },
              {
                label: "событий с ответами",
                value: `${eventsWithResponses}/${eventPulseRows.length}`,
              },
              { label: "открытых рисков", value: asArray(openRisks).length },
              { label: "комментариев", value: eventCommentsCount },
              {
                label: "ответов событий",
                value: `${getNumericMetric(progress.answeredEvents)}/${getNumericMetric(progress.totalEvents)}`,
              },
            ]}
          />
        </aside>
      </div>
    </article>
  );
}
