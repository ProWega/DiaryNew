import {
  adminOverview,
  curatorOverview,
  organizerOverview,
  participantHistory,
  reflectionPrompts,
  sessionInfo,
  stateScale,
} from "../data/mockData";
import { can, getNavigationItems, getScopeBadges } from "../rbac/permissions";

const STORAGE_KEY = "newdiary-mock-api-v4";

const SESSION_CATALOG = [
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

const DEFAULT_SESSION_ID = "session-istoki-school-2026";

const GROUPS = [
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

const USERS = [
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

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function createSessionInfo(session) {
  return {
    ...sessionInfo,
    name: session.name,
    cycle: session.cycle,
    dateLabel: session.dateLabel,
    location: session.location,
  };
}

function buildSeedDatabase() {
  return {
    sessions: SESSION_CATALOG.map((session) => ({
      id: session.id,
      ...createSessionInfo(session),
    })),
    groups: cloneJson(GROUPS),
    users: cloneJson(USERS),
    reference: {
      stateScale,
      reflectionPrompts,
    },
    participantDiaryByUserId: {
      "user-participant-1": {
        currentDayId: "day-2",
        history: cloneJson(participantHistory),
      },
    },
    curatorDashboardByGroupId: {
      "group-school-1": {
        ...curatorOverview,
        groupId: "group-school-1",
        sessionId: DEFAULT_SESSION_ID,
      },
    },
    organizerDashboardBySessionId: {
      [DEFAULT_SESSION_ID]: {
        ...organizerOverview,
        sessionId: DEFAULT_SESSION_ID,
      },
    },
    adminDashboard: cloneJson(adminOverview),
  };
}

function readDatabase() {
  if (typeof window === "undefined" || !window.localStorage) {
    return cloneJson(buildSeedDatabase());
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);

  if (!stored) {
    const seed = buildSeedDatabase();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    return cloneJson(seed);
  }

  return JSON.parse(stored);
}

function writeDatabase(nextDatabase) {
  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextDatabase));
  }
}

function delay(ms = 140) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function getSession(db, sessionId) {
  const session = db.sessions.find((item) => item.id === sessionId);

  if (!session) {
    throw createHttpError(404, "Событие не найдено");
  }

  return session;
}

function getViewer(db, viewerId) {
  const viewer = db.users.find((user) => user.id === viewerId);

  if (!viewer) {
    throw createHttpError(401, "Пользователь не найден");
  }

  return viewer;
}

function ensureAccess(db, viewerId, permission, subject = {}) {
  const viewer = getViewer(db, viewerId);

  if (!can(viewer, permission, subject)) {
    throw createHttpError(403, "Недостаточно прав для этого действия");
  }

  return viewer;
}

function getViewerSessionInfo(db, viewer) {
  if (!viewer?.sessionId) {
    return sessionInfo;
  }

  return getSession(db, viewer.sessionId);
}

function enrichBootstrap(db, viewer) {
  return {
    viewer,
    sessionInfo: getViewerSessionInfo(db, viewer),
    stateScale,
    reflectionPrompts,
    navigation: getNavigationItems(viewer),
    scopeBadges: getScopeBadges(viewer),
  };
}

function toPublicUser(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    role: user.role,
    roleLabel: user.roleLabel,
    sessionId: user.sessionId ?? null,
    sessionLabel: user.sessionLabel ?? null,
    groupId: user.groupId ?? null,
    groupLabel: user.groupLabel ?? null,
  };
}

function getDefaultGroupForSession(db, sessionId) {
  return db.groups.find((group) => group.sessionId === sessionId) ?? null;
}

function createParticipantUser({ fullName, sessionId, sessionLabel, group }) {
  const userId = `user-participant-${Math.random().toString(36).slice(2, 10)}`;

  return {
    id: userId,
    fullName,
    role: "participant",
    roleLabel: "Участник",
    sessionId,
    sessionLabel,
    groupId: group.id,
    groupLabel: group.label,
  };
}

async function listUsers() {
  await delay();
  const db = readDatabase();
  return db.users.map(toPublicUser);
}

async function listPublicEvents() {
  await delay();
  return cloneJson(
    SESSION_CATALOG.map((session) => ({
      id: session.id,
      label: session.name,
      description: `${session.cycle} · ${session.dateLabel} · ${session.location}`,
    })),
  );
}

async function registerParticipant({ fullName, sessionId }) {
  await delay();

  const db = readDatabase();
  const trimmedName = String(fullName || "").trim();

  if (!trimmedName) {
    throw createHttpError(400, "Укажите имя участника");
  }

  const session = getSession(db, sessionId);
  const group = getDefaultGroupForSession(db, sessionId);

  if (!group) {
    throw createHttpError(400, "Для выбранного события ещё не настроены группы");
  }

  const nextUser = createParticipantUser({
    fullName: trimmedName,
    sessionId,
    sessionLabel: session.name,
    group,
  });

  db.users.push(nextUser);
  db.participantDiaryByUserId[nextUser.id] = {
    currentDayId: "day-2",
    history: cloneJson(participantHistory),
  };

  writeDatabase(db);

  return {
    user: toPublicUser(nextUser),
  };
}

async function getBootstrap({ viewerId }) {
  await delay();
  const db = readDatabase();
  const viewer = getViewer(db, viewerId);
  return enrichBootstrap(db, viewer);
}

async function getParticipantDiary({ viewerId, sessionId }) {
  await delay();

  const db = readDatabase();
  const viewer = ensureAccess(db, viewerId, "participant.diary.read", {
    sessionId,
    userId: viewerId,
  });
  const diary = db.participantDiaryByUserId[viewer.id];

  if (!diary) {
    throw createHttpError(404, "Дневник участника не найден");
  }

  return {
    sessionId,
    currentDayId: diary.currentDayId,
    history: cloneJson(diary.history),
  };
}

async function updateParticipantEntry({
  viewerId,
  sessionId,
  dayId,
  entryId,
  patch,
}) {
  const db = readDatabase();
  const viewer = ensureAccess(db, viewerId, "participant.diary.write", {
    sessionId,
    userId: viewerId,
  });
  const diary = db.participantDiaryByUserId[viewer.id];

  if (!diary) {
    throw createHttpError(404, "Дневник участника не найден");
  }

  diary.history = diary.history.map((day) =>
    day.id === dayId
      ? {
          ...day,
          events: day.events.map((entry) =>
            entry.id === entryId
              ? {
                  ...entry,
                  ...patch,
                }
              : entry,
          ),
        }
      : day,
  );

  writeDatabase(db);

  return {
    sessionId,
    currentDayId: diary.currentDayId,
    history: cloneJson(diary.history),
  };
}

async function updateParticipantReflection({
  viewerId,
  sessionId,
  dayId,
  patch,
}) {
  const db = readDatabase();
  const viewer = ensureAccess(db, viewerId, "participant.diary.write", {
    sessionId,
    userId: viewerId,
  });
  const diary = db.participantDiaryByUserId[viewer.id];

  if (!diary) {
    throw createHttpError(404, "Рефлексия участника не найдена");
  }

  diary.history = diary.history.map((day) =>
    day.id === dayId
      ? {
          ...day,
          reflection: {
            ...day.reflection,
            ...patch,
          },
        }
      : day,
  );

  writeDatabase(db);

  return {
    sessionId,
    currentDayId: diary.currentDayId,
    history: cloneJson(diary.history),
  };
}

async function getCuratorDashboard({ viewerId, sessionId, groupId }) {
  await delay();

  const db = readDatabase();
  ensureAccess(db, viewerId, "group.analytics.read", {
    sessionId,
    groupId,
  });

  const dashboard = db.curatorDashboardByGroupId[groupId];

  if (!dashboard) {
    throw createHttpError(404, "Данные группы не найдены");
  }

  return cloneJson(dashboard);
}

async function getOrganizerDashboard({ viewerId, sessionId }) {
  await delay();

  const db = readDatabase();
  ensureAccess(db, viewerId, "session.analytics.read", {
    sessionId,
  });

  const dashboard = db.organizerDashboardBySessionId[sessionId];

  if (!dashboard) {
    throw createHttpError(404, "Данные события не найдены");
  }

  return cloneJson(dashboard);
}

async function getAdminDashboard({ viewerId }) {
  await delay();

  const db = readDatabase();
  ensureAccess(db, viewerId, "security.read");

  return cloneJson(db.adminDashboard);
}

export const mockServer = {
  listUsers,
  listPublicEvents,
  registerParticipant,
  getBootstrap,
  getParticipantDiary,
  updateParticipantEntry,
  updateParticipantReflection,
  getCuratorDashboard,
  getOrganizerDashboard,
  getAdminDashboard,
};
