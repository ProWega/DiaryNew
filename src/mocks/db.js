import { selectClosestProgramDay } from "../lib/programDays";
import { can, getNavigationItems, getScopeBadges } from "../rbac/permissions";
import {
  SESSION_CATALOG,
  DEFAULT_SESSION_ID,
  GROUPS,
  USERS,
  stateScale,
  reflectionPrompts,
  sessionInfoDefaults,
  participantHistory,
  curatorOverview,
  organizerOverview,
  adminOverview,
} from "./fixtures";

const STORAGE_KEY = "newdiary-mock-api-v4";

export function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function getDefaultCurrentDayId(history) {
  return selectClosestProgramDay(history)?.id || history[0]?.id || "";
}

function createSessionInfo(session) {
  return {
    ...sessionInfoDefaults,
    name: session.name,
    cycle: session.cycle,
    dateLabel: session.dateLabel,
    location: session.location,
  };
}

export function buildSeedDatabase() {
  return {
    sessions: SESSION_CATALOG.map((session) => ({
      id: session.id,
      ...createSessionInfo(session),
    })),
    groups: cloneJson(GROUPS),
    users: cloneJson(USERS),
    reference: { stateScale, reflectionPrompts },
    participantDiaryByUserId: {
      "user-participant-1": {
        currentDayId: getDefaultCurrentDayId(participantHistory),
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
    curatorBriefByGroupId: {
      "group-school-1": {
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
            participantId: "user-participant-2",
            displayName: "Анна К.",
            reason: "careful_mode",
            note: "Сейчас «бережно» — стоит подойти деликатно, без давления.",
          },
          {
            participantId: "user-participant-3",
            displayName: "Илья М.",
            reason: "shift_down",
            note: "Вчера в Ладе, сегодня в Сбое.",
          },
        ],
        stageResonance: {
          search: 4,
          verification: 3,
          support: 3,
          transmission: 2,
          careful: 2,
        },
        events: [
          {
            id: "event-1",
            title: "Утренний круг",
            responseCount: 9,
            quotes: ["Тепло настроились на день"],
          },
        ],
        participantCards: [
          {
            userId: "user-participant-1",
            displayName: "Иван П.",
            journeyStage: "support",
            journeyStageLabel: "Опора",
            isCarefulMode: false,
            today: { id: "harmony", ru: "Лад" },
            yesterday: { id: "tuning", ru: "Настройка" },
            conversationHint: null,
          },
          {
            userId: "user-participant-2",
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
            userId: "user-participant-3",
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
            userId: "user-participant-4",
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
          ],
        },
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

export function readDatabase() {
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

export function writeDatabase(nextDb) {
  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextDb));
  }
}

export function createMockError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function getSession(db, sessionId) {
  const session = db.sessions.find((item) => item.id === sessionId);

  if (!session) {
    throw createMockError(404, "Событие не найдено");
  }

  return session;
}

export function getViewer(db, viewerId) {
  const viewer = db.users.find((user) => user.id === viewerId);

  if (!viewer) {
    throw createMockError(401, "Пользователь не найден");
  }

  return viewer;
}

export function ensureAccess(db, viewerId, permission, subject = {}) {
  const viewer = getViewer(db, viewerId);

  if (!can(viewer, permission, subject)) {
    throw createMockError(403, "Недостаточно прав для этого действия");
  }

  return viewer;
}

export function enrichBootstrap(db, viewer) {
  const sessionInfo = viewer.sessionId
    ? db.sessions.find((s) => s.id === viewer.sessionId) || db.sessions[0]
    : db.sessions[0];

  return {
    viewer,
    sessionInfo,
    stateScale,
    reflectionPrompts,
    navigation: getNavigationItems(viewer),
    scopeBadges: getScopeBadges(viewer),
    // Methodology v4: journey stage + careful mode for current participant.
    // Persisted on the user record via PATCH /api/participant/.../journey-stage.
    journeyStage: viewer.journeyStage ?? null,
    isCarefulMode: viewer.isCarefulMode ?? false,
  };
}

export function toPublicUser(user) {
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

export function getDefaultGroupForSession(db, sessionId) {
  return db.groups.find((group) => group.sessionId === sessionId) ?? null;
}

export function registerParticipantInDb(db, { fullName, sessionId }) {
  const trimmedName = String(fullName || "").trim();

  if (!trimmedName) {
    throw createMockError(400, "Укажите имя участника");
  }

  const session = getSession(db, sessionId);
  const group = getDefaultGroupForSession(db, sessionId);

  if (!group) {
    throw createMockError(400, "Для выбранного события ещё не настроены группы");
  }

  const userId = `user-participant-${Math.random().toString(36).slice(2, 10)}`;
  const newUser = {
    id: userId,
    fullName: trimmedName,
    role: "participant",
    roleLabel: "Участник",
    sessionId,
    sessionLabel: session.name,
    groupId: group.id,
    groupLabel: group.label,
  };

  db.users.push(newUser);
  db.participantDiaryByUserId[userId] = {
    currentDayId:
      selectClosestProgramDay(participantHistory)?.id || participantHistory[0]?.id || "",
    history: cloneJson(participantHistory),
  };

  return { user: toPublicUser(newUser) };
}

export function getDiaryResponse(db, viewer, sessionId) {
  const diary = db.participantDiaryByUserId[viewer.id];

  if (!diary) {
    throw createMockError(404, "Дневник участника не найден");
  }

  return {
    sessionId,
    currentDayId:
      diary.currentDayId ||
      selectClosestProgramDay(diary.history)?.id ||
      diary.history[0]?.id ||
      "",
    history: cloneJson(diary.history),
  };
}
