import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useParticipantDiary } from "../api/hooks";
import { useAuth } from "../auth/AuthContext";
import FeedbackState from "../components/FeedbackState";
import { buildPortrait, calculateMetrics, formatAverage } from "../lib/metrics";
import ParticipantRoutedView from "../views/ParticipantRoutedView";
import ParticipantSelfKnowledgeView from "../views/ParticipantSelfKnowledgeView";

function ParticipantPage({ mode }) {
  const { sessionId } = useParams();
  const { bootstrap } = useAuth();
  const { data, loading, error, refresh, updateEntry, updateReflection } =
    useParticipantDiary(sessionId);
  const [selectedHistoryDay, setSelectedHistoryDay] = useState("");

  useEffect(() => {
    if (data?.currentDayId) {
      setSelectedHistoryDay((previous) => previous || data.currentDayId);
    }
  }, [data?.currentDayId]);

  const liveHistory = data?.history ?? [];
  const currentDay = liveHistory.find((day) => day.id === data?.currentDayId) ?? liveHistory[0];
  const selectedDay =
    liveHistory.find((day) => day.id === selectedHistoryDay) ?? currentDay;
  const todayEvents = currentDay?.events ?? [];
  const reflection = currentDay?.reflection ?? {
    q1: "",
    q2: "",
    q3: "",
    freeText: "",
  };

  const todayMetrics = useMemo(
    () => calculateMetrics(todayEvents, currentDay?.progress ?? data?.progress),
    [currentDay?.progress, data?.progress, todayEvents],
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

  function setReflection(nextValueOrUpdater) {
    const nextValue =
      typeof nextValueOrUpdater === "function"
        ? nextValueOrUpdater(reflection)
        : nextValueOrUpdater;

    updateReflection(currentDay.id, nextValue);
  }

  function saveEventEntry(eventId, patch) {
    return updateEntry(currentDay.id, eventId, patch);
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
      selectedDay={selectedDay}
      setSelectedHistoryDay={setSelectedHistoryDay}
      overallTrajectory={overallTrajectory}
      overallAverages={overallAverages}
      formatAverage={formatAverage}
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
      <FeedbackState
        title="Загружаем раздел"
        description="Собираем данные личного кабинета."
      />
    );
  }

  return (
    <ParticipantSelfKnowledgeView
      currentUser={currentUser}
      sessionInfo={bootstrap.sessionInfo}
    />
  );
}
