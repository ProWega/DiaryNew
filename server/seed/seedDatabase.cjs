const { randomUUID } = require("node:crypto");
const { isProductionMode } = require("../config.cjs");
const { ensureSchema, hasPostgresConfig, query } = require("../db/postgres.cjs");
const { seedIstokiRegions } = require("./seedIstoki.cjs");

if (isProductionMode() && process.env.ALLOW_DEMO_SEED !== "true") {
  throw new Error(
    "Demo seed is blocked in production. Set ALLOW_DEMO_SEED=true only for an intentional demo reset.",
  );
}

const SESSIONS = [
  {
    id: "session-vypusknoy-2026",
    name: "Выпускной",
    cycle: "Июнь 2026",
    date_label: "18 июня 2026",
    location: "Москва",
    start_date: "2026-06-18",
    end_date: "2026-06-18",
    description: "Однодневное событие для выпускников программы.",
  },
  {
    id: "session-istoki-school-2026",
    name: "Истоки. Школа",
    cycle: "Летняя школа / июль 2026",
    date_label: "12-15 июля 2026",
    location: "Печоры",
    start_date: "2026-07-12",
    end_date: "2026-07-15",
    description: "Демо-заезд для дневника состояний и аналитики.",
  },
];

const STATES = [
  ["apathy", 0, "Апатия", "Апатия", "😴", "#8b3ff6", "#f0e6ff", "#4a2189"],
  ["passive", 1, "Пассивность", "Пассивность", "😶", "#48a8f5", "#e7f4ff", "#1d5f90"],
  ["relaxed", 2, "Расслабленность", "Расслабленность", "🙂", "#4fc3b5", "#e2f7f4", "#236c65"],
  ["balance", 3, "Баланс", "Баланс", "😊", "#9bd40b", "#f1fad8", "#4d6814"],
  ["engaged", 4, "Включенность", "Включенность", "😀", "#ffd23f", "#fff6cf", "#806319"],
  [
    "overstimulated",
    5,
    "Перевозбуждённость",
    "Перевозбуждение",
    "😵",
    "#ff7a1a",
    "#fff0df",
    "#91470f",
  ],
  ["panic", 6, "Паника", "Паника", "😰", "#ff4a40", "#ffe6e2", "#96302c"],
];

const USERS = [
  {
    id: "user-participant-1",
    full_name: "Боря Соколов",
    role: "participant",
    age: 19,
    gender: "мужской",
  },
  {
    id: "user-participant-2",
    full_name: "Анна Сергеева",
    role: "participant",
    age: 19,
    gender: "женский",
  },
  {
    id: "user-participant-3",
    full_name: "Егор Кузнецов",
    role: "participant",
    age: 18,
    gender: "мужской",
  },
  {
    id: "user-participant-4",
    full_name: "Дарья Лисина",
    role: "participant",
    age: 21,
    gender: "женский",
  },
  { id: "user-curator-1", full_name: "Марина Чернова", role: "curator" },
  { id: "user-curator-2", full_name: "Даниил Крылов", role: "curator" },
  { id: "user-curator-3", full_name: "Елена Лисицына", role: "curator" },
  { id: "user-organizer-1", full_name: "Алексей Волков", role: "organizer" },
  { id: "user-admin-1", full_name: "Системный администратор", role: "admin" },
];

const GROUPS = [
  {
    id: "group-vypusknoy-1",
    session_id: "session-vypusknoy-2026",
    name: "Группа Выпускной",
    curator_id: "user-curator-2",
    description: "Единая группа события.",
  },
  {
    id: "group-school-1",
    session_id: "session-istoki-school-2026",
    name: "Группа 1",
    curator_id: "user-curator-1",
    description: "Сильный отклик на групповые форматы, просадка на логистике.",
  },
  {
    id: "group-school-2",
    session_id: "session-istoki-school-2026",
    name: "Группа 2",
    curator_id: "user-curator-2",
    description: "Нужна более ясная рамка практикумов и короткие паузы.",
  },
  {
    id: "group-school-3",
    session_id: "session-istoki-school-2026",
    name: "Группа 3",
    curator_id: "user-curator-3",
    description: "Высокая устойчивость, хорошо работают форматы с ясной ролью.",
  },
];

const SESSION_USERS = [
  ["session-istoki-school-2026", "user-participant-1", "group-school-1", "participant"],
  ["session-istoki-school-2026", "user-participant-2", "group-school-1", "participant"],
  ["session-istoki-school-2026", "user-participant-3", "group-school-1", "participant"],
  ["session-istoki-school-2026", "user-participant-4", "group-school-2", "participant"],
  ["session-istoki-school-2026", "user-curator-1", "group-school-1", "curator"],
  ["session-istoki-school-2026", "user-curator-2", "group-school-2", "curator"],
  ["session-istoki-school-2026", "user-curator-3", "group-school-3", "curator"],
  ["session-istoki-school-2026", "user-organizer-1", null, "organizer"],
  ["session-vypusknoy-2026", "user-curator-2", "group-vypusknoy-1", "curator"],
  ["session-vypusknoy-2026", "user-organizer-1", null, "organizer"],
];

const SPEAKERS = [
  {
    id: "speaker-1",
    name: "Анна Сорокина",
    role: "Спикер",
    topics: ["дизайн сообщества", "ценности"],
  },
  {
    id: "speaker-2",
    name: "Павел Демидов",
    role: "Ведущий мастерских",
    topics: ["практикум", "фасилитация"],
  },
  {
    id: "speaker-3",
    name: "Ирина Богданова",
    role: "Куратор рефлексии",
    topics: ["рефлексия", "вечерняя свечка"],
  },
];

const PROGRAMS = [
  {
    id: "program-core",
    session_id: "session-istoki-school-2026",
    title: "Основная программа",
    description: "Ключевая канва заезда: общие события, практикумы и синхронизация.",
    event_title: "Истоки. Школа",
    event_type: "Образовательный заезд",
    venue: "Кампус Северный",
    start_date: "2026-07-12",
    end_date: "2026-07-15",
    participant_count: 56,
    event_description: "Трёхдневная программа для участников форума.",
    is_current: true,
    status: "published",
  },
  {
    id: "program-evening",
    session_id: "session-istoki-school-2026",
    title: "Вечерняя программа",
    description: "Рефлексивные и неформальные форматы с тихой альтернативой.",
    event_title: "Вечерняя программа Истоков",
    event_type: "Рефлексивный контур",
    venue: "Каминный зал",
    start_date: "2026-07-12",
    end_date: "2026-07-15",
    participant_count: 56,
    event_description: "Вечерние точки сборки дня.",
    is_current: false,
    status: "published",
  },
  {
    id: "program-vypusknoy",
    session_id: "session-vypusknoy-2026",
    title: "Программа выпускного",
    description: "Однодневная программа с общим сбором, лекцией и вечерней встречей.",
    event_title: "Выпускной",
    event_type: "Форумное событие",
    venue: "Москва, кампус программы",
    start_date: "2026-06-18",
    end_date: "2026-06-18",
    participant_count: 120,
    event_description: "Однодневное событие для участников и выпускников.",
    is_current: true,
    status: "published",
  },
];

const DAYS = [
  ["program-core-day-1", "program-core", 1, "День 1", "12 июля", "2026-07-12"],
  ["program-core-day-2", "program-core", 2, "День 2", "13 июля", "2026-07-13"],
  ["program-core-day-3", "program-core", 3, "День 3", "14 июля", "2026-07-14"],
  ["program-evening-day-1", "program-evening", 1, "День 1", "12 июля", "2026-07-12"],
  ["program-vypusknoy-day-1", "program-vypusknoy", 1, "День 1", "18 июня", "2026-06-18"],
];

const EVENTS = [
  {
    id: "event-d1-start",
    day_id: "program-core-day-1",
    program_id: "program-core",
    title: "Утренний сбор",
    start_time: "09:00",
    end_time: "09:45",
    event_type: "Групповая",
    speaker_id: null,
    location: "Большой зал",
    track: "Общий поток",
    parallel_group: "A",
    status: "completed",
    description: "Мягкий старт и настройка на ритм дня.",
    tags: ["ритуал", "включение"],
  },
  {
    id: "event-d1-trip",
    day_id: "program-core-day-1",
    program_id: "program-core",
    title: "Экскурсия",
    start_time: "10:00",
    end_time: "12:00",
    event_type: "Экскурсия",
    speaker_id: null,
    location: "Маршрут 1",
    track: "Общий поток",
    parallel_group: "A",
    status: "completed",
    description: "Погружение в контекст форума вне аудитории.",
    tags: ["контекст", "движение"],
  },
  {
    id: "event-d2-start",
    day_id: "program-core-day-2",
    program_id: "program-core",
    title: "Утренний сбор",
    start_time: "09:00",
    end_time: "09:45",
    event_type: "Групповая",
    speaker_id: null,
    location: "Большой зал",
    track: "Общий поток",
    parallel_group: "A",
    status: "completed",
    description: "Сверка состояния и настройка на насыщенный день.",
    tags: ["ритуал", "включение"],
  },
  {
    id: "event-d2-lecture",
    day_id: "program-core-day-2",
    program_id: "program-core",
    title: "Лекция: дизайн сообщества",
    start_time: "10:00",
    end_time: "11:30",
    event_type: "Лекция",
    speaker_id: "speaker-1",
    location: "Большой зал",
    track: "Общий поток",
    parallel_group: "A",
    status: "active",
    description: "Сильный контентный блок, выбран как актуальное мероприятие.",
    tags: ["смыслы", "спикер"],
  },
  {
    id: "event-d2-workshop-a",
    day_id: "program-core-day-2",
    program_id: "program-core",
    title: "Мастерская A: медиа и нарратив",
    start_time: "14:00",
    end_time: "15:30",
    event_type: "Практикум",
    speaker_id: "speaker-2",
    location: "Аудитория 5",
    track: "Поток A",
    parallel_group: "P1",
    status: "planned",
    description: "Параллельная мастерская по работе с нарративами.",
    tags: ["параллель", "медиа"],
  },
  {
    id: "event-d2-workshop-b",
    day_id: "program-core-day-2",
    program_id: "program-core",
    title: "Мастерская B: фасилитация группы",
    start_time: "14:00",
    end_time: "15:30",
    event_type: "Практикум",
    speaker_id: "speaker-2",
    location: "Аудитория 6",
    track: "Поток B",
    parallel_group: "P1",
    status: "planned",
    description: "Параллельный трек по групповым инструментам.",
    tags: ["параллель", "фасилитация"],
  },
  {
    id: "event-d3-reflection",
    day_id: "program-core-day-3",
    program_id: "program-core",
    title: "Итоговая рефлексия",
    start_time: "11:00",
    end_time: "12:30",
    event_type: "Рефлексия",
    speaker_id: "speaker-3",
    location: "Каминный зал",
    track: "Общий поток",
    parallel_group: "A",
    status: "planned",
    description: "Сборка опыта заезда и фиксация выводов.",
    tags: ["рефлексия", "итоги"],
  },
  {
    id: "event-e1-campfire",
    day_id: "program-evening-day-1",
    program_id: "program-evening",
    title: "Вечерняя свечка",
    start_time: "19:00",
    end_time: "20:15",
    event_type: "Рефлексия",
    speaker_id: "speaker-3",
    location: "Каминный зал",
    track: "Общий поток",
    parallel_group: "B",
    status: "completed",
    description: "Основной вечерний формат сборки дня.",
    tags: ["рефлексия", "группа"],
  },
  {
    id: "event-vypusknoy-open",
    day_id: "program-vypusknoy-day-1",
    program_id: "program-vypusknoy",
    title: "Открытие выпускного",
    start_time: "12:00",
    end_time: "13:00",
    event_type: "Общая встреча",
    speaker_id: null,
    location: "Главный зал",
    track: "Общий поток",
    parallel_group: "A",
    status: "active",
    description: "Стартовое мероприятие выпускного события.",
    tags: ["выпускной", "старт"],
  },
  {
    id: "event-vypusknoy-lecture",
    day_id: "program-vypusknoy-day-1",
    program_id: "program-vypusknoy",
    title: "Лекция: следующий шаг после программы",
    start_time: "14:00",
    end_time: "15:00",
    event_type: "Лекция",
    speaker_id: null,
    location: "Главный зал",
    track: "Общий поток",
    parallel_group: "A",
    status: "planned",
    description: "Смысловой блок о переходе из программы в сообщество выпускников.",
    tags: ["лекция", "смыслы"],
  },
  {
    id: "event-vypusknoy-workshop",
    day_id: "program-vypusknoy-day-1",
    program_id: "program-vypusknoy",
    title: "Параллельные мастерские выпускников",
    start_time: "15:30",
    end_time: "17:00",
    event_type: "Мастер-класс",
    speaker_id: null,
    location: "Аудитории 1-3",
    track: "Параллельные группы",
    parallel_group: "P1",
    status: "planned",
    description: "Несколько параллельных мастерских по интересам.",
    tags: ["параллель", "мастерская"],
  },
];

const PARTICIPANT_PROFILES = {
  "user-participant-1": {
    emotionalProfile: "социально-групповой ресурсный",
    identityStatus: "searching moratorium",
    states: [2, 4, 3, 5, 3, 2, 3, 4],
  },
  "user-participant-2": {
    emotionalProfile: "смысло-рефлексивный",
    identityStatus: "moratorium",
    states: [3, 4, 3, 4, 4, 3, 4, 4],
  },
  "user-participant-3": {
    emotionalProfile: "эмоционально-чувствительный",
    identityStatus: "troubled diffusion",
    states: [1, 2, 2, 5, 2, 1, 3, 2],
  },
  "user-participant-4": {
    emotionalProfile: "адаптивно-стабильный",
    identityStatus: "foreclosure",
    states: [3, 3, 3, 4, 3, 3, 4, 3],
  },
};

async function upsert(tableName, row, conflict = ["id"]) {
  const columns = Object.keys(row);
  const conflictColumns = Array.isArray(conflict) ? conflict : [conflict];
  const placeholders = columns.map((_, index) => `$${index + 1}`);
  const updates = columns
    .filter((column) => !conflictColumns.includes(column))
    .map((column) => `${column} = excluded.${column}`);
  const sql = `
    insert into ${tableName} (${columns.join(", ")})
    values (${placeholders.join(", ")})
    on conflict (${conflictColumns.join(", ")})
    do update set ${updates.length ? updates.join(", ") : `${conflictColumns[0]} = excluded.${conflictColumns[0]}`}
  `;
  await query(
    sql,
    columns.map((column) => row[column]),
  );
}

async function seedSessions() {
  for (const session of SESSIONS) {
    await upsert("sessions", {
      ...session,
      edit_window: "Редактирование до 03:00 следующего дня",
      registration_status: "open",
      registration_starts_at: "2026-04-01T00:00:00.000Z",
      registration_ends_at:
        session.id === "session-vypusknoy-2026"
          ? "2026-06-17T20:59:00.000Z"
          : "2026-07-11T20:59:00.000Z",
      registration_capacity: session.id === "session-vypusknoy-2026" ? 120 : 56,
      registration_policy: JSON.stringify({
        mode: "public",
        note: "Открытая демо-регистрация на заезд.",
      }),
      created_by: "user-admin-1",
      updated_by: "user-admin-1",
      settings: JSON.stringify({
        scaleNote: "Шкала состояния: выгорание - интеграция - дистресс",
        aiPolicy: "ИИ-аналитика без лишних персональных данных",
        reflectionPrompts: [
          "Как я себя чувствую в конце дня?",
          "Что сегодня было особенно важным?",
        ],
      }),
    });
  }
}

async function seedReference() {
  for (const state of STATES) {
    await upsert("state_scale_levels", {
      id: state[0],
      session_id: null,
      level: state[1],
      label: state[2],
      short_label: state[3],
      icon: state[4],
      color: state[5],
      surface: state[6],
      text_color: state[7],
      enabled: true,
      sort_order: state[1],
    });
  }
}

async function seedUsersAndGroups() {
  for (const user of USERS) {
    const profile = PARTICIPANT_PROFILES[user.id] || {};
    await upsert("users", {
      ...user,
      status: "active",
      meta: JSON.stringify({
        emotionalProfile: profile.emotionalProfile,
        identityStatus: profile.identityStatus,
      }),
    });
  }

  for (const group of GROUPS) {
    await upsert("groups", group);
  }

  for (const [sessionId, userId, groupId, role] of SESSION_USERS) {
    await upsert(
      "session_users",
      {
        session_id: sessionId,
        user_id: userId,
        group_id: groupId,
        role,
        status: "active",
      },
      ["session_id", "user_id"],
    );
  }
}

async function seedProgram() {
  const programsById = new Map(PROGRAMS.map((program) => [program.id, program]));

  for (const speaker of SPEAKERS) {
    await upsert("speakers", {
      ...speaker,
      session_id: "session-istoki-school-2026",
      meta: JSON.stringify({}),
    });
  }

  for (const program of PROGRAMS) {
    await upsert("programs", {
      ...program,
    });
  }

  for (const [id, programId, dayNumber, label, dateLabel, dateValue] of DAYS) {
    const program = programsById.get(programId);
    await upsert("program_days", {
      id,
      program_id: programId,
      session_id: program?.session_id || "session-istoki-school-2026",
      day_number: dayNumber,
      label,
      date_label: dateLabel,
      date_value: dateValue,
      flow_order: JSON.stringify(["A", "P1", "P2", "B"]),
      flow_meta: JSON.stringify({
        A: { label: "A", track: "" },
        P1: { label: "P1", track: "" },
        P2: { label: "P2", track: "" },
        B: { label: "B", track: "" },
      }),
    });
  }

  for (const [index, event] of EVENTS.entries()) {
    const { tags, ...eventRow } = event;
    const program = programsById.get(event.program_id);
    await upsert("program_events", {
      ...eventRow,
      session_id: program?.session_id || "session-istoki-school-2026",
      sort_order: index,
      meta: JSON.stringify({}),
    });
    for (const tag of tags) {
      await upsert("event_tags", { event_id: event.id, tag }, ["event_id", "tag"]);
    }
  }
}

async function seedDiary() {
  const participants = Object.keys(PARTICIPANT_PROFILES);
  const schoolEvents = EVENTS.filter((event) => event.program_id !== "program-vypusknoy");

  for (const userId of participants) {
    const profile = PARTICIPANT_PROFILES[userId];
    for (const [index, event] of schoolEvents.entries()) {
      const level = profile.states[index % profile.states.length];
      const stateId = STATES.find((state) => state[1] === level)?.[0] || "balance";
      await upsert("diary_entries", {
        id: `entry-${userId}-${event.id}`,
        user_id: userId,
        session_id: "session-istoki-school-2026",
        day_id: event.day_id,
        event_id: event.id,
        state_id: stateId,
        state_level: level,
        comment:
          level >= 5
            ? "Было очень интенсивно, не хватило паузы."
            : level <= 1
              ? "Сложно включиться, хочется больше ясности и отдыха."
              : "Формат помог включиться и удержать внимание.",
        confidence: level <= 1 ? "low" : "high",
        source: "web",
        responded_at: "2026-07-13T12:00:00.000Z",
        meta: JSON.stringify({}),
      });
    }

    for (const day of DAYS.filter((item) => item[1] === "program-core")) {
      await upsert(
        "daily_reflections",
        {
          id: `reflection-${userId}-${day[0]}`,
          user_id: userId,
          session_id: "session-istoki-school-2026",
          day_id: day[0],
          answers: JSON.stringify({
            q1: "В целом день прошёл содержательно.",
            q2: "Самым важным было обсуждение в группе.",
            q3: "Завтра пригодятся паузы и понятная рамка.",
          }),
          free_text: "Хочу сохранить баланс между активностью и восстановлением.",
          responded_at: "2026-07-13T12:30:00.000Z",
        },
        ["user_id", "session_id", "day_id"],
      );
    }
  }
}

async function seedSurveys() {
  const surveys = [
    {
      id: "survey-identity-status",
      title: "Стартовый опрос по статусу идентичности",
      category: "Стартовый скрининг",
      cadence: "однократно в начале заезда",
      source: "Адаптировано по мотивам Becht et al. и Hatano et al.",
      description: "Черновой опрос для оценки commitment, exploration и reconsideration.",
      status: "draft",
      questions: [
        "У меня уже есть достаточно ясное представление о своих целях и ценностях.",
        "Сейчас я активно исследую разные варианты будущего и ролей для себя.",
        "Я часто пересматриваю уже принятые решения о себе и своём пути.",
      ],
    },
    {
      id: "survey-identity-fluctuation",
      title: "Ежедневный опрос по флуктуациям идентичности",
      category: "Ежедневный pulse",
      cadence: "ежедневно вечером",
      source: "Адаптировано по мотивам daily identity processes.",
      description: "Короткий pulse для отслеживания ежедневных колебаний идентичности.",
      status: "published",
      questions: [
        "Сегодня у меня было ясное ощущение, кто я и к чему иду.",
        "Сегодня я активно пробовал(а) понять, какая роль мне ближе.",
        "Какая зона самоопределения сегодня была самой чувствительной?",
      ],
    },
    {
      id: "survey-disc-team-role",
      title: "Командная роль по мотивам DISC",
      category: "Командное взаимодействие",
      cadence: "по решению организатора",
      source: "Прототипический конструктор без претензии на психометрическую валидность.",
      description: "Опросник для рабочей гипотезы о стиле участия в команде.",
      status: "draft",
      questions: ["В новой группе я чаще всего...", "Когда команда буксует, я скорее..."],
    },
  ];

  for (const survey of surveys) {
    const { questions, ...surveyRow } = survey;
    await upsert("surveys", {
      ...surveyRow,
      session_id: "session-istoki-school-2026",
    });

    for (const [index, question] of questions.entries()) {
      await upsert("survey_questions", {
        id: `${survey.id}-q${index + 1}`,
        survey_id: survey.id,
        question_type:
          index === 2 && survey.id === "survey-identity-fluctuation" ? "single" : "scale",
        title: question,
        options: JSON.stringify(
          index === 2
            ? ["роль в группе", "учёба / профессия", "личные ценности", "отношения"]
            : ["1", "2", "3", "4", "5", "6"],
        ),
        sort_order: index,
        meta: JSON.stringify({}),
      });
    }
  }

  await upsert("survey_publications", {
    id: "publication-identity-fluctuation",
    survey_id: "survey-identity-fluctuation",
    session_id: "session-istoki-school-2026",
    status: "active",
    published_at: "2026-07-13T08:30:00.000Z",
    audience_summary: "Истоки. Школа · 17-22 лет · все группы · все эмоциональные профили",
    recipients_count: 4,
    filters: JSON.stringify({
      ageMin: 17,
      ageMax: 22,
      genders: [],
      emotionalProfiles: [],
      groupIds: [],
    }),
  });
}

async function seedAnalytics() {
  await upsert("risk_signals", {
    id: "risk-group-1",
    session_id: "session-istoki-school-2026",
    group_id: "group-school-1",
    user_id: "user-participant-3",
    severity: "high",
    title: "Резкие скачки у участника",
    detail: "После практикума фиксируется рост до перевозбуждения и комментарии про перегруз.",
    status: "open",
  });

  await upsert("comment_clusters", {
    id: "cluster-overload",
    session_id: "session-istoki-school-2026",
    group_id: "group-school-1",
    label: "перегруз / нет пауз",
    summary: "Комментарии про шум, плотность и потребность в восстановлении.",
    score: 0.82,
    meta: JSON.stringify({}),
  });

  for (const [userId, profile] of Object.entries(PARTICIPANT_PROFILES)) {
    await upsert("typology_assignments", {
      id: `typology-${userId}`,
      user_id: userId,
      session_id: "session-istoki-school-2026",
      typology: profile.emotionalProfile,
      score: 0.76,
      explanation: "Назначено rule-based по амплитуде, пикам и реакции на форматы.",
      features: JSON.stringify({ source: "seed" }),
      model_version: "rule-based-v1",
    });
  }

  await upsert("ai_reports", {
    id: "ai-report-session-day-2",
    session_id: "session-istoki-school-2026",
    group_id: null,
    scope: "session-day",
    day_id: "program-core-day-2",
    title: "Итоги дня по заезду",
    confidence: "medium",
    content: JSON.stringify({
      bullets: [
        "Смысловые форматы дали рост вовлечённости.",
        "Основной риск дня — плотные практикумы без декомпрессии.",
        "Участники просят больше понятности, движения и коротких пауз.",
      ],
      recommendation: "Развести интенсивные практикумы и логистику во времени.",
    }),
    version: 1,
    created_by: "AI Analytics",
  });

  await upsert("audit_log", {
    id: "audit-seed-1",
    actor_id: "user-organizer-1",
    session_id: "session-istoki-school-2026",
    action: "seed database",
    entity_type: "database",
    entity_id: "initial",
    payload: JSON.stringify({ source: "seedDatabase" }),
  });
}

async function main() {
  if (!hasPostgresConfig()) {
    throw new Error("PostgreSQL is not configured. Fill .env first.");
  }

  await ensureSchema();
  await seedSessions();
  await seedReference();
  await seedUsersAndGroups();
  await seedProgram();
  await seedDiary();
  await seedSurveys();
  await seedAnalytics();
  await seedIstokiRegions();

  console.log("[db:seed] Demo data is ready.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

module.exports = {
  main,
  seedId: () => randomUUID(),
};
