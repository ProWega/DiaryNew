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

const STORAGE_KEY = "newdiary-mock-api-v2";
const SESSION_ID = "session-istoki-april-2026";

const GROUPS = [
  { id: "group-1", label: "Группа 1", sessionId: SESSION_ID, curatorId: "user-curator-1" },
  { id: "group-2", label: "Группа 2", sessionId: SESSION_ID, curatorId: "user-curator-2" },
  { id: "group-3", label: "Группа 3", sessionId: SESSION_ID, curatorId: "user-curator-3" },
];

const USERS = [
  {
    id: "user-participant-1",
    fullName: "Боря Соколов",
    role: "participant",
    roleLabel: "Участник",
    sessionId: SESSION_ID,
    sessionLabel: "Истоки / Апрель 2026",
    groupId: "group-1",
    groupLabel: "Группа 1",
  },
  {
    id: "user-curator-1",
    fullName: "Марина Чернова",
    role: "curator",
    roleLabel: "Куратор",
    sessionId: SESSION_ID,
    sessionLabel: "Истоки / Апрель 2026",
    groupId: "group-1",
    groupLabel: "Группа 1",
  },
  {
    id: "user-organizer-1",
    fullName: "Алексей Волков",
    role: "organizer",
    roleLabel: "Организатор",
    sessionId: SESSION_ID,
    sessionLabel: "Истоки / Апрель 2026",
    groupId: "group-1",
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

function buildSeedDatabase() {
  return {
    sessions: [
      {
        id: SESSION_ID,
        ...sessionInfo,
      },
    ],
    groups: GROUPS,
    users: USERS,
    reference: {
      stateScale,
      reflectionPrompts,
    },
    participantDiaryByUserId: {
      "user-participant-1": {
        currentDayId: "day-2",
        history: participantHistory,
      },
    },
    curatorDashboardByGroupId: {
      "group-1": {
        ...curatorOverview,
        groupId: "group-1",
        sessionId: SESSION_ID,
      },
    },
    organizerDashboardBySessionId: {
      [SESSION_ID]: {
        ...organizerOverview,
        sessionId: SESSION_ID,
      },
    },
    adminDashboard: adminOverview,
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

function enrichBootstrap(viewer) {
  return {
    viewer,
    sessionInfo,
    stateScale,
    reflectionPrompts,
    navigation: getNavigationItems(viewer),
    scopeBadges: getScopeBadges(viewer),
  };
}

async function listUsers() {
  await delay();

  return USERS.map((user) => ({
    id: user.id,
    fullName: user.fullName,
    role: user.role,
    roleLabel: user.roleLabel,
    sessionId: user.sessionId ?? null,
    sessionLabel: user.sessionLabel ?? null,
    groupId: user.groupId ?? null,
    groupLabel: user.groupLabel ?? null,
  }));
}

async function getBootstrap({ viewerId }) {
  await delay();

  const db = readDatabase();
  const viewer = getViewer(db, viewerId);

  return enrichBootstrap(viewer);
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
    throw createHttpError(404, "Данные заезда не найдены");
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
  getBootstrap,
  getParticipantDiary,
  updateParticipantEntry,
  updateParticipantReflection,
  getCuratorDashboard,
  getOrganizerDashboard,
  getAdminDashboard,
};
