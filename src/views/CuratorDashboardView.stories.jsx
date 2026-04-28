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
      { eventId: "event-4", stateLevel: 0, answered: true, comment: "Устала ждать." },
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
    reflectionBrief: {
      coverage: {
        confidence: "medium",
        completion: 72,
        answeredEvents: 4,
        totalEvents: 5,
        participantsCount: 4,
        openRisksCount: 1,
        summary: "Данных достаточно для рабочего брифа, но отдельные выводы стоит проверить в круге.",
      },
      talkingPoints: [
        {
          id: "event-4",
          title: "Переезд",
          prompt: "Обсудить, что именно было неясно в переходе и что поможет группе завтра.",
          confidence: "medium",
          severity: "high",
          evidence: ["2 из 2 ответов в зоне риска", "низкая видимость данных: 50% заполнения"],
        },
        {
          id: "event-3",
          title: "Проектная мастерская",
          prompt: "Проверить, где мастерская дала ресурс, а где перегрузила.",
          confidence: "medium",
          severity: "medium",
          evidence: ["2 из 3 ответов в зоне риска", "3 комментария"],
        },
      ],
      participantsToCheckIn: [
        {
          id: "participant-3",
          name: "Егор Кузнецов",
          status: "risk",
          confidence: "medium",
          evidence: ["статус групповой карты: нужно внимание", "1 открытых сигналов риска", "амплитуда дня 5"],
        },
      ],
      blindSpots: [
        {
          id: "low-coverage-event-4",
          title: "Мало данных: Переезд",
          detail: "Заполнение 50%, поэтому выводы лучше проверить в круге.",
          confidence: "high",
        },
      ],
    },
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

const dayTwoEvents = [
  { id: "event-6", dayId: "day-2", dayLabel: "День 2", title: "Практикум команд", type: "Практикум", timeLabel: "10:00 - 11:30", tags: ["команды"] },
  { id: "event-7", dayId: "day-2", dayLabel: "День 2", title: "Тихий круг", type: "Рефлексия", timeLabel: "18:30 - 19:10", tags: ["итог"] },
];

const dayTwoPulse = [
  { ...dayTwoEvents[0], index: 1, answersCount: 2, participantsCount: 4, completion: 50, averageStateLevel: 4.9, minStateLevel: 4, maxStateLevel: 6, amplitude: 2, deltaFromPrevious: null, commentsCount: 2, riskAnswersCount: 1, hasResponses: true },
  { ...dayTwoEvents[1], index: 2, answersCount: 1, participantsCount: 4, completion: 25, averageStateLevel: 2, minStateLevel: 2, maxStateLevel: 2, amplitude: 0, deltaFromPrevious: -2.9, commentsCount: 1, riskAnswersCount: 0, hasResponses: true },
];

const dayTwoParticipantRows = participantRows.map((participant) => {
  const trajectories = {
    "participant-3": [
      { eventId: "event-6", stateLevel: 6, answered: true, comment: "Слишком плотный темп." },
      { eventId: "event-7", stateLevel: null, answered: false, comment: "" },
    ],
    "participant-2": [
      { eventId: "event-6", stateLevel: 4, answered: true, comment: "Помогла работа в паре." },
      { eventId: "event-7", stateLevel: 2, answered: true, comment: "К вечеру устала." },
    ],
  };
  const trajectory = trajectories[participant.id] || dayTwoEvents.map((event) => ({ eventId: event.id, stateLevel: null, answered: false, comment: "" }));
  const answeredEvents = trajectory.filter((point) => point.answered).length;
  const levels = trajectory.map((point) => point.stateLevel).filter((value) => Number.isFinite(Number(value)));

  return {
    ...participant,
    status: participant.id === "participant-3" ? "risk" : answeredEvents ? "watch" : "silent",
    average: levels.length ? Number((levels.reduce((sum, value) => sum + value, 0) / levels.length).toFixed(1)) : null,
    amplitude: levels.length ? Math.max(...levels) - Math.min(...levels) : null,
    answeredEvents,
    totalEvents: dayTwoEvents.length,
    completion: Math.round((answeredEvents / dayTwoEvents.length) * 100),
    commentsCount: trajectory.filter((point) => point.comment).length,
    trajectory,
  };
});

const dayOneScope = {
  scopeId: "day-1",
  label: "День 1",
  dayId: "day-1",
  dateLabel: "13 июля",
  events,
  dataState: "ready",
  progress: baseDashboard.progress,
  participantsCount: baseDashboard.participantsCount,
  completion: baseDashboard.completion,
  averageActivation: baseDashboard.averageActivation,
  riskCases: baseDashboard.riskCases,
  eventPulse,
  participantRows,
  members: participantRows,
  reflectionPrep: baseDashboard.reflectionPrep,
  organizerBrief: baseDashboard.organizerBrief,
  topThemes: baseDashboard.reflectionPrep.commentClusters,
  aiSummary: baseDashboard.reflectionPrep.aiReport,
};

const dayTwoScope = {
  scopeId: "day-2",
  label: "День 2",
  dayId: "day-2",
  dateLabel: "14 июля",
  events: dayTwoEvents,
  dataState: "ready",
  progress: { completion: 36, answeredEvents: 3, totalEvents: 8, answeredReflections: 0, totalReflections: 4 },
  participantsCount: 4,
  completion: 36,
  averageActivation: 4.1,
  riskCases: 2,
  eventPulse: dayTwoPulse,
  participantRows: dayTwoParticipantRows,
  members: dayTwoParticipantRows,
  reflectionPrep: {
    focusEvents: [
      {
        id: "event-6",
        title: "Уточнить: Практикум команд",
        prompt: "Проверить, где командный практикум дал ресурс, а где перегрузил.",
        confidence: "low",
        severity: "medium",
        evidence: ["заполнение 50%", "1 ответ в зоне риска"],
      },
    ],
    dayReflections: [
      { id: "day-2", label: "День 2", dateLabel: "14 июля", responsesCount: 0, freeTextCount: 0, answeredPromptsCount: 0, excerpts: [] },
    ],
    commentClusters: [{ id: "cluster-day-2", label: "темп / усталость", summary: "Комментарии дня связаны с плотностью практикума.", score: 0.68, count: 2 }],
    openRisks: baseDashboard.reflectionPrep.openRisks,
    aiReport: {
      id: "ai-report-day-2",
      title: "День 2: подготовка к рефлексии",
      confidence: "low",
      version: 1,
      content: {
        bullets: ["Данных пока мало, формулировки лучше выносить как вопросы.", "Практикум команд выглядит точкой для бережной проверки."],
        recommendation: "Начать круг с вопроса о темпе и восстановлении.",
      },
    },
    reflectionBrief: {
      coverage: {
        confidence: "low",
        completion: 36,
        answeredEvents: 2,
        totalEvents: 2,
        participantsCount: 4,
        openRisksCount: 1,
        summary: "Данных мало: используйте срез дня как набор вопросов, а не готовые выводы.",
      },
      talkingPoints: [
        {
          id: "event-6",
          title: "Уточнить: Практикум команд",
          prompt: "Проверить, кому темп помог включиться, а кому потребовалась пауза.",
          confidence: "low",
          severity: "medium",
          evidence: ["заполнение 50%", "1 ответ в зоне риска"],
        },
      ],
      participantsToCheckIn: [
        { id: "participant-3", name: "Егор Кузнецов", status: "risk", confidence: "medium", evidence: ["уровень 6 на практикуме", "комментарий про плотный темп"] },
      ],
      blindSpots: [
        { id: "day-2-low-data", title: "Мало дневных ответов", detail: "Срез дня показывает только первые сигналы, поэтому выводы стоит проверять в круге.", confidence: "high" },
      ],
    },
  },
  organizerBrief: [
    { id: "day-2-brief", type: "low_visibility", severity: "low", title: "День 2 пока заполнен частично", evidence: "Заполнение 36%, фокус лучше держать на вопросах к группе.", anchor: "event-6" },
  ],
  topThemes: [{ id: "cluster-day-2", label: "темп / усталость", summary: "Комментарии дня связаны с плотностью практикума.", score: 0.68, count: 2 }],
  aiSummary: null,
};

const allScope = {
  ...dayOneScope,
  scopeId: "all",
  label: "Все дни",
  dayId: null,
  dateLabel: "",
  events: [...events, ...dayTwoEvents],
  eventPulse: [...eventPulse, ...dayTwoPulse.map((event, index) => ({ ...event, index: eventPulse.length + index + 1 }))],
  participantRows: participantRows.map((participant) => {
    const dayTwoParticipant = dayTwoParticipantRows.find((item) => item.id === participant.id);
    return {
      ...participant,
      trajectory: [...participant.trajectory, ...(dayTwoParticipant?.trajectory || [])],
      answeredEvents: participant.answeredEvents + Number(dayTwoParticipant?.answeredEvents || 0),
      totalEvents: participant.totalEvents + dayTwoEvents.length,
      completion: Math.round(((participant.answeredEvents + Number(dayTwoParticipant?.answeredEvents || 0)) / (participant.totalEvents + dayTwoEvents.length)) * 100),
    };
  }),
  progress: { completion: 60, answeredEvents: 20, totalEvents: 28, answeredReflections: 2, totalReflections: 8 },
  completion: 60,
  averageActivation: 3.7,
  reflectionPrep: {
    ...baseDashboard.reflectionPrep,
    dayReflections: [
      ...baseDashboard.reflectionPrep.dayReflections,
      { id: "day-2", label: "День 2", dateLabel: "14 июля", responsesCount: 0, freeTextCount: 0, answeredPromptsCount: 0, excerpts: [] },
    ],
  },
};

allScope.members = allScope.participantRows;
baseDashboard.days = [
  { id: "day-1", label: "День 1", dateLabel: "13 июля" },
  { id: "day-2", label: "День 2", dateLabel: "14 июля" },
];
baseDashboard.events = allScope.events;
baseDashboard.eventPulse = allScope.eventPulse;
baseDashboard.participantRows = allScope.participantRows;
baseDashboard.members = allScope.members;
baseDashboard.progress = allScope.progress;
baseDashboard.completion = allScope.completion;
baseDashboard.averageActivation = allScope.averageActivation;
baseDashboard.reflectionPrep = allScope.reflectionPrep;
baseDashboard.reportScopes = [allScope, dayOneScope, dayTwoScope];

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

export const DayOneReport = {
  render: () => (
    <CuratorDashboardView
      dashboard={cloneDashboard({
        reportScopes: [dayOneScope, allScope, dayTwoScope],
      })}
    />
  ),
};

export const DayTwoLowCoverageReport = {
  render: () => (
    <CuratorDashboardView
      dashboard={cloneDashboard({
        reportScopes: [dayTwoScope, allScope, dayOneScope],
      })}
    />
  ),
};

export const SelectedParticipant = {
  render: () => (
    <CuratorDashboardView
      dashboard={cloneDashboard()}
      initialSelectedParticipantId="participant-3"
    />
  ),
};

export const LowCoverageReflectionBrief = {
  render: () => (
    <CuratorDashboardView
      dashboard={cloneDashboard({
        completion: 32,
        progress: { completion: 32, answeredEvents: 4, totalEvents: 20, answeredReflections: 0, totalReflections: 4 },
        eventPulse: eventPulse.map((event) => ({
          ...event,
          completion: event.hasResponses ? Math.min(event.completion, 40) : 0,
          answersCount: event.hasResponses ? 1 : 0,
        })),
        reflectionPrep: {
          ...structuredClone(baseDashboard.reflectionPrep),
          reflectionBrief: {
            coverage: {
              confidence: "low",
              completion: 32,
              answeredEvents: 4,
              totalEvents: 5,
              participantsCount: 4,
              openRisksCount: 1,
              summary: "Данных мало: пункты брифа лучше использовать как вопросы к группе.",
            },
            talkingPoints: [
              {
                id: "event-4",
                title: "Уточнить: Переезд",
                prompt: "Уточнить у группы, что происходило в точке «Переезд»: данных пока мало.",
                confidence: "low",
                severity: "medium",
                evidence: ["низкая видимость данных: 40% заполнения"],
              },
            ],
            participantsToCheckIn: [
              {
                id: "participant-4",
                name: "Дарья Лисина",
                status: "silent",
                confidence: "medium",
                evidence: ["нет ответов по событиям"],
              },
            ],
            blindSpots: [
              {
                id: "low-coverage",
                title: "Мало данных по событиям",
                detail: "Заполнение ниже 50%, поэтому выводы нельзя подавать как утверждения.",
                confidence: "high",
              },
            ],
          },
        },
      })}
    />
  ),
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
        reportScopes: [],
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
        reportScopes: [],
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
