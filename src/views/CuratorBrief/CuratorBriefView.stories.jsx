import CuratorBriefView from "./CuratorBriefView";

const sampleBrief = {
  dayId: "day-1",
  dayLabel: "День 1",
  picture: {
    totalParticipants: 12,
    respondedToday: 9,
    dominantState: "harmony",
    dominantStateLabel: "Лад",
    carefulCount: 2,
  },
  conversationPoints: [
    {
      participantId: "u-2",
      displayName: "Анна К.",
      reason: "careful_mode",
      note: "Сейчас «бережно» — стоит подойти деликатно, без давления.",
    },
    {
      participantId: "u-3",
      displayName: "Илья М.",
      reason: "shift_down",
      note: "Вчера в Ладе, сегодня в Сбое.",
    },
    {
      participantId: "u-4",
      displayName: "Мария В.",
      reason: "silence_streak",
      note: "Второй день в Тишине — может быть, стоит просто побыть рядом.",
    },
  ],
  stageResonance: { search: 4, verification: 3, support: 3, transmission: 2, careful: 2 },
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
      isCarefulMode: false,
      today: { id: "harmony", ru: "Лад" },
      yesterday: { id: "tuning", ru: "Настройка" },
      conversationHint: null,
    },
    {
      userId: "u-2",
      displayName: "Анна К.",
      journeyStage: "verification",
      journeyStageLabel: "Проверка",
      isCarefulMode: true,
      today: { id: "tuning", ru: "Настройка" },
      yesterday: { id: "harmony", ru: "Лад" },
      conversationHint: {
        reason: "careful_mode",
        note: "Сейчас «бережно» — стоит подойти деликатно, без давления.",
      },
    },
    {
      userId: "u-3",
      displayName: "Илья М.",
      journeyStage: "search",
      journeyStageLabel: "Поиск",
      isCarefulMode: false,
      today: { id: "breakdown", ru: "Сбой" },
      yesterday: { id: "harmony", ru: "Лад" },
      conversationHint: {
        reason: "shift_down",
        note: "Вчера в Ладе, сегодня в Сбое.",
      },
    },
    {
      userId: "u-4",
      displayName: "Мария В.",
      journeyStage: "transmission",
      journeyStageLabel: "Передача",
      isCarefulMode: false,
      today: { id: "lift", ru: "Подъём" },
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
        dominantState: "harmony",
        dominantStateLabel: "Лад",
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
};

const emptyBrief = {
  dayId: "",
  dayLabel: "",
  picture: { totalParticipants: 0, respondedToday: 0, dominantState: null, carefulCount: 0 },
  conversationPoints: [],
  stageResonance: { search: 0, verification: 0, support: 0, transmission: 0, careful: 0 },
  events: [],
  participantCards: [],
  programArc: { dayBreakdown: [] },
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

export const NoCarefulNoEvents = {
  args: {
    brief: {
      ...sampleBrief,
      picture: { ...sampleBrief.picture, carefulCount: 0 },
      conversationPoints: sampleBrief.conversationPoints.filter((p) => p.reason !== "careful_mode"),
      events: [],
    },
  },
};
