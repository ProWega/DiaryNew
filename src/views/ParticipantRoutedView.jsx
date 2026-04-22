import { useEffect, useMemo, useState } from "react";
import { DistributionBars, EmotionLineChart } from "../components/Charts";
import MetricBadge from "../components/MetricBadge";
import StateScalePicker from "../components/participant/StateScalePicker";
import { getStateInfo, getStateLevel } from "../lib/metrics";

const reflectionFields = ["q1", "q2", "q3"];

function getFirstPendingEventId(events) {
  return events.find((event) => !event.stateId)?.id || events[0]?.id || "";
}

function isReflectionAnswered(reflection) {
  return ["q1", "q2", "q3", "freeText"].some((field) =>
    String(reflection?.[field] || "").trim(),
  );
}

function ParticipantRoutedView({
  mode,
  stateScale,
  reflectionPrompts,
  todayEvents,
  todayMetrics,
  todayPortrait,
  reflection,
  setReflection,
  updateEventState,
  updateEventComment,
  updateEventConfidence,
  liveHistory,
  selectedDay,
  setSelectedHistoryDay,
  overallTrajectory,
  overallAverages,
  formatAverage,
}) {
  const [openEventId, setOpenEventId] = useState("");
  const [isReflectionStarted, setIsReflectionStarted] = useState(false);
  const todayChartEvents = todayEvents.filter((event) => event.answered !== false && event.stateId);
  const selectedChartEvents = (selectedDay?.events || []).filter((event) => event.answered !== false && event.stateId);
  const defaultOpenEventId = useMemo(() => getFirstPendingEventId(todayEvents), [todayEvents]);
  const openEvent = todayEvents.find((event) => event.id === openEventId) || null;
  const openEventIndex = todayEvents.findIndex((event) => event.id === openEvent?.id);
  const answeredEventCount = todayEvents.filter((event) => Boolean(event.stateId)).length;
  const reflectionAnswered = isReflectionAnswered(reflection);
  const allEventsAnswered = todayEvents.length > 0 && answeredEventCount === todayEvents.length;
  const showReflectionForm = reflectionAnswered || (allEventsAnswered && isReflectionStarted);
  const checklistTotal = todayEvents.length + 1;
  const checklistAnswered = answeredEventCount + (reflectionAnswered ? 1 : 0);
  const completionValue = Math.max(0, Math.min(todayMetrics.completion || 0, 100));
  const openEventPosition = openEventIndex >= 0 ? openEventIndex + 1 : 0;

  useEffect(() => {
    setOpenEventId((previous) => {
      if (todayEvents.some((event) => event.id === previous)) {
        return previous;
      }

      return defaultOpenEventId;
    });
  }, [defaultOpenEventId, todayEvents]);

  useEffect(() => {
    if (reflectionAnswered) {
      setIsReflectionStarted(true);
    }
  }, [reflectionAnswered]);

  useEffect(() => {
    if (!allEventsAnswered && !reflectionAnswered) {
      setIsReflectionStarted(false);
    }
  }, [allEventsAnswered, reflectionAnswered]);

  function toggleEvent(eventId) {
    const nextEventId = openEventId === eventId ? "" : eventId;

    setOpenEventId(nextEventId);
  }

  function moveOpenEvent(direction) {
    const currentIndex =
      openEventIndex >= 0
        ? openEventIndex
        : Math.max(
            todayEvents.findIndex((event) => event.id === defaultOpenEventId),
            0,
          );
    const nextEvent = todayEvents[currentIndex + direction];

    if (nextEvent) {
      setOpenEventId(nextEvent.id);
    }
  }

  return (
    <section className="role-view participant-view">
      {mode === "today" ? (
        <div className="participant-layout">
          <div className="event-column participant-stepper">
            <div className="participant-flow-head">
              <div>
                <p className="eyebrow">Состояние</p>
                <h3>{openEventPosition ? `Событие ${openEventPosition} из ${todayEvents.length}` : "Выберите событие"}</h3>
                <p className="participant-flow-copy">
                  Откройте карточку и выберите точку на шкале.
                </p>
              </div>
              <div className="participant-progress-meter" aria-label={`Заполнено ${completionValue}%`}>
                <span style={{ width: `${completionValue}%` }} />
              </div>
              <div className="participant-progress-meta">
                <span>{answeredEventCount} из {todayEvents.length} событий</span>
                <span>{checklistAnswered} из {checklistTotal} пунктов дня</span>
              </div>
            </div>

            <div className="participant-event-list">
              {todayEvents.map((event, index) => {
                const isOpen = event.id === openEventId;
                const state = event.stateId ? getStateInfo(event.stateId) : null;
                const panelId = `participant-event-panel-${event.id}`;
                const buttonId = `participant-event-button-${event.id}`;

                return (
                  <article
                    key={event.id}
                    className={`participant-event-shell ${isOpen ? "is-open" : "is-collapsed"} ${
                      state ? "is-complete" : "is-pending"
                    }`}
                  >
                    <button
                      id={buttonId}
                      type="button"
                      className={`participant-event-row participant-event-toggle ${state ? "is-complete" : "is-pending"} ${
                        isOpen ? "is-open" : ""
                      }`}
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      aria-label={`${isOpen ? "Свернуть" : "Открыть"} событие: ${event.title}`}
                      onClick={() => toggleEvent(event.id)}
                    >
                      <span className="participant-event-index">{index + 1}</span>
                      <span className="participant-event-row-main">
                        <span className="event-time">{event.time}</span>
                        <strong>{event.title}</strong>
                        <small>{event.type}</small>
                      </span>
                      <span className="participant-event-row-state">
                        {state ? (
                          <>
                            <span>{state.icon}</span>
                            {state.shortLabel || state.label}
                          </>
                        ) : (
                          "Без отметки"
                        )}
                      </span>
                      <span className="participant-event-row-action" aria-hidden="true">
                        {isOpen ? "Свернуть" : "Открыть"}
                      </span>
                    </button>

                    <div
                      id={panelId}
                      role="region"
                      aria-labelledby={buttonId}
                      aria-hidden={!isOpen}
                      className="participant-event-panel"
                      {...(!isOpen ? { inert: "" } : {})}
                    >
                      <div className="event-card participant-event-card participant-event-panel-inner">
                        <div className="event-head participant-active-head">
                          <div>
                            <p className="participant-event-microcopy">
                              {event.stateId ? "Можно уточнить отметку или добавить заметку." : "Выберите точку на шкале."}
                            </p>
                            <h3>{event.title}</h3>
                            <p>{event.type}</p>
                          </div>
                          <div className="tag-row">
                            {(event.tags || []).map((tag) => (
                              <span key={tag} className="tag-chip">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="participant-event-workspace">
                          <StateScalePicker
                            value={event.stateId}
                            onChange={(stateId) => updateEventState(event.id, stateId)}
                            states={stateScale}
                            variant="arc"
                            animated
                            showDescriptions
                            label="Как вы сейчас после события?"
                          />

                          <div className="participant-step-actions">
                            <button
                              type="button"
                              className="ghost-button"
                              disabled={index === 0}
                              onClick={() => moveOpenEvent(-1)}
                            >
                              Назад
                            </button>
                            <button
                              type="button"
                              className="primary-button"
                              disabled={index >= todayEvents.length - 1}
                              onClick={() => moveOpenEvent(1)}
                            >
                              Далее
                            </button>
                          </div>
                        </div>

                        {event.stateId ? (
                          <>
                            <div className="input-row participant-comment-row">
                              <textarea
                                rows="3"
                                value={event.comment}
                                placeholder="Можно добавить пару слов, если хочется"
                                onChange={(eventInput) =>
                                  updateEventComment(event.id, eventInput.target.value)
                                }
                              />
                            </div>

                            <div className="event-foot">
                              <button
                                type="button"
                                aria-pressed={event.confidence === "low"}
                                className={event.confidence === "low" ? "ghost-button is-active" : "ghost-button"}
                                onClick={() => updateEventConfidence(event.id)}
                              >
                                Сложно оценить
                              </button>
                              <span className="confidence-note">
                                {event.confidence === "low" ? "Отметка сохранена как примерная" : "Отметка сохранена"}
                              </span>
                            </div>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="insight-column">
            <article className="panel-card participant-summary-card">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">Итог дня</p>
                  <h3>{completionValue}% заполнено</h3>
                </div>
                <MetricBadge compact label="Средний уровень" value={formatAverage(todayMetrics.average)} />
              </div>
              <div className="participant-progress-meter is-large" aria-label={`Заполнено ${completionValue}%`}>
                <span style={{ width: `${completionValue}%` }} />
              </div>
              <div className="participant-progress-meta">
                <span>{answeredEventCount} из {todayEvents.length} событий</span>
                <span>Рефлексия: {reflectionAnswered ? "учтена" : "не заполнена"}</span>
              </div>
            </article>

            <article
              className={`panel-card participant-reflection-card ${
                showReflectionForm ? "is-open" : allEventsAnswered ? "is-ready" : "is-locked"
              }`}
            >
              {!showReflectionForm && !allEventsAnswered ? (
                <div className="participant-reflection-gate">
                  <div>
                    <p className="eyebrow">Итог дня</p>
                    <h3>Итог дня откроется после отметок</h3>
                    <p>Сначала завершите события, потом спокойно подведите итог.</p>
                  </div>
                  <span className="confidence-tag">{answeredEventCount} из {todayEvents.length}</span>
                </div>
              ) : null}

              {!showReflectionForm && allEventsAnswered ? (
                <div className="participant-reflection-ritual">
                  <div>
                    <p className="eyebrow">Итог дня</p>
                    <h3>Сделайте паузу на минуту</h3>
                    <p>Когда будете готовы, откройте короткую рефлексию и завершите день.</p>
                  </div>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => setIsReflectionStarted(true)}
                  >
                    Открыть итог дня
                  </button>
                </div>
              ) : null}

              {showReflectionForm ? (
                <>
                  <div className="panel-head">
                    <div>
                      <p className="eyebrow">Итог дня</p>
                      <h3>Короткое завершение</h3>
                    </div>
                    <span className="confidence-tag">{reflectionAnswered ? "учтена" : "черновик"}</span>
                  </div>

                  <div className="reflection-list participant-reflection-list">
                    {reflectionPrompts.map((prompt, index) => {
                      const field = reflectionFields[index] || `q${index + 1}`;

                      return (
                        <label key={prompt} className="reflection-item">
                          <span>{prompt}</span>
                          <textarea
                            rows="2"
                            value={reflection[field]}
                            placeholder="Напишите 1–2 предложения"
                            onChange={(event) =>
                              setReflection((previous) => ({
                                ...previous,
                                [field]: event.target.value,
                              }))
                            }
                          />
                        </label>
                      );
                    })}

                    <label className="reflection-item">
                      <span>Дополнить, если важно</span>
                      <textarea
                        rows="4"
                        value={reflection.freeText}
                        placeholder="Что ещё важно зафиксировать?"
                        onChange={(event) =>
                          setReflection((previous) => ({
                            ...previous,
                            freeText: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>
                </>
              ) : null}
            </article>

            <details className="panel-card participant-analytics-drawer">
              <summary>
                <div>
                  <span className="eyebrow">Подробности</span>
                  <strong>Графики и автосводка</strong>
                </div>
                <span className="soft-pill is-outline">{todayChartEvents.length} отметок</span>
              </summary>

              <div className="participant-analytics-stack">
                <div className="participant-analytics-block">
                  <EmotionLineChart
                    title="Карта эмоций дня"
                    values={todayChartEvents.map((event) => getStateLevel(event.stateId))}
                    labels={todayChartEvents.map((event) => event.title)}
                  />
                </div>

                <div className="participant-analytics-block tone-card">
                  <div className="panel-head">
                    <div>
                      <p className="eyebrow">Психологический портрет дня</p>
                      <h3>Автосводка по текущим отметкам</h3>
                    </div>
                    <span className="confidence-tag">confidence: medium</span>
                  </div>

                  <ul className="bullet-list">
                    {todayPortrait.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div className="participant-analytics-block">
                  <DistributionBars
                    title="Дневной профиль по шкале"
                    items={todayMetrics.distribution}
                    total={todayChartEvents.length}
                  />
                </div>
              </div>
            </details>
          </div>
        </div>
      ) : null}

      {mode === "dynamics" ? (
        <div className="dynamics-layout">
          <div className="panel-card">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Траектория по заезду</p>
                <h3>Моя динамика за 3 дня форума</h3>
              </div>
              <div className="tab-row">
                {liveHistory.map((day) => (
                  <button
                    key={day.id}
                    type="button"
                    className={selectedDay.id === day.id ? "mini-tab is-active" : "mini-tab"}
                    onClick={() => setSelectedHistoryDay(day.id)}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>

            <EmotionLineChart
              title={selectedDay.dateLabel}
              values={selectedChartEvents.map((event) => getStateLevel(event.stateId))}
              labels={selectedChartEvents.map((event) => event.title)}
            />
          </div>

          <div className="dynamics-side">
            <article className="panel-card">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">Три дня одним взглядом</p>
                  <h3>Средние значения по дням</h3>
                </div>
              </div>

              <EmotionLineChart
                compact
                bands={false}
                values={overallAverages.map((item) => item.value)}
                labels={overallAverages.map((item) => item.day)}
              />
            </article>

            <article className="panel-card">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">Краткий вывод</p>
                  <h3>{selectedDay.label}</h3>
                </div>
              </div>
              <p className="lead-text">{selectedDay.insight}</p>
              <ul className="bullet-list">
                {selectedDay.aiHighlights.map((highlight) => (
                  <li key={highlight}>{highlight}</li>
                ))}
              </ul>
            </article>
          </div>

          <div className="panel-card stretch-card">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Детализация</p>
                <h3>Точки роста и просадки</h3>
              </div>
              <span className="confidence-tag">ИИ-подсказка для участника</span>
            </div>

            <div className="trajectory-grid">
              {overallTrajectory.map((step) => {
                const state = getStateInfo(step.stateId);

                return (
                  <div key={step.label} className="trajectory-step">
                    <span
                      className="trajectory-icon"
                      style={{
                        background: state.surface,
                        borderColor: state.color,
                      }}
                    >
                      {state.icon}
                    </span>
                    <div>
                      <strong>{step.label}</strong>
                      <p>{state.label}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default ParticipantRoutedView;
