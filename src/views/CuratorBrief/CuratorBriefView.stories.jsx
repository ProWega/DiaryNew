import CuratorBriefView from "./CuratorBriefView";

const sampleBrief = {
  dayId: "day-1",
  dayLabel: "День 1",
  picture: {
    totalParticipants: 12,
    respondedToday: 9,
    dominantState: "balance",
    dominantStateLabel: "Баланс",
    lowActivationCount: 2,
    workingActivationCount: 5,
    highActivationCount: 2,
  },
  conversationPoints: [
    {
      participantId: "u-2",
      displayName: "Анна К.",
      reason: "low_activation_streak",
      note: "Второй день в низкой активации — стоит просто побыть рядом.",
    },
    {
      participantId: "u-3",
      displayName: "Илья М.",
      reason: "shift_down",
      note: "Вчера в Балансе, сегодня в Перевозбуждённости.",
    },
    {
      participantId: "u-4",
      displayName: "Мария В.",
      reason: "high_activation",
      note: "Сегодня в Панике — стоит проверить, нужна ли пауза или разговор.",
    },
  ],
  stageResonance: { search: 4, verification: 3, support: 3, transmission: 2 },
  events: [
    {
      id: "e-1",
      title: "Утренний круг",
      responseCount: 9,
      quotes: ["Тепло настроились на день", "Хорошо вошли"],
    },
    { id: "e-2", title: "Лекция «Дорога»", responseCount: 7, quotes: [] },
  ],
  participantCards: [
    {
      userId: "u-1",
      displayName: "Иван П.",
      journeyStage: "support",
      journeyStageLabel: "Опора",
      today: { id: "balance", ru: "Баланс" },
      yesterday: { id: "relaxed", ru: "Расслабленность" },
      conversationHint: null,
    },
    {
      userId: "u-2",
      displayName: "Анна К.",
      journeyStage: "verification",
      journeyStageLabel: "Проверка",
      today: { id: "passive", ru: "Пассивность" },
      yesterday: { id: "apathy", ru: "Апатия" },
      conversationHint: {
        reason: "low_activation_streak",
        note: "Второй день в низкой активации — стоит просто побыть рядом.",
      },
    },
    {
      userId: "u-3",
      displayName: "Илья М.",
      journeyStage: "search",
      journeyStageLabel: "Поиск",
      today: { id: "overstimulated", ru: "Перевозбуждённость" },
      yesterday: { id: "balance", ru: "Баланс" },
      conversationHint: {
        reason: "shift_down",
        note: "Вчера в Балансе, сегодня в Перевозбуждённости.",
      },
    },
    {
      userId: "u-4",
      displayName: "Мария В.",
      journeyStage: "transmission",
      journeyStageLabel: "Передача",
      today: { id: "engaged", ru: "Включённость" },
      yesterday: null,
      conversationHint: null,
    },
  ],
  programArc: {
    dayBreakdown: [
      {
        dayId: "day-1",
        dayLabel: "День 1",
        respondedCount: 9,
        totalEntries: 14,
        dominantState: "balance",
        dominantStateLabel: "Баланс",
      },
      {
        dayId: "day-2",
        dayLabel: "День 2",
        respondedCount: 0,
        totalEntries: 0,
        dominantState: null,
        dominantStateLabel: null,
      },
      {
        dayId: "day-3",
        dayLabel: "День 3",
        respondedCount: 0,
        totalEntries: 0,
        dominantState: null,
        dominantStateLabel: null,
      },
    ],
  },
  narrative: {
    text: "День прошёл в рабочей активации — большинство в группе нашли свой ритм и держатся рядом. Одна участница второй день в низкой активации — стоит просто побыть рядом без напоминаний. У другого резкая смена в высокую активацию после ровного вчера: возможно, важно не настаивать на разговоре сразу.",
    source: "llm",
  },
};

const emptyBrief = {
  dayId: "",
  dayLabel: "",
  picture: {
    totalParticipants: 0,
    respondedToday: 0,
    dominantState: null,
    lowActivationCount: 0,
    workingActivationCount: 0,
    highActivationCount: 0,
  },
  conversationPoints: [],
  stageResonance: { search: 0, verification: 0, support: 0, transmission: 0 },
  events: [],
  participantCards: [],
  programArc: { dayBreakdown: [] },
  narrative: { text: null, source: "fallback" },
};

export default {
  title: "Curator/CuratorBriefView",
  component: CuratorBriefView,
  parameters: { layout: "padded" },
};

export const Default = {
  args: { brief: sampleBrief },
};

export const Empty = {
  args: { brief: emptyBrief },
};

export const NoHotPointsNoEvents = {
  args: {
    brief: {
      ...sampleBrief,
      conversationPoints: sampleBrief.conversationPoints.filter(
        (p) => p.reason !== "high_activation",
      ),
      events: [],
    },
  },
};
