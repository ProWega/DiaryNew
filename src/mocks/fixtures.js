import { STATE_SCALE_META, STATE_SCALE_ORDER } from "../data/stateScaleModel";

// Re-exported from mockData.js until views are refactored in Phase 2
export {
  reflectionPrompts,
  participantHistory,
  curatorOverview,
  organizerOverview,
  adminOverview,
} from "../data/mockData";

export const stateScale = STATE_SCALE_ORDER.map((id) => ({ id, ...STATE_SCALE_META[id] }));

// Shared session meta defaults (non-session-specific fields)
export const sessionInfoDefaults = {
  scaleNote: "Шкала состояния: выгорание - интеграция - дистресс",
  aiPolicy: "ИИ-отчёты работают только с обезличенными комментариями",
  editWindow: "Редактирование доступно до 03:00 следующего дня",
};

export const SESSION_CATALOG = [
  {
    id: "session-vypusknoy-2026",
    name: "Выпускной",
    cycle: "Июнь 2026",
    dateLabel: "18 июня 2026",
    location: "Москва",
  },
  {
    id: "session-istoki-school-2026",
    name: "Истоки. Школа",
    cycle: "Летняя школа / Июль 2026",
    dateLabel: "12-15 июля 2026",
    location: "Печоры",
  },
];

export const DEFAULT_SESSION_ID = "session-istoki-school-2026";

export const GROUPS = [
  {
    id: "group-vypusknoy-1",
    label: "Группа Выпускной",
    sessionId: "session-vypusknoy-2026",
    curatorId: "user-curator-2",
  },
  {
    id: "group-school-1",
    label: "Группа 1",
    sessionId: "session-istoki-school-2026",
    curatorId: "user-curator-1",
  },
  {
    id: "group-school-2",
    label: "Группа 2",
    sessionId: "session-istoki-school-2026",
    curatorId: "user-curator-2",
  },
  {
    id: "group-school-3",
    label: "Группа 3",
    sessionId: "session-istoki-school-2026",
    curatorId: "user-curator-3",
  },
];

export const USERS = [
  {
    id: "user-participant-1",
    fullName: "Боря Соколов",
    role: "participant",
    roleLabel: "Участник",
    sessionId: DEFAULT_SESSION_ID,
    sessionLabel: "Истоки. Школа",
    groupId: "group-school-1",
    groupLabel: "Группа 1",
  },
  {
    id: "user-curator-1",
    fullName: "Марина Чернова",
    role: "curator",
    roleLabel: "Куратор",
    sessionId: DEFAULT_SESSION_ID,
    sessionLabel: "Истоки. Школа",
    groupId: "group-school-1",
    groupLabel: "Группа 1",
  },
  {
    id: "user-curator-2",
    fullName: "Даниил Крылов",
    role: "curator",
    roleLabel: "Куратор",
    sessionId: DEFAULT_SESSION_ID,
    sessionLabel: "Истоки. Школа",
    groupId: "group-school-2",
    groupLabel: "Группа 2",
  },
  {
    id: "user-curator-3",
    fullName: "Елена Лисицына",
    role: "curator",
    roleLabel: "Куратор",
    sessionId: DEFAULT_SESSION_ID,
    sessionLabel: "Истоки. Школа",
    groupId: "group-school-3",
    groupLabel: "Группа 3",
  },
  {
    id: "user-organizer-1",
    fullName: "Алексей Волков",
    role: "organizer",
    roleLabel: "Организатор",
    sessionId: DEFAULT_SESSION_ID,
    sessionLabel: "Истоки. Школа",
    groupId: "group-school-1",
    groupLabel: "Все группы",
  },
  {
    id: "user-admin-1",
    fullName: "Системный администратор",
    role: "admin",
    roleLabel: "Администратор",
  },
];
