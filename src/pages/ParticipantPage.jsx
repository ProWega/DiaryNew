import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useParticipantDiary } from "../api/hooks";
import { useAuth } from "../auth/AuthContext";
import FeedbackState from "../components/FeedbackState";
import { buildPortrait, calculateMetrics, formatAverage } from "../lib/metrics";
import ParticipantRoutedView from "../views/ParticipantRoutedView";

function ParticipantPage({ mode }) {
  const navigate = useNavigate();
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

  const todayMetrics = useMemo(() => calculateMetrics(todayEvents), [todayEvents]);
  const todayPortrait = useMemo(
    () => buildPortrait(todayEvents, todayMetrics),
    [todayEvents, todayMetrics],
  );
  const overallTrajectory = useMemo(
    () =>
      liveHistory.flatMap((day) =>
        day.events.map((event) => ({
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
        value: calculateMetrics(day.events).average,
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

  if (!currentDay || !bootstrap) {
    return (
      <FeedbackState
        title="Нет данных для отображения"
        description="Для текущего участника пока не найдено ни одного дня дневника."
      />
    );
  }

  function navigateToMode(nextMode) {
    navigate(`/participant/session/${sessionId}/${nextMode}`);
  }

  function setReflection(nextValueOrUpdater) {
    const nextValue =
      typeof nextValueOrUpdater === "function"
        ? nextValueOrUpdater(reflection)
        : nextValueOrUpdater;

    updateReflection(currentDay.id, nextValue);
  }

  function updateEventState(eventId, stateId) {
    updateEntry(currentDay.id, eventId, { stateId });
  }

  function updateEventComment(eventId, comment) {
    updateEntry(currentDay.id, eventId, { comment });
  }

  function updateEventConfidence(eventId) {
    const target = todayEvents.find((event) => event.id === eventId);

    updateEntry(currentDay.id, eventId, {
      confidence: target?.confidence === "low" ? "high" : "low",
    });
  }

  return (
    <ParticipantRoutedView
      mode={mode}
      navigateToMode={navigateToMode}
      sessionInfo={bootstrap.sessionInfo}
      stateScale={bootstrap.stateScale}
      reflectionPrompts={bootstrap.reflectionPrompts}
      todayEvents={todayEvents}
      todayMetrics={todayMetrics}
      todayPortrait={todayPortrait}
      reflection={reflection}
      setReflection={setReflection}
      updateEventState={updateEventState}
      updateEventComment={updateEventComment}
      updateEventConfidence={updateEventConfidence}
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
