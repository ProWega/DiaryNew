import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useParticipantDiary } from "../api/hooks";
import { useAuth } from "../auth/AuthContext";
import FeedbackState from "../components/FeedbackState";
import { buildPortrait, calculateMetrics, formatAverage } from "../lib/metrics";
import { selectClosestProgramDay } from "../lib/programDays";
import ParticipantRoutedView from "../views/ParticipantRoutedView";
import ParticipantSelfKnowledgeView from "../views/ParticipantSelfKnowledgeView";

function getParticipantDayStorageKey(sessionId) {
  return sessionId ? `participant:selected-day:${sessionId}` : "";
}

function readStoredSelectedDay(sessionId) {
  if (typeof window === "undefined") {
    return "";
  }

  const storageKey = getParticipantDayStorageKey(sessionId);
  if (!storageKey) {
    return "";
  }

  try {
    return window.localStorage.getItem(storageKey) || "";
  } catch {
    return "";
  }
}

function getNextEventUnlockDelay(history) {
  const now = Date.now();
  const unlockTimes = history
    .flatMap((day) => day.events || [])
    .filter((event) => event.access?.locked && event.access?.availableAt)
    .map((event) => new Date(event.access.availableAt).getTime())
    .filter((time) => Number.isFinite(time) && time > now);

  if (!unlockTimes.length) {
    return null;
  }

  return Math.min(...unlockTimes) - now + 500;
}

function ParticipantPage({ mode }) {
  const { sessionId } = useParams();
  const { bootstrap } = useAuth();
  const { data, loading, error, refresh, updateEntry, updateReflection } =
    useParticipantDiary(sessionId);
  const [selectedHistoryDay, setSelectedHistoryDay] = useState(() =>
    readStoredSelectedDay(sessionId),
  );
  const liveHistory = data?.history ?? [];
  const selectedDayStorageKey = getParticipantDayStorageKey(sessionId);
  const fallbackCurrentDay = useMemo(
    () => selectClosestProgramDay(liveHistory) || liveHistory[0] || null,
    [liveHistory],
  );
  const currentDay = liveHistory.find((day) => day.id === data?.currentDayId) ?? fallbackCurrentDay;

  useEffect(() => {
    setSelectedHistoryDay(readStoredSelectedDay(sessionId));
  }, [sessionId]);

  useEffect(() => {
    if (currentDay?.id) {
      setSelectedHistoryDay((previous) => {
        if (liveHistory.some((day) => day.id === previous)) {
          return previous;
        }

        return currentDay.id;
      });
    }
  }, [currentDay?.id, liveHistory]);

  useEffect(() => {
    if (typeof window === "undefined" || !selectedDayStorageKey) {
      return;
    }

    try {
      if (selectedHistoryDay && liveHistory.some((day) => day.id === selectedHistoryDay)) {
        window.localStorage.setItem(selectedDayStorageKey, selectedHistoryDay);
      } else {
        window.localStorage.removeItem(selectedDayStorageKey);
      }
    } catch {
      // Ignore storage errors and keep runtime flow working.
    }
  }, [liveHistory, selectedDayStorageKey, selectedHistoryDay]);

  useEffect(() => {
    if (typeof window === "undefined" || !liveHistory.length) {
      return undefined;
    }

    const delay = getNextEventUnlockDelay(liveHistory);
    if (delay === null) {
      return undefined;
    }

    const timerId = window.setTimeout(
      () => {
        refresh();
      },
      Math.min(delay, 2147483647),
    );

    return () => window.clearTimeout(timerId);
  }, [liveHistory, refresh]);

  const selectedDay = liveHistory.find((day) => day.id === selectedHistoryDay) ?? currentDay;
  const activeDay = selectedDay ?? currentDay;
  const todayEvents = activeDay?.events ?? [];
  const reflection = activeDay?.reflection ?? {
    answers: {},
    q1: "",
    q2: "",
    q3: "",
    mind: "",
    heart: "",
    will: "",
    freeText: "",
  };

  const todayMetrics = useMemo(
    () => calculateMetrics(todayEvents, activeDay?.progress ?? data?.progress),
    [activeDay?.progress, data?.progress, todayEvents],
  );
  const todayPortrait = useMemo(
    () => buildPortrait(todayEvents, todayMetrics),
    [todayEvents, todayMetrics],
  );
  const overallTrajectory = useMemo(
    () =>
      liveHistory.flatMap((day) =>
        day.events
          .filter((event) => event.answered !== false && event.stateId)
          .map((event) => ({
            label: `${day.label}: ${event.title}`,
            stateId: event.stateId,
          })),
      ),
    [liveHistory],
  );
  const overallAverages = useMemo(
    () =>
      liveHistory.map((day) => ({
        day: day.label,
        value: calculateMetrics(day.events, day.progress).average,
      })),
    [liveHistory],
  );

  if (loading && !data) {
    return (
      <FeedbackState
        title="Загружаем дневник"
        description="Получаем JSON-ответ по событиям дня и личной динамике участника."
      />
    );
  }

  if (error) {
    return (
      <FeedbackState
        title="Не удалось загрузить дневник"
        description="Похоже, API-слой вернул ошибку или текущему пользователю недоступен этот контур."
        actionLabel="Повторить"
        onAction={refresh}
      />
    );
  }

  if (data?.availability === "unpublished") {
    return (
      <FeedbackState
        title="Программа ещё не опубликована"
        description="Организатор готовит расписание. Дневник появится здесь после публикации программы заезда."
        actionLabel="Проверить снова"
        onAction={refresh}
      />
    );
  }

  if (data?.availability === "published-empty") {
    return (
      <FeedbackState
        title="В опубликованной программе пока нет мероприятий"
        description="Как только организатор добавит мероприятия, они появятся в дневнике участника."
        actionLabel="Проверить снова"
        onAction={refresh}
      />
    );
  }

  if (!currentDay || !bootstrap) {
    return (
      <FeedbackState
        title="Нет данных для отображения"
        description="Для текущего участника пока не найдено ни одного дня дневника."
      />
    );
  }

  function setReflection(dayId, nextValueOrUpdater) {
    const sourceDay = liveHistory.find((day) => day.id === dayId) ?? activeDay;
    const sourceReflection = sourceDay?.reflection ?? reflection;
    const nextValue =
      typeof nextValueOrUpdater === "function"
        ? nextValueOrUpdater(sourceReflection)
        : nextValueOrUpdater;

    return updateReflection(dayId, nextValue);
  }

  function saveEventEntry(dayId, eventId, patch) {
    return updateEntry(dayId, eventId, patch);
  }

  return (
    <ParticipantRoutedView
      mode={mode}
      stateScale={bootstrap.stateScale}
      reflectionPrompts={bootstrap.reflectionPrompts}
      todayEvents={todayEvents}
      todayMetrics={todayMetrics}
      todayPortrait={todayPortrait}
      reflection={reflection}
      setReflection={setReflection}
      saveEventEntry={saveEventEntry}
      liveHistory={liveHistory}
      selectedDay={activeDay}
      setSelectedHistoryDay={setSelectedHistoryDay}
      overallTrajectory={overallTrajectory}
      overallAverages={overallAverages}
      formatAverage={formatAverage}
      journeyStage={bootstrap.journeyStage ?? null}
      isCarefulMode={Boolean(bootstrap.isCarefulMode)}
    />
  );
}

export function ParticipantTodayPage() {
  return <ParticipantPage mode="today" />;
}

export function ParticipantDynamicsPage() {
  return <ParticipantPage mode="dynamics" />;
}

export function ParticipantSelfKnowledgePage() {
  const { bootstrap, currentUser } = useAuth();

  if (!bootstrap || !currentUser) {
    return (
      <FeedbackState title="Загружаем раздел" description="Собираем данные личного кабинета." />
    );
  }

  return (
    <ParticipantSelfKnowledgeView currentUser={currentUser} sessionInfo={bootstrap.sessionInfo} />
  );
}
