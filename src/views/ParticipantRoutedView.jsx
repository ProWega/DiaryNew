import { useEffect, useMemo, useRef, useState } from "react";
import { DistributionBars, EmotionLineChart } from "../components/Charts";
import MetricBadge from "../components/MetricBadge";
import StateScalePicker from "../components/participant/StateScalePicker";
import ReflectionEditor from "../components/methodology/ReflectionEditor";
import { getStateInfo, getStateLevel } from "../lib/metrics";

const reflectionFields = ["q1", "q2"];
const METHODOLOGY_AXES = ["mind", "heart", "will"];

function hasLegacyReflectionContent(reflection) {
  return ["q1", "q2", "q3"].some((field) => String(reflection?.[field] || "").trim());
}

function hasMethodologyAxisContent(reflection) {
  return METHODOLOGY_AXES.some((axis) => String(reflection?.[axis] || "").trim());
}
const EVENT_SCROLL_MARGIN = 16;

function getFirstPendingEventId(events) {
  const availableEvents = events.filter((event) => !isEventLocked(event));
  return (
    availableEvents.find((event) => !event.stateId)?.id ||
    availableEvents[0]?.id ||
    events[0]?.id ||
    ""
  );
}

function isEventLocked(event) {
  return Boolean(event?.access?.locked);
}

function getNextAvailableEvent(events, index, direction) {
  for (
    let nextIndex = index + direction;
    nextIndex >= 0 && nextIndex < events.length;
    nextIndex += direction
  ) {
    if (!isEventLocked(events[nextIndex])) {
      return events[nextIndex];
    }
  }

  return null;
}

function formatEventAccessReason(event) {
  const access = event?.access || {};

  if (access.availableAt) {
    const availableAt = new Date(access.availableAt);
    if (!Number.isNaN(availableAt.getTime())) {
      return `Откроется ${availableAt.toLocaleString("ru-RU", {
        timeZone: "Europe/Moscow",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      })}.`;
    }
  }

  return access.reason || "Оценка откроется, когда событие начнётся по программе.";
}

function prefersReducedMotion() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getStickyParticipantOffset() {
  if (typeof document === "undefined") {
    return EVENT_SCROLL_MARGIN;
  }

  const topbarHeight =
    document.querySelector(".participant-topbar")?.getBoundingClientRect().height || 0;
  return topbarHeight + EVENT_SCROLL_MARGIN;
}

function focusElementWithoutScroll(element) {
  if (!element || typeof element.focus !== "function") {
    return;
  }

  try {
    element.focus({ preventScroll: true });
  } catch {
    element.focus();
  }
}

function scrollEventIntoView(element, options = {}) {
  if (typeof window === "undefined" || !element) {
    return;
  }

  const offset = options.offset ?? getStickyParticipantOffset();
  const targetTop = Math.max(0, window.scrollY + element.getBoundingClientRect().top - offset);

  if (Math.abs(window.scrollY - targetTop) < 4) {
    return;
  }

  window.scrollTo({
    top: targetTop,
    behavior: prefersReducedMotion() ? "auto" : "smooth",
  });
}

function isReflectionAnswered(reflection) {
  const answers =
    reflection?.answers && typeof reflection.answers === "object" ? reflection.answers : {};
  return (
    [...reflectionFields, ...METHODOLOGY_AXES, "freeText"].some((field) =>
      String(reflection?.[field] || "").trim(),
    ) || Object.values(answers).some((value) => String(value || "").trim())
  );
}

function safeReflectionQuestions(value = []) {
  return Array.isArray(value)
    ? value.filter((question) => question?.id && String(question.text || "").trim())
    : [];
}

function safeReflectionAnswers(value = {}) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function hasMissingRequiredAnswers(questions = [], answers = {}) {
  return safeReflectionQuestions(questions).some(
    (question) => question.required && !String(answers[question.id] || "").trim(),
  );
}

function isHelpTomorrowPrompt(prompt) {
  const normalizedPrompt = String(prompt || "").toLowerCase();

  return normalizedPrompt.includes("помощ") && normalizedPrompt.includes("завтра");
}

function createEventDraft(event, previousDraft = null) {
  const previousAnswers = safeReflectionAnswers(previousDraft?.reflectionAnswers);
  const eventAnswers = safeReflectionAnswers(event?.reflectionAnswers);
  return {
    stateId: previousDraft?.stateId || event?.stateId || "",
    comment: previousDraft?.isCommentDirty ? previousDraft.comment : event?.comment || "",
    reflectionAnswers: previousDraft?.isReflectionAnswersDirty ? previousAnswers : eventAnswers,
    confidence: previousDraft?.isConfidenceDirty
      ? previousDraft.confidence
      : event?.confidence || "high",
    isCommentDirty: Boolean(previousDraft?.isCommentDirty),
    isReflectionAnswersDirty: Boolean(previousDraft?.isReflectionAnswersDirty),
    isConfidenceDirty: Boolean(previousDraft?.isConfidenceDirty),
  };
}

function getSaveErrorMessage(error) {
  return error?.message || "Не удалось сохранить отметку. Попробуйте выбрать состояние ещё раз.";
}

const STATE_SCALE_VARIANT_OPTIONS = [
  { id: "arc-5", label: "Дуга" },
  { id: "emoji-5", label: "Эмодзи" },
  { id: "slider-5", label: "Слайдер" },
];
const STATE_SCALE_VARIANT_DEFAULT = "arc-5";
const STATE_SCALE_VARIANT_IDS = STATE_SCALE_VARIANT_OPTIONS.map((opt) => opt.id);

function getStateScaleVariantStorageKey(userId) {
  return userId ? `newdiary-state-scale-variant-${userId}` : "";
}

function readStoredStateScaleVariant(userId) {
  if (typeof window === "undefined") return STATE_SCALE_VARIANT_DEFAULT;
  const key = getStateScaleVariantStorageKey(userId);
  if (!key) return STATE_SCALE_VARIANT_DEFAULT;
  try {
    const raw = window.localStorage.getItem(key);
    return STATE_SCALE_VARIANT_IDS.includes(raw) ? raw : STATE_SCALE_VARIANT_DEFAULT;
  } catch {
    return STATE_SCALE_VARIANT_DEFAULT;
  }
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
  journeyStage = null,
  isCarefulMode = false,
  userId = "",
}) {
  const [openEventId, setOpenEventId] = useState("");
  const [isReflectionStarted, setIsReflectionStarted] = useState(false);
  const [isProgrammaticNavigation, setIsProgrammaticNavigation] = useState(false);
  const [eventDrafts, setEventDrafts] = useState({});
  const [eventSaveStatuses, setEventSaveStatuses] = useState({});
  const [savingEventId, setSavingEventId] = useState("");
  const [stateScaleVariant, setStateScaleVariant] = useState(() =>
    readStoredStateScaleVariant(userId),
  );

  useEffect(() => {
    setStateScaleVariant(readStoredStateScaleVariant(userId));
  }, [userId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = getStateScaleVariantStorageKey(userId);
    if (!key) return;
    try {
      window.localStorage.setItem(key, stateScaleVariant);
    } catch {
      // ignore quota / private mode failures
    }
  }, [stateScaleVariant, userId]);
  const pendingStateSaveRef = useRef({});
  const eventShellRefs = useRef({});
  const eventButtonRefs = useRef({});
  const pendingNavigationRef = useRef(null);
  const navigationFrameRef = useRef(0);
  const activeDayId = selectedDay?.id || "";
  const hasMultipleDays = liveHistory.length > 1;
  const todayChartEvents = todayEvents.filter((event) => event.answered !== false && event.stateId);
  const selectedChartEvents = (selectedDay?.events || []).filter(
    (event) => event.answered !== false && event.stateId,
  );
  const defaultOpenEventId = useMemo(() => getFirstPendingEventId(todayEvents), [todayEvents]);
  const visibleReflectionPrompts = useMemo(
    () =>
      (reflectionPrompts || [])
        .filter((prompt) => !isHelpTomorrowPrompt(prompt))
        .slice(0, reflectionFields.length),
    [reflectionPrompts],
  );
  const dayReflectionQuestions = useMemo(
    () => safeReflectionQuestions(selectedDay?.reflectionQuestions),
    [selectedDay?.reflectionQuestions],
  );
  const openEvent = todayEvents.find((event) => event.id === openEventId) || null;
  const openEventIndex = todayEvents.findIndex((event) => event.id === openEvent?.id);
  const answeredEventCount = todayEvents.filter((event) => Boolean(event.stateId)).length;
  const reflectionAnswered =
    isReflectionAnswered(reflection) &&
    !hasMissingRequiredAnswers(dayReflectionQuestions, safeReflectionAnswers(reflection.answers));
  const allEventsAnswered = todayEvents.length > 0 && answeredEventCount === todayEvents.length;
  const showReflectionForm = reflectionAnswered || (allEventsAnswered && isReflectionStarted);
  const hasDayRequiredReflectionGap =
    showReflectionForm &&
    hasMissingRequiredAnswers(dayReflectionQuestions, safeReflectionAnswers(reflection.answers));
  const showArchivedReflection =
    hasLegacyReflectionContent(reflection) && !hasMethodologyAxisContent(reflection);
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

  useEffect(
    () => () => {
      if (typeof window !== "undefined" && navigationFrameRef.current) {
        window.cancelAnimationFrame(navigationFrameRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    const pendingNavigation = pendingNavigationRef.current;

    if (
      !pendingNavigation ||
      pendingNavigation.eventId !== openEventId ||
      typeof window === "undefined"
    ) {
      return;
    }

    if (navigationFrameRef.current) {
      window.cancelAnimationFrame(navigationFrameRef.current);
    }

    navigationFrameRef.current = window.requestAnimationFrame(() => {
      navigationFrameRef.current = window.requestAnimationFrame(() => {
        const latestNavigation = pendingNavigationRef.current;

        if (!latestNavigation || latestNavigation.eventId !== openEventId) {
          navigationFrameRef.current = 0;
          setIsProgrammaticNavigation(false);
          return;
        }

        const button = eventButtonRefs.current[openEventId];
        const scrollTarget = eventShellRefs.current[openEventId] || button;

        if (latestNavigation.shouldFocus) {
          focusElementWithoutScroll(button);
        }

        if (latestNavigation.shouldScroll) {
          scrollEventIntoView(scrollTarget);
        }

        pendingNavigationRef.current = null;
        navigationFrameRef.current = 0;
        setIsProgrammaticNavigation(false);
      });
    });
  }, [activeDayId, openEventId, todayEvents.length]);

  function setEventShellRef(eventId, node) {
    if (node) {
      eventShellRefs.current[eventId] = node;
      return;
    }

    delete eventShellRefs.current[eventId];
  }

  function setEventButtonRef(eventId, node) {
    if (node) {
      eventButtonRefs.current[eventId] = node;
      return;
    }

    delete eventButtonRefs.current[eventId];
  }

  function openEventWithViewportSync(eventId, options = {}) {
    if (!eventId) {
      pendingNavigationRef.current = null;
      setOpenEventId("");
      return;
    }

    pendingNavigationRef.current = {
      eventId,
      shouldFocus: options.shouldFocus ?? true,
      shouldScroll: options.shouldScroll ?? true,
    };
    setIsProgrammaticNavigation(Boolean(options.shouldScroll ?? true));
    setOpenEventId(eventId);
  }

  function toggleEvent(eventId) {
    const nextEventId = openEventId === eventId ? "" : eventId;

    pendingNavigationRef.current = null;
    setOpenEventId(nextEventId);
  }

  function getEventDraft(event) {
    return eventDrafts[event.id] || createEventDraft(event);
  }

  function hasPendingEventChanges(event, draft) {
    return (
      (draft.stateId || "") !== (event.stateId || "") ||
      draft.comment !== (event.comment || "") ||
      JSON.stringify(safeReflectionAnswers(draft.reflectionAnswers)) !==
        JSON.stringify(safeReflectionAnswers(event.reflectionAnswers)) ||
      draft.confidence !== (event.confidence || "high")
    );
  }

  function queueStateSave(dayId, event, stateId) {
    const previousTask = pendingStateSaveRef.current[event.id] || Promise.resolve();
    setEventSaveStatuses((previous) => ({
      ...previous,
      [event.id]: { status: "saving", message: "Сохраняем отметку..." },
    }));

    const requestTask = previousTask
      .catch(() => null)
      .then(() => saveEventEntry(dayId, event.id, { stateId, allowIncompleteReflection: true }))
      .then((result) => {
        setEventSaveStatuses((previous) => ({
          ...previous,
          [event.id]: { status: "saved", message: "Отметка сохранена" },
        }));
        return result;
      })
      .catch((error) => {
        setEventSaveStatuses((previous) => ({
          ...previous,
          [event.id]: { status: "error", message: getSaveErrorMessage(error) },
        }));
        throw error;
      });
    const trackedTask = requestTask.finally(() => {
      if (pendingStateSaveRef.current[event.id] === trackedTask) {
        delete pendingStateSaveRef.current[event.id];
      }
    });

    pendingStateSaveRef.current[event.id] = trackedTask;
    return trackedTask;
  }

  function rollbackEventStateDraft(event) {
    setEventDrafts((previous) => {
      const currentDraft = createEventDraft(event, previous[event.id]);

      return {
        ...previous,
        [event.id]: {
          ...currentDraft,
          stateId: event.stateId || "",
        },
      };
    });
  }

  function handleEventStateSelect(dayId, event, stateId) {
    if (isEventLocked(event)) {
      return;
    }

    setEventDrafts((previous) => ({
      ...previous,
      [event.id]: {
        ...createEventDraft(event, previous[event.id]),
        stateId,
      },
    }));

    void queueStateSave(dayId, event, stateId).catch((error) => {
      console.error(error);
      rollbackEventStateDraft(event);
    });
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

  function handleEventReflectionAnswerChange(event, questionId, value) {
    setEventDrafts((previous) => {
      const currentDraft = createEventDraft(event, previous[event.id]);
      const nextAnswers = {
        ...safeReflectionAnswers(currentDraft.reflectionAnswers),
        [questionId]: value,
      };

      return {
        ...previous,
        [event.id]: {
          ...currentDraft,
          reflectionAnswers: nextAnswers,
          isReflectionAnswersDirty:
            JSON.stringify(nextAnswers) !==
            JSON.stringify(safeReflectionAnswers(event.reflectionAnswers)),
        },
      };
    });
  }

  async function commitEventDraft(dayId, event, options = {}) {
    if (isEventLocked(event)) {
      return false;
    }

    const { defaultToBalance = false, nextEventId = "" } = options;
    const draft = getEventDraft(event);
    const stateId = draft.stateId || event.stateId || (defaultToBalance ? "balance" : "");
    const reflectionAnswers = safeReflectionAnswers(draft.reflectionAnswers);

    if (!stateId) {
      if (nextEventId) {
        openEventWithViewportSync(nextEventId);
      }
      return false;
    }

    if (hasMissingRequiredAnswers(event.reflectionQuestions, reflectionAnswers)) {
      return false;
    }

    setSavingEventId(event.id);

    try {
      await (pendingStateSaveRef.current[event.id] || Promise.resolve());
      await saveEventEntry(dayId, event.id, {
        stateId,
        comment: draft.comment,
        reflectionAnswers,
        confidence: draft.confidence || "high",
      });

      setEventDrafts((previous) => ({
        ...previous,
        [event.id]: {
          ...createEventDraft(event, previous[event.id]),
          stateId,
          comment: draft.comment,
          reflectionAnswers,
          confidence: draft.confidence || "high",
          isCommentDirty: false,
          isReflectionAnswersDirty: false,
          isConfidenceDirty: false,
        },
      }));

      if (nextEventId) {
        openEventWithViewportSync(nextEventId);
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
    const nextEvent = getNextAvailableEvent(todayEvents, index, direction);

    if (!nextEvent) {
      return;
    }

    if (direction > 0) {
      void commitEventDraft(dayId, event, {
        defaultToBalance: true,
      });
      openEventWithViewportSync(nextEvent.id);
      return;
    }

    if (hasPendingEventChanges(event, getEventDraft(event))) {
      void commitEventDraft(dayId, event, {
        nextEventId: nextEvent.id,
      });
      return;
    }

    openEventWithViewportSync(nextEvent.id);
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
        <div
          className={
            isProgrammaticNavigation
              ? "participant-layout is-programmatic-navigation"
              : "participant-layout"
          }
        >
          <div className="event-column participant-stepper">
            <div className="participant-flow-head">
              <div>
                <p className="eyebrow">Состояние</p>
                <h3>
                  {selectedDay?.label || "День"}
                  {selectedDay?.dateLabel ? ` · ${selectedDay.dateLabel}` : ""}
                </h3>
                <p className="participant-flow-copy">
                  {openEventPosition
                    ? `Событие ${openEventPosition} из ${todayEvents.length}. `
                    : ""}
                  Откройте карточку и выберите точку на шкале.
                </p>
              </div>
              {hasMultipleDays ? (
                <div className="participant-day-switcher" aria-label="Дни дневника">
                  {liveHistory.map((day) => (
                    <button
                      key={day.id}
                      type="button"
                      className={
                        selectedDay?.id === day.id
                          ? "mini-tab participant-day-tab is-active"
                          : "mini-tab participant-day-tab"
                      }
                      disabled={Boolean(savingEventId)}
                      onClick={() => void handleDaySwitch(day.id)}
                    >
                      <span>{day.label}</span>
                      <small>{day.dateLabel || "Без даты"}</small>
                    </button>
                  ))}
                </div>
              ) : null}
              <div
                className="participant-progress-meter"
                aria-label={`Заполнено ${completionValue}%`}
              >
                <span style={{ width: `${completionValue}%` }} />
              </div>
              <div className="participant-progress-meta">
                <span>
                  {answeredEventCount} из {todayEvents.length} событий
                </span>
                <span>
                  {checklistAnswered} из {checklistTotal} пунктов дня
                </span>
              </div>
            </div>

            <div className="participant-event-list">
              {todayEvents.map((event, index) => {
                const draft = getEventDraft(event);
                const effectiveStateId = draft.stateId || event.stateId || "";
                const effectiveState = effectiveStateId ? getStateInfo(effectiveStateId) : null;
                const hasStateSelection = Boolean(effectiveStateId);
                const eventReflectionQuestions = safeReflectionQuestions(event.reflectionQuestions);
                const eventReflectionAnswers = safeReflectionAnswers(draft.reflectionAnswers);
                const hasRequiredReflectionGap =
                  hasStateSelection &&
                  hasMissingRequiredAnswers(eventReflectionQuestions, eventReflectionAnswers);
                const hasDeferredDraftChanges =
                  draft.comment !== (event.comment || "") ||
                  JSON.stringify(eventReflectionAnswers) !==
                    JSON.stringify(safeReflectionAnswers(event.reflectionAnswers));
                const stateSaveStatus = eventSaveStatuses[event.id] || null;
                const isStateSaving = stateSaveStatus?.status === "saving";
                const isEventSaving = savingEventId === event.id || isStateSaving;
                const isLocked = isEventLocked(event);
                const previousAvailableEvent = getNextAvailableEvent(todayEvents, index, -1);
                const nextAvailableEvent = getNextAvailableEvent(todayEvents, index, 1);
                const confidenceNote = isEventSaving
                  ? "\u0421\u043e\u0445\u0440\u0430\u043d\u044f\u0435\u043c \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u044f"
                  : hasDeferredDraftChanges
                    ? "\u0418\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u044f \u0441\u043e\u0445\u0440\u0430\u043d\u044f\u0442\u0441\u044f \u043f\u0440\u0438 \u043f\u0435\u0440\u0435\u0445\u043e\u0434\u0435 \u0434\u0430\u043b\u044c\u0448\u0435"
                    : "\u041e\u0442\u043c\u0435\u0442\u043a\u0430 \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0430";
                const isOpen = event.id === openEventId;
                const panelId = `participant-event-panel-${event.id}`;
                const buttonId = `participant-event-button-${event.id}`;

                return (
                  <article
                    key={event.id}
                    ref={(node) => setEventShellRef(event.id, node)}
                    className={`participant-event-shell ${isOpen ? "is-open" : "is-collapsed"} ${
                      effectiveState ? "is-complete" : "is-pending"
                    } ${isLocked ? "is-locked" : ""}`}
                  >
                    <button
                      id={buttonId}
                      ref={(node) => setEventButtonRef(event.id, node)}
                      type="button"
                      className={`participant-event-row participant-event-toggle ${effectiveState ? "is-complete" : "is-pending"} ${
                        isOpen ? "is-open" : ""
                      } ${isLocked ? "is-locked" : ""}`}
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      aria-label={`${isOpen ? "Свернуть" : "Открыть"} событие: ${event.title}`}
                      aria-disabled={isLocked}
                      onClick={() => toggleEvent(event.id)}
                    >
                      <span className="participant-event-index">{index + 1}</span>
                      <span className="participant-event-row-main">
                        <strong>{event.title}</strong>
                        <small>{event.type}</small>
                      </span>
                      <span className="participant-event-row-meta">
                        <span className="event-time participant-event-row-time">{event.time}</span>
                        <span className="participant-event-row-state">
                          {isLocked ? (
                            <>
                              <span className="participant-event-row-lock" aria-hidden="true">
                                🔒
                              </span>
                              Закрыто
                            </>
                          ) : effectiveState ? (
                            <>
                              <span>{effectiveState.icon}</span>
                              {effectiveState.shortLabel || effectiveState.label}
                            </>
                          ) : (
                            "Без отметки"
                          )}
                        </span>
                      </span>
                      <span
                        className={
                          isOpen
                            ? "participant-event-row-chevron is-open"
                            : "participant-event-row-chevron"
                        }
                        aria-hidden="true"
                      >
                        <span className="participant-event-chevron" />
                      </span>
                    </button>

                    <div
                      id={panelId}
                      role="region"
                      aria-labelledby={buttonId}
                      aria-hidden={!isOpen}
                      className="participant-event-panel"
                      {...(!isOpen ? { inert: true } : {})}
                    >
                      <div className="participant-event-body">
                        {isLocked ? (
                          <div className="participant-event-locked">
                            <span className="participant-event-locked-icon" aria-hidden="true">
                              🔒
                            </span>
                            <div>
                              <strong>Оценка пока закрыта</strong>
                              <p>{formatEventAccessReason(event)}</p>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="participant-event-workspace">
                              <div className="participant-event-arc-shell">
                                <details className="participant-state-variant-toggle">
                                  <summary>
                                    Вид шкалы:{" "}
                                    {STATE_SCALE_VARIANT_OPTIONS.find(
                                      (opt) => opt.id === stateScaleVariant,
                                    )?.label || ""}
                                  </summary>
                                  <div
                                    className="participant-state-variant-tabs"
                                    role="tablist"
                                    aria-label="Вид шкалы состояния"
                                  >
                                    {STATE_SCALE_VARIANT_OPTIONS.map((option) => (
                                      <button
                                        key={option.id}
                                        type="button"
                                        role="tab"
                                        aria-selected={stateScaleVariant === option.id}
                                        className={
                                          stateScaleVariant === option.id
                                            ? "mini-tab is-active"
                                            : "mini-tab"
                                        }
                                        onClick={() => setStateScaleVariant(option.id)}
                                      >
                                        {option.label}
                                      </button>
                                    ))}
                                  </div>
                                </details>
                                <StateScalePicker
                                  value={effectiveStateId}
                                  onChange={(stateId) =>
                                    handleEventStateSelect(activeDayId, event, stateId)
                                  }
                                  states={stateScale}
                                  variant={stateScaleVariant}
                                  animated
                                  showDescriptions
                                  label=""
                                />
                                {stateSaveStatus?.message ? (
                                  <p
                                    className={`participant-event-save-note is-${stateSaveStatus.status}`}
                                    role={stateSaveStatus.status === "error" ? "alert" : "status"}
                                  >
                                    {stateSaveStatus.message}
                                  </p>
                                ) : null}
                              </div>

                              <div className="participant-step-actions">
                                <button
                                  type="button"
                                  className="ghost-button"
                                  disabled={!previousAvailableEvent || isEventSaving}
                                  onClick={() => moveOpenEvent(activeDayId, event, index, -1)}
                                >
                                  Назад
                                </button>
                                <button
                                  type="button"
                                  className={`primary-button participant-step-primary ${
                                    !nextAvailableEvent ? "is-final" : ""
                                  }`}
                                  disabled={isEventSaving || hasRequiredReflectionGap}
                                  aria-label={
                                    isEventSaving
                                      ? "\u0421\u043e\u0445\u0440\u0430\u043d\u044f\u0435\u043c"
                                      : !nextAvailableEvent
                                        ? "\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c"
                                        : "\u0414\u0430\u043b\u0435\u0435"
                                  }
                                  data-step-label={
                                    isEventSaving
                                      ? "\u0421\u043e\u0445\u0440\u0430\u043d\u044f\u0435\u043c..."
                                      : !nextAvailableEvent
                                        ? "\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c"
                                        : "\u0414\u0430\u043b\u0435\u0435"
                                  }
                                  onClick={() =>
                                    !nextAvailableEvent
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
                                {eventReflectionQuestions.length ? (
                                  <div className="reflection-list participant-event-reflection-list">
                                    {eventReflectionQuestions.map((question) => (
                                      <label key={question.id} className="reflection-item">
                                        <span>
                                          {question.text}
                                          {question.required ? " *" : ""}
                                        </span>
                                        <textarea
                                          rows="2"
                                          value={eventReflectionAnswers[question.id] || ""}
                                          disabled={isEventSaving}
                                          placeholder="Напишите 1–2 предложения"
                                          aria-required={question.required}
                                          onChange={(eventInput) =>
                                            handleEventReflectionAnswerChange(
                                              event,
                                              question.id,
                                              eventInput.target.value,
                                            )
                                          }
                                        />
                                      </label>
                                    ))}
                                  </div>
                                ) : (
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
                                )}

                                {hasRequiredReflectionGap ? (
                                  <p
                                    className="confidence-note participant-required-note"
                                    role="alert"
                                  >
                                    Ответьте на обязательные вопросы, чтобы продолжить.
                                  </p>
                                ) : null}

                                <div className="event-foot">
                                  <span className="confidence-note participant-draft-note">
                                    {confidenceNote}
                                  </span>
                                  <span className="confidence-note" aria-hidden="true">
                                    Отметка сохранена
                                  </span>
                                </div>
                              </>
                            ) : null}
                          </>
                        )}
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
                <MetricBadge
                  compact
                  label="Средний уровень"
                  value={formatAverage(todayMetrics.average)}
                />
              </div>
              <div
                className="participant-progress-meter is-large"
                aria-label={`Заполнено ${completionValue}%`}
              >
                <span style={{ width: `${completionValue}%` }} />
              </div>
              <div className="participant-progress-meta">
                <span>
                  {answeredEventCount} из {todayEvents.length} событий
                </span>
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
                  <span className="confidence-tag">
                    {answeredEventCount} из {todayEvents.length}
                  </span>
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
                    <span className="confidence-tag">
                      {reflectionAnswered ? "учтена" : "черновик"}
                    </span>
                  </div>

                  <div className="reflection-list participant-reflection-list">
                    {showArchivedReflection ? (
                      <div className="reflection-archived" aria-label="Архивная запись">
                        <p className="eyebrow">Архивная запись (формат прошлого заезда)</p>
                        {visibleReflectionPrompts.map((prompt, index) => {
                          const field = reflectionFields[index] || `q${index + 1}`;
                          const answer = String(reflection[field] || "");
                          return (
                            <div key={prompt} className="reflection-item is-archived">
                              <span>{prompt}</span>
                              <p className="reflection-archived-answer">
                                {answer.trim() ? answer : "—"}
                              </p>
                            </div>
                          );
                        })}
                        {String(reflection.freeText || "").trim() ? (
                          <div className="reflection-item is-archived">
                            <span>Дополнить, если важно</span>
                            <p className="reflection-archived-answer">{reflection.freeText}</p>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <>
                        <ReflectionEditor
                          value={{
                            mind: reflection.mind || "",
                            heart: reflection.heart || "",
                            will: reflection.will || "",
                            freeText: reflection.freeText || "",
                          }}
                          journeyStage={journeyStage}
                          isCarefulMode={isCarefulMode}
                          onChange={(next) =>
                            setReflection(activeDayId, (previous) => ({
                              ...previous,
                              ...next,
                            }))
                          }
                        />

                        {dayReflectionQuestions.length ? (
                          <details className="participant-reflection-extra">
                            <summary>
                              Дополнительные вопросы от организатора
                              {hasDayRequiredReflectionGap ? " · есть обязательные" : ""}
                            </summary>
                            {dayReflectionQuestions.map((question) => {
                              const answers = safeReflectionAnswers(reflection.answers);
                              return (
                                <label key={question.id} className="reflection-item">
                                  <span>
                                    {question.text}
                                    {question.required ? " *" : ""}
                                  </span>
                                  <textarea
                                    rows="2"
                                    value={answers[question.id] || ""}
                                    placeholder="Напишите 1–2 предложения"
                                    aria-required={question.required}
                                    onChange={(event) =>
                                      setReflection(activeDayId, (previous) => ({
                                        ...previous,
                                        answers: {
                                          ...safeReflectionAnswers(previous.answers),
                                          [question.id]: event.target.value,
                                        },
                                      }))
                                    }
                                  />
                                </label>
                              );
                            })}
                            {hasDayRequiredReflectionGap ? (
                              <p className="confidence-note participant-required-note" role="alert">
                                Ответьте на обязательные вопросы, чтобы итог дня считался
                                заполненным.
                              </p>
                            ) : null}
                          </details>
                        ) : null}
                      </>
                    )}
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
                    <span className="confidence-tag">ориентировочная сводка</span>
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
