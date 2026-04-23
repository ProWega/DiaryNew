import { useEffect, useMemo, useRef, useState } from "react";
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

function createEventDraft(event, previousDraft = null) {
  return {
    stateId: previousDraft?.stateId || event?.stateId || "",
    comment: previousDraft?.isCommentDirty ? previousDraft.comment : event?.comment || "",
    confidence:
      previousDraft?.isConfidenceDirty ? previousDraft.confidence : event?.confidence || "high",
    isCommentDirty: Boolean(previousDraft?.isCommentDirty),
    isConfidenceDirty: Boolean(previousDraft?.isConfidenceDirty),
  };
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
  saveEventEntry,
  liveHistory,
  selectedDay,
  setSelectedHistoryDay,
  overallTrajectory,
  overallAverages,
  formatAverage,
}) {
  const [openEventId, setOpenEventId] = useState("");
  const [isReflectionStarted, setIsReflectionStarted] = useState(false);
  const [eventDrafts, setEventDrafts] = useState({});
  const [savingEventId, setSavingEventId] = useState("");
  const pendingStateSaveRef = useRef({});
  const activeDayId = selectedDay?.id || "";
  const hasMultipleDays = liveHistory.length > 1;
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
    setEventDrafts((previous) => {
      let hasChanges = Object.keys(previous).length !== todayEvents.length;
      const nextDrafts = {};

      for (const event of todayEvents) {
        const nextDraft = createEventDraft(event, previous[event.id]);
        nextDrafts[event.id] = nextDraft;

        if (
          !previous[event.id] ||
          previous[event.id].stateId !== nextDraft.stateId ||
          previous[event.id].comment !== nextDraft.comment ||
          previous[event.id].confidence !== nextDraft.confidence ||
          previous[event.id].isCommentDirty !== nextDraft.isCommentDirty ||
          previous[event.id].isConfidenceDirty !== nextDraft.isConfidenceDirty
        ) {
          hasChanges = true;
        }
      }

      return hasChanges ? nextDrafts : previous;
    });
  }, [todayEvents]);

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

  function getEventDraft(event) {
    return eventDrafts[event.id] || createEventDraft(event);
  }

  function hasPendingEventChanges(event, draft) {
    return (
      (draft.stateId || "") !== (event.stateId || "") ||
      draft.comment !== (event.comment || "") ||
      draft.confidence !== (event.confidence || "high")
    );
  }

  function queueStateSave(dayId, eventId, stateId) {
    const previousTask = pendingStateSaveRef.current[eventId] || Promise.resolve();
    const requestTask = previousTask
      .catch(() => null)
      .then(() => saveEventEntry(dayId, eventId, { stateId }));
    const trackedTask = requestTask.finally(() => {
      if (pendingStateSaveRef.current[eventId] === trackedTask) {
        delete pendingStateSaveRef.current[eventId];
      }
    });

    pendingStateSaveRef.current[eventId] = trackedTask;
    return trackedTask;
  }

  function handleEventStateSelect(dayId, event, stateId) {
    setEventDrafts((previous) => ({
      ...previous,
      [event.id]: {
        ...createEventDraft(event, previous[event.id]),
        stateId,
      },
    }));

    void queueStateSave(dayId, event.id, stateId).catch(() => null);
  }

  function handleEventCommentChange(event, comment) {
    setEventDrafts((previous) => ({
      ...previous,
      [event.id]: {
        ...createEventDraft(event, previous[event.id]),
        comment,
        isCommentDirty: comment !== (event.comment || ""),
      },
    }));
  }

  function handleEventConfidenceToggle(event) {
    setEventDrafts((previous) => {
      const currentDraft = createEventDraft(event, previous[event.id]);
      const nextConfidence = currentDraft.confidence === "low" ? "high" : "low";

      return {
        ...previous,
        [event.id]: {
          ...currentDraft,
          confidence: nextConfidence,
          isConfidenceDirty: nextConfidence !== (event.confidence || "high"),
        },
      };
    });
  }

  async function commitEventDraft(dayId, event, options = {}) {
    const { defaultToBalance = false, nextEventId = "" } = options;
    const draft = getEventDraft(event);
    const stateId = draft.stateId || event.stateId || (defaultToBalance ? "balance" : "");

    if (!stateId) {
      if (nextEventId) {
        setOpenEventId(nextEventId);
      }
      return false;
    }

    setSavingEventId(event.id);

    try {
      await (pendingStateSaveRef.current[event.id] || Promise.resolve());
      await saveEventEntry(dayId, event.id, {
        stateId,
        comment: draft.comment,
        confidence: draft.confidence || "high",
      });

      setEventDrafts((previous) => ({
        ...previous,
        [event.id]: {
          ...createEventDraft(event, previous[event.id]),
          stateId,
          comment: draft.comment,
          confidence: draft.confidence || "high",
          isCommentDirty: false,
          isConfidenceDirty: false,
        },
      }));

      if (nextEventId) {
        setOpenEventId(nextEventId);
      }
      return true;
    } catch (error) {
      console.error(error);
      return false;
    } finally {
      setSavingEventId((previous) => (previous === event.id ? "" : previous));
    }
  }

  function moveOpenEvent(dayId, event, index, direction) {
    const nextEvent = todayEvents[index + direction];

    if (!nextEvent) {
      return;
    }

    if (direction > 0) {
      void commitEventDraft(dayId, event, {
        defaultToBalance: true,
        nextEventId: nextEvent.id,
      });
      return;
    }

    if (hasPendingEventChanges(event, getEventDraft(event))) {
      void commitEventDraft(dayId, event, {
        nextEventId: nextEvent.id,
      });
      return;
    }

    setOpenEventId(nextEvent.id);
  }

  function saveCurrentEvent(dayId, event) {
    void commitEventDraft(dayId, event, {
      defaultToBalance: true,
    });
  }

  async function handleDaySwitch(nextDayId) {
    if (!nextDayId || nextDayId === activeDayId) {
      return;
    }

    if (openEvent && hasPendingEventChanges(openEvent, getEventDraft(openEvent))) {
      const didCommit = await commitEventDraft(activeDayId, openEvent, {
        defaultToBalance: true,
      });

      if (!didCommit) {
        return;
      }
    } else if (openEvent && pendingStateSaveRef.current[openEvent.id]) {
      try {
        await pendingStateSaveRef.current[openEvent.id];
      } catch (error) {
        console.error(error);
        return;
      }
    }

    setSelectedHistoryDay(nextDayId);
  }

  return (
    <section className="role-view participant-view">
      {mode === "today" ? (
        <div className="participant-layout">
          <div className="event-column participant-stepper">
            <div className="participant-flow-head">
              <div>
                <p className="eyebrow">Состояние</p>
                <h3>
                  {selectedDay?.label || "День"}{selectedDay?.dateLabel ? ` · ${selectedDay.dateLabel}` : ""}
                </h3>
                <p className="participant-flow-copy">
                  {openEventPosition ? `Событие ${openEventPosition} из ${todayEvents.length}. ` : ""}
                  Откройте карточку и выберите точку на шкале.
                </p>
              </div>
              {hasMultipleDays ? (
                <div className="participant-day-switcher" aria-label="Дни дневника">
                  {liveHistory.map((day) => (
                    <button
                      key={day.id}
                      type="button"
                      className={selectedDay?.id === day.id ? "mini-tab participant-day-tab is-active" : "mini-tab participant-day-tab"}
                      disabled={Boolean(savingEventId)}
                      onClick={() => void handleDaySwitch(day.id)}
                    >
                      <span>{day.label}</span>
                      <small>{day.dateLabel || "Без даты"}</small>
                    </button>
                  ))}
                </div>
              ) : null}
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
                const draft = getEventDraft(event);
                const effectiveStateId = draft.stateId || event.stateId || "";
                const effectiveState = effectiveStateId ? getStateInfo(effectiveStateId) : null;
                const effectiveConfidence = draft.confidence || "high";
                const hasStateSelection = Boolean(effectiveStateId);
                const hasDeferredDraftChanges =
                  draft.comment !== (event.comment || "") ||
                  effectiveConfidence !== (event.confidence || "high");
                const isEventSaving = savingEventId === event.id;
                const confidenceNote = isEventSaving
                  ? "\u0421\u043e\u0445\u0440\u0430\u043d\u044f\u0435\u043c \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u044f"
                  : hasDeferredDraftChanges
                    ? effectiveConfidence === "low"
                      ? "\u0418\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u044f \u0441\u043e\u0445\u0440\u0430\u043d\u044f\u0442\u0441\u044f \u043f\u0440\u0438 \u043f\u0435\u0440\u0435\u0445\u043e\u0434\u0435 \u0434\u0430\u043b\u044c\u0448\u0435. \u041e\u0446\u0435\u043d\u043a\u0430 \u0431\u0443\u0434\u0435\u0442 \u043e\u0442\u043c\u0435\u0447\u0435\u043d\u0430 \u043a\u0430\u043a \u043f\u0440\u0438\u043c\u0435\u0440\u043d\u0430\u044f"
                      : "\u0418\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u044f \u0441\u043e\u0445\u0440\u0430\u043d\u044f\u0442\u0441\u044f \u043f\u0440\u0438 \u043f\u0435\u0440\u0435\u0445\u043e\u0434\u0435 \u0434\u0430\u043b\u044c\u0448\u0435"
                    : effectiveConfidence === "low"
                      ? "\u041e\u0442\u043c\u0435\u0442\u043a\u0430 \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0430 \u043a\u0430\u043a \u043f\u0440\u0438\u043c\u0435\u0440\u043d\u0430\u044f"
                      : "\u041e\u0442\u043c\u0435\u0442\u043a\u0430 \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0430";
                const isOpen = event.id === openEventId;
                const panelId = `participant-event-panel-${event.id}`;
                const buttonId = `participant-event-button-${event.id}`;

                return (
                  <article
                    key={event.id}
                    className={`participant-event-shell ${isOpen ? "is-open" : "is-collapsed"} ${
                      effectiveState ? "is-complete" : "is-pending"
                    }`}
                  >
                    <button
                      id={buttonId}
                      type="button"
                      className={`participant-event-row participant-event-toggle ${effectiveState ? "is-complete" : "is-pending"} ${
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
                        {effectiveState ? (
                          <>
                            <span>{effectiveState.icon}</span>
                            {effectiveState.shortLabel || effectiveState.label}
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
                            value={effectiveStateId}
                            onChange={(stateId) => handleEventStateSelect(activeDayId, event, stateId)}
                            states={stateScale}
                            variant="arc"
                            animated
                            showDescriptions
                            label=""
                          />

                          <div className="participant-step-actions">
                            <button
                              type="button"
                              className="ghost-button"
                              disabled={index === 0 || isEventSaving}
                              onClick={() => moveOpenEvent(activeDayId, event, index, -1)}
                            >
                              Назад
                            </button>
                            <button
                              type="button"
                              className="primary-button participant-step-primary"
                              disabled={isEventSaving}
                              aria-label={
                                isEventSaving
                                  ? "\u0421\u043e\u0445\u0440\u0430\u043d\u044f\u0435\u043c"
                                  : index >= todayEvents.length - 1
                                    ? "\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c"
                                    : "\u0414\u0430\u043b\u0435\u0435"
                              }
                              data-step-label={
                                isEventSaving
                                  ? "\u0421\u043e\u0445\u0440\u0430\u043d\u044f\u0435\u043c..."
                                  : index >= todayEvents.length - 1
                                    ? "\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c"
                                    : "\u0414\u0430\u043b\u0435\u0435"
                              }
                              onClick={() =>
                                index >= todayEvents.length - 1
                                  ? saveCurrentEvent(activeDayId, event)
                                  : moveOpenEvent(activeDayId, event, index, 1)
                              }
                            >
                              Далее
                            </button>
                          </div>
                        </div>

                        {hasStateSelection ? (
                          <>
                            <div className="input-row participant-comment-row">
                              <textarea
                                rows="3"
                                value={draft.comment}
                                disabled={isEventSaving}
                                placeholder="Можно добавить пару слов, если хочется"
                                onChange={(eventInput) =>
                                  handleEventCommentChange(event, eventInput.target.value)
                                }
                              />
                            </div>

                            <div className="event-foot">
                              <button
                                type="button"
                                aria-pressed={effectiveConfidence === "low"}
                                disabled={isEventSaving}
                                className={effectiveConfidence === "low" ? "ghost-button is-active" : "ghost-button"}
                                onClick={() => handleEventConfidenceToggle(event)}
                              >
                                Сложно оценить
                              </button>
                              <span className="confidence-note participant-draft-note">{confidenceNote}</span>
                              <span className="confidence-note" aria-hidden="true">
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
                              setReflection(activeDayId, (previous) => ({
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
                          setReflection(activeDayId, (previous) => ({
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
                    disabled={Boolean(savingEventId)}
                    onClick={() => void handleDaySwitch(day.id)}
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
