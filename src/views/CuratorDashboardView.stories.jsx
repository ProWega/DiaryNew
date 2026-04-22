import CuratorDashboardView from "./CuratorDashboardView";

const events = [
  { id: "event-1", dayId: "day-1", dayLabel: "День 1", title: "Утренний круг", type: "Рефлексия", timeLabel: "09:00 - 09:30", tags: ["старт"] },
  { id: "event-2", dayId: "day-1", dayLabel: "День 1", title: "Лекция о сообществе", type: "Лекция", timeLabel: "10:00 - 11:20", tags: ["смыслы"] },
  { id: "event-3", dayId: "day-1", dayLabel: "День 1", title: "Проектная мастерская", type: "Практикум", timeLabel: "12:00 - 13:30", tags: ["интенсив"] },
  { id: "event-4", dayId: "day-1", dayLabel: "День 1", title: "Переезд", type: "Логистика", timeLabel: "15:00 - 15:40", tags: ["маршрут"] },
  { id: "event-5", dayId: "day-1", dayLabel: "День 1", title: "Вечерняя рефлексия", type: "Рефлексия", timeLabel: "19:00 - 20:00", tags: ["итог"] },
];

const eventPulse = [
  { ...events[0], index: 1, answersCount: 4, participantsCount: 4, completion: 100, averageStateLevel: 3.1, minStateLevel: 2, maxStateLevel: 4, amplitude: 2, deltaFromPrevious: null, commentsCount: 2, riskAnswersCount: 0, hasResponses: true },
  { ...events[1], index: 2, answersCount: 4, participantsCount: 4, completion: 100, averageStateLevel: 4.2, minStateLevel: 3, maxStateLevel: 5, amplitude: 2, deltaFromPrevious: 1.1, commentsCount: 3, riskAnswersCount: 1, hasResponses: true },
  { ...events[2], index: 3, answersCount: 3, participantsCount: 4, completion: 75, averageStateLevel: 5.3, minStateLevel: 4, maxStateLevel: 6, amplitude: 2, deltaFromPrevious: 1.1, commentsCount: 3, riskAnswersCount: 2, hasResponses: true },
  { ...events[3], index: 4, answersCount: 2, participantsCount: 4, completion: 50, averageStateLevel: 1.5, minStateLevel: 1, maxStateLevel: 2, amplitude: 1, deltaFromPrevious: -3.8, commentsCount: 2, riskAnswersCount: 2, hasResponses: true },
  { ...events[4], index: 5, answersCount: 0, participantsCount: 4, completion: 0, averageStateLevel: null, minStateLevel: null, maxStateLevel: null, amplitude: null, deltaFromPrevious: null, commentsCount: 0, riskAnswersCount: 0, hasResponses: false },
];

const participantRows = [
  {
    id: "participant-3",
    name: "Егор Кузнецов",
    status: "risk",
    average: 4,
    amplitude: 5,
    answeredEvents: 4,
    totalEvents: 5,
    completion: 80,
    commentsCount: 3,
    openRiskSignalsCount: 1,
    trajectory: [
      { eventId: "event-1", stateLevel: 4, answered: true, comment: "" },
      { eventId: "event-2", stateLevel: 5, answered: true, comment: "Шумно, но интересно." },
      { eventId: "event-3", stateLevel: 6, answered: true, comment: "Слишком много задач сразу." },
      { eventId: "event-4", stateLevel: 1, answered: true, comment: "Нужна ясность по маршруту." },
      { eventId: "event-5", stateLevel: null, answered: false, comment: "" },
    ],
  },
  {
    id: "participant-2",
    name: "Анна Сергеева",
    status: "watch",
    average: 3.2,
    amplitude: 3,
    answeredEvents: 4,
    totalEvents: 5,
    completion: 80,
    commentsCount: 2,
    openRiskSignalsCount: 0,
    trajectory: [
      { eventId: "event-1", stateLevel: 2, answered: true, comment: "" },
      { eventId: "event-2", stateLevel: 4, answered: true, comment: "Сильная лекция." },
      { eventId: "event-3", stateLevel: 4, answered: true, comment: "" },
      { eventId: "event-4", stateLevel: 2, answered: true, comment: "Устала ждать." },
      { eventId: "event-5", stateLevel: null, answered: false, comment: "" },
    ],
  },
  {
    id: "participant-4",
    name: "Дарья Лисина",
    status: "silent",
    average: null,
    amplitude: null,
    answeredEvents: 0,
    totalEvents: 5,
    completion: 0,
    commentsCount: 0,
    openRiskSignalsCount: 0,
    trajectory: events.map((event) => ({ eventId: event.id, stateLevel: null, answered: false, comment: "" })),
  },
  {
    id: "participant-1",
    name: "Боря Соколов",
    status: "ok",
    average: 3.4,
    amplitude: 2,
    answeredEvents: 4,
    totalEvents: 5,
    completion: 80,
    commentsCount: 1,
    openRiskSignalsCount: 0,
    trajectory: [
      { eventId: "event-1", stateLevel: 3, answered: true, comment: "" },
      { eventId: "event-2", stateLevel: 4, answered: true, comment: "Интересно." },
      { eventId: "event-3", stateLevel: 4, answered: true, comment: "" },
      { eventId: "event-4", stateLevel: 3, answered: true, comment: "" },
      { eventId: "event-5", stateLevel: null, answered: false, comment: "" },
    ],
  },
];

const baseDashboard = {
  sessionId: "session-istoki-school-2026",
  groupId: "group-school-1",
  groupName: "Группа 1",
  curator: "Марина Чернова",
  program: { id: "program-core", title: "Основная программа", status: "published", isPublished: true },
  days: [{ id: "day-1", label: "День 1", dateLabel: "13 июля" }],
  events,
  dataState: "ready",
  progress: { completion: 72, answeredEvents: 17, totalEvents: 20, answeredReflections: 2, totalReflections: 4 },
  participantsCount: 4,
  completion: 72,
  averageActivation: 3.5,
  riskCases: 2,
  eventPulse,
  participantRows,
  members: participantRows,
  alerts: [
    {
      id: "risk-1",
      userId: "participant-3",
      severity: "high",
      status: "open",
      title: "Резкая просадка после переезда",
      detail: "Участник отметил уровень 1 и комментарий про отсутствие ясности маршрута.",
      resolvedAt: null,
    },
  ],
  reflectionPrep: {
    focusEvents: [
      {
        id: "event-4",
        title: "Переезд",
        dayLabel: "День 1",
        timeLabel: "15:00 - 15:40",
        type: "Логистика",
        averageStateLevel: 1.5,
        completion: 50,
        riskAnswersCount: 2,
        deltaFromPrevious: -3.8,
        evidence: ["2 ответов в зоне риска", "переход относительно прошлого события: -3,8", "низкая видимость данных: 50% заполнения"],
      },
      {
        id: "event-3",
        title: "Проектная мастерская",
        dayLabel: "День 1",
        timeLabel: "12:00 - 13:30",
        type: "Практикум",
        averageStateLevel: 5.3,
        completion: 75,
        riskAnswersCount: 2,
        deltaFromPrevious: 1.1,
        evidence: ["2 ответов в зоне риска", "3 комментариев"],
      },
    ],
    dayReflections: [
      {
        id: "day-1",
        label: "День 1",
        dateLabel: "13 июля",
        responsesCount: 2,
        freeTextCount: 2,
        answeredPromptsCount: 6,
        excerpts: ["Хочу больше ясности в переходах.", "После мастерской нужна короткая пауза."],
      },
    ],
    commentClusters: [
      { id: "cluster-1", label: "логистика / ожидание", summary: "Комментарии про переходы, очереди и неясный маршрут.", score: 0.82, count: 4 },
      { id: "cluster-2", label: "интенсив / нет паузы", summary: "Участники связывают перегруз с плотностью практикума.", score: 0.76, count: 3 },
    ],
    openRisks: [
      {
        id: "risk-1",
        severity: "high",
        status: "open",
        title: "Резкая просадка после переезда",
        detail: "Участник отметил уровень 1 и комментарий про отсутствие ясности маршрута.",
      },
    ],
    aiReport: {
      id: "ai-report-1",
      title: "Итоги дня по группе",
      confidence: "medium",
      version: 1,
      content: {
        bullets: ["Смысловые события дают рост вовлеченности.", "Логистика дала наиболее резкую просадку."],
        recommendation: "Перед вечерней рефлексией проверить, что именно было неясно в переходе.",
      },
    },
  },
  organizerBrief: [
    {
      id: "risk-risk-1",
      type: "risk_signal",
      severity: "high",
      title: "Резкая просадка после переезда",
      evidence: "Участник отметил уровень 1 и комментарий про отсутствие ясности маршрута.",
      anchor: "risk_signals",
    },
    {
      id: "event-risk-event-3",
      type: "event_risk",
      severity: "high",
      title: "Пик напряжения: Проектная мастерская",
      evidence: "2 из 3 ответов попали в крайние зоны шкалы.",
      anchor: "event-3",
    },
  ],
};

function cloneDashboard(patch = {}) {
  return {
    ...structuredClone(baseDashboard),
    ...patch,
  };
}

export default {
  title: "Curator/Pulse Dashboard",
  component: CuratorDashboardView,
  parameters: { layout: "fullscreen" },
};

export const Normal = {
  render: () => <CuratorDashboardView dashboard={cloneDashboard()} />,
};

export const Mobile = {
  parameters: { viewport: { defaultViewport: "mobile" } },
  render: () => <CuratorDashboardView dashboard={cloneDashboard()} />,
};

export const NoResponses = {
  render: () => (
    <CuratorDashboardView
      dashboard={cloneDashboard({
        dataState: "no_responses",
        completion: 0,
        averageActivation: null,
        riskCases: 0,
        progress: { completion: 0, answeredEvents: 0, totalEvents: 20, answeredReflections: 0, totalReflections: 4 },
        eventPulse: eventPulse.map((event) => ({
          ...event,
          answersCount: 0,
          completion: 0,
          averageStateLevel: null,
          minStateLevel: null,
          maxStateLevel: null,
          amplitude: null,
          deltaFromPrevious: null,
          commentsCount: 0,
          riskAnswersCount: 0,
          hasResponses: false,
        })),
        participantRows: participantRows.map((participant) => ({
          ...participant,
          status: "silent",
          average: null,
          amplitude: null,
          answeredEvents: 0,
          completion: 0,
          commentsCount: 0,
          trajectory: events.map((event) => ({ eventId: event.id, stateLevel: null, answered: false, comment: "" })),
        })),
        reflectionPrep: {
          focusEvents: [],
          dayReflections: [],
          commentClusters: [],
          openRisks: [],
          aiReport: null,
        },
        organizerBrief: [],
      })}
    />
  ),
};

export const NoPublishedProgram = {
  render: () => (
    <CuratorDashboardView
      dashboard={cloneDashboard({
        dataState: "unpublished",
        program: { id: "program-draft", title: "Черновик", status: "draft", isPublished: false },
        events: [],
        eventPulse: [],
        participantRows: [],
        members: [],
        participantsCount: 4,
        completion: 0,
        averageActivation: null,
        riskCases: 0,
        reflectionPrep: {
          focusEvents: [],
          dayReflections: [],
          commentClusters: [],
          openRisks: [],
          aiReport: null,
        },
        organizerBrief: [],
      })}
    />
  ),
};

export const HighRisk = {
  render: () => (
    <CuratorDashboardView
      dashboard={cloneDashboard({
        riskCases: 3,
        eventPulse: eventPulse.map((event) =>
          event.id === "event-3"
            ? { ...event, averageStateLevel: 5.8, riskAnswersCount: 3, commentsCount: 4, completion: 100 }
            : event,
        ),
      })}
    />
  ),
};

export const EmptyClustersAndAi = {
  render: () => (
    <CuratorDashboardView
      dashboard={cloneDashboard({
        reflectionPrep: {
          ...structuredClone(baseDashboard.reflectionPrep),
          commentClusters: [],
          aiReport: null,
        },
      })}
    />
  ),
};
