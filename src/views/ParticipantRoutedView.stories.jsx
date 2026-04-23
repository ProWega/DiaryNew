import { useEffect, useMemo, useState } from "react";
import FeedbackState from "../components/FeedbackState";
import { reflectionPrompts, stateScale } from "../data/mockData";
import { buildPortrait, calculateMetrics, formatAverage } from "../lib/metrics";
import ParticipantRoutedView from "./ParticipantRoutedView";

export default {
  title: "Participant/Diary",
  component: ParticipantRoutedView,
  argTypes: {
    mode: { control: "radio", options: ["today", "dynamics"] },
    answeredEvents: { control: { type: "number", min: 0, max: 4, step: 1 } },
    reflectionAnswered: { control: "boolean" },
  },
};

const baseEvents = [
  { id: "event-1", time: "09:00 - 09:45", title: "Утренний сбор", type: "Общий поток", tags: ["старт"], stateId: "balance" },
  { id: "event-2", time: "10:00 - 11:30", title: "Проектная сессия", type: "Практикум", tags: ["команда"], stateId: "engaged" },
  { id: "event-3", time: "12:00 - 13:00", title: "Рефлексия", type: "Группа", tags: ["дневник"], stateId: "relaxed" },
  { id: "event-4", time: "15:00 - 16:30", title: "Интенсив", type: "Лекция", tags: ["спикер"], stateId: "overstimulated" },
];

function hasReflectionText(reflection) {
  return ["q1", "q2", "q3", "freeText"].some((field) =>
    String(reflection?.[field] || "").trim(),
  );
}

function getProgress(events, reflection) {
  const answeredEvents = events.filter((event) => Boolean(event.stateId)).length;
  const answeredReflections = hasReflectionText(reflection) ? 1 : 0;
  const totalEvents = events.length;
  const totalReflections = 1;
  const total = totalEvents + totalReflections;

  return {
    completion: total ? Math.round(((answeredEvents + answeredReflections) / total) * 100) : 0,
    answeredEvents,
    totalEvents,
    answeredReflections,
    totalReflections,
  };
}

function makeDay({
  id = "day-1",
  label = "День 1",
  dateLabel = "13 июля",
  dateValue = "2026-07-13",
  answeredEvents = 2,
  reflectionAnswered = true,
} = {}) {
  const events = baseEvents.map((event, index) => ({
    ...event,
    answered: index < answeredEvents,
    stateId: index < answeredEvents ? event.stateId : null,
    comment: index < answeredEvents ? "Короткая заметка участника." : "",
    confidence: "high",
    respondedAt: index < answeredEvents ? "2026-07-13T12:00:00.000Z" : null,
  }));
  const progressTotal = events.length + 1;
  const progressAnswered = answeredEvents + (reflectionAnswered ? 1 : 0);

  return {
    id,
    label,
    dateLabel,
    dateValue,
    insight: "Сводка меняется по мере заполнения дневника.",
    aiHighlights: ["Пока видна частичная динамика.", "После дневной рефлексии картина станет точнее."],
    reflection: {
      q1: reflectionAnswered ? "День был насыщенным." : "",
      q2: reflectionAnswered ? "Запомнилась работа в группе." : "",
      q3: reflectionAnswered ? "Нужны паузы." : "",
      freeText: "",
      answered: reflectionAnswered,
      respondedAt: reflectionAnswered ? "2026-07-13T12:30:00.000Z" : null,
    },
    progress: {
      completion: Math.round((progressAnswered / progressTotal) * 100),
      answeredEvents,
      totalEvents: events.length,
      answeredReflections: reflectionAnswered ? 1 : 0,
      totalReflections: 1,
    },
    events,
  };
}

function ParticipantDiaryStory(args) {
  const initialHistory = useMemo(
    () => [
      makeDay(args),
      makeDay({
        id: "day-2",
        label: "День 2",
        dateLabel: "14 июля",
        dateValue: "2026-07-14",
        answeredEvents: Math.max(args.answeredEvents - 1, 0),
        reflectionAnswered: false,
      }),
    ],
    [args.answeredEvents, args.reflectionAnswered],
  );
  const [history, setHistory] = useState(initialHistory);
  const [selectedHistoryDay, setSelectedHistoryDay] = useState(initialHistory[0]?.id || "");

  useEffect(() => {
    setHistory(initialHistory);
    setSelectedHistoryDay(initialHistory[0]?.id || "");
  }, [initialHistory]);

  const currentDay =
    history.find((day) => day.id === selectedHistoryDay) ||
    history[0];
  const normalizedHistory = history.map((day) => {
    const progress = getProgress(day.events, day.reflection);
    return {
      ...day,
      reflection: {
        ...day.reflection,
        answered: progress.answeredReflections > 0,
      },
      progress,
    };
  });
  const selectedDay =
    normalizedHistory.find((day) => day.id === currentDay?.id) ||
    normalizedHistory[0];
  const metrics = calculateMetrics(selectedDay.events, selectedDay.progress);

  function setReflection(dayId, nextValueOrUpdater) {
    setHistory((previous) =>
      previous.map((day) => {
        if (day.id !== dayId) {
          return day;
        }

        const nextReflection =
          typeof nextValueOrUpdater === "function"
            ? nextValueOrUpdater(day.reflection)
            : nextValueOrUpdater;

        return {
          ...day,
          reflection: nextReflection,
        };
      }),
    );
  }

  async function saveEventEntry(dayId, eventId, patch) {
    setHistory((previous) =>
      previous.map((day) =>
        day.id === dayId
          ? {
              ...day,
              events: day.events.map((event) =>
                event.id === eventId
                  ? {
                      ...event,
                      ...patch,
                      answered: true,
                      respondedAt: "2026-07-13T12:00:00.000Z",
                    }
                  : event,
              ),
            }
          : day,
      ),
    );

    return {
      ok: true,
    };
  }

  return (
    <ParticipantRoutedView
      mode={args.mode}
      stateScale={stateScale}
      reflectionPrompts={reflectionPrompts}
      todayEvents={selectedDay.events}
      todayMetrics={metrics}
      todayPortrait={buildPortrait(selectedDay.events, metrics)}
      reflection={selectedDay.reflection}
      setReflection={setReflection}
      saveEventEntry={saveEventEntry}
      liveHistory={normalizedHistory}
      selectedDay={selectedDay}
      setSelectedHistoryDay={setSelectedHistoryDay}
      overallTrajectory={normalizedHistory.flatMap((day) =>
        day.events
          .filter((event) => event.answered && event.stateId)
          .map((event) => ({ label: `${day.label}: ${event.title}`, stateId: event.stateId })),
      )}
      overallAverages={normalizedHistory.map((day) => ({ day: day.label, value: calculateMetrics(day.events, day.progress).average }))}
      formatAverage={formatAverage}
    />
  );
}

function renderParticipant(args) {
  return <ParticipantDiaryStory {...args} />;
}

export const MobileQuickInput = {
  args: {
    mode: "today",
    answeredEvents: 1,
    reflectionAnswered: false,
  },
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
  render: renderParticipant,
};

export const SequentialIncompleteDay = {
  args: {
    mode: "today",
    answeredEvents: 2,
    reflectionAnswered: false,
  },
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
  render: renderParticipant,
};

export const CompletedMobileDay = {
  args: {
    mode: "today",
    answeredEvents: 4,
    reflectionAnswered: false,
  },
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
  render: renderParticipant,
};

export const ReflectionLocked = {
  args: {
    mode: "today",
    answeredEvents: 2,
    reflectionAnswered: false,
  },
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
  render: renderParticipant,
};

export const DraftCommentFlow = {
  args: {
    mode: "today",
    answeredEvents: 0,
    reflectionAnswered: false,
  },
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
  render: renderParticipant,
};

export const PartialDay = {
  args: {
    mode: "today",
    answeredEvents: 2,
    reflectionAnswered: true,
  },
  render: renderParticipant,
};

export const CompletedDay = {
  args: {
    ...PartialDay.args,
    answeredEvents: 4,
  },
  render: renderParticipant,
};

export const DynamicsPartial = {
  args: {
    ...PartialDay.args,
    mode: "dynamics",
  },
  render: renderParticipant,
};

export const UnpublishedProgram = {
  render: () => (
    <FeedbackState
      title="Программа ещё не опубликована"
      description="Организатор готовит расписание. Дневник появится здесь после публикации программы заезда."
    />
  ),
};

export const PublishedEmptyProgram = {
  render: () => (
    <FeedbackState
      title="В опубликованной программе пока нет мероприятий"
      description="Как только организатор добавит мероприятия, они появятся в дневнике участника."
    />
  ),
};
