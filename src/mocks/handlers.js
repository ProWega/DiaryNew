import { http, HttpResponse, delay } from "msw";
import {
  readDatabase,
  writeDatabase,
  cloneJson,
  getViewer,
  ensureAccess,
  enrichBootstrap,
  toPublicUser,
  registerParticipantInDb,
  getDiaryResponse,
} from "./db";
import { SESSION_CATALOG } from "./fixtures";

const MS = 140;

function ok(data) {
  return HttpResponse.json(data);
}

function fail(error) {
  return HttpResponse.json({ message: error.message || "Ошибка" }, { status: error.status || 500 });
}

// ─── Auth ────────────────────────────────────────────────────────────────────

const authHandlers = [
  http.get("/api/auth/me", async () => {
    await delay(MS);
    return ok({ features: { devAuth: true, magicLinks: true }, user: null });
  }),

  http.post("/api/auth/logout", async () => {
    await delay(MS);
    return ok({ ok: true });
  }),

  http.post("/api/auth/magic-links", async () => {
    await delay(MS);
    return ok({ token: "mock-token-" + Math.random().toString(36).slice(2) });
  }),

  http.post("/api/auth/magic-links/consume", async () => {
    await delay(MS);
    const db = readDatabase();
    const user = db.users[0];
    return ok({ user: toPublicUser(user) });
  }),
];

// ─── Users / Public ──────────────────────────────────────────────────────────

const userHandlers = [
  http.get("/api/users", async () => {
    await delay(MS);
    const db = readDatabase();
    return ok(db.users.map(toPublicUser));
  }),

  http.get("/api/public/events", async () => {
    await delay(MS);
    return ok(
      SESSION_CATALOG.map((s) => ({
        id: s.id,
        label: s.name,
        description: `${s.cycle} · ${s.dateLabel} · ${s.location}`,
      })),
    );
  }),

  http.post("/api/participants/register", async ({ request }) => {
    await delay(MS);
    const body = await request.json();
    const db = readDatabase();

    try {
      const result = registerParticipantInDb(db, body);
      writeDatabase(db);
      return ok(result);
    } catch (error) {
      return fail(error);
    }
  }),
];

// ─── Bootstrap ───────────────────────────────────────────────────────────────

const bootstrapHandlers = [
  http.get("/api/bootstrap", async ({ request }) => {
    await delay(MS);
    const viewerId = request.headers.get("x-viewer-id");
    const db = readDatabase();

    try {
      const viewer = getViewer(db, viewerId);
      return ok(enrichBootstrap(db, viewer));
    } catch (error) {
      return fail(error);
    }
  }),
];

// ─── Participant ──────────────────────────────────────────────────────────────

const participantHandlers = [
  http.get("/api/participant/sessions/:sessionId/diary", async ({ request, params }) => {
    await delay(MS);
    const viewerId = request.headers.get("x-viewer-id");
    const { sessionId } = params;
    const db = readDatabase();

    try {
      const viewer = ensureAccess(db, viewerId, "participant.diary.read", {
        sessionId,
        userId: viewerId,
      });
      return ok(getDiaryResponse(db, viewer, sessionId));
    } catch (error) {
      return fail(error);
    }
  }),

  http.patch("/api/participant/sessions/:sessionId/diary/:entryId", async ({ request, params }) => {
    const viewerId = request.headers.get("x-viewer-id");
    const { sessionId, entryId } = params;
    const body = await request.json();
    const db = readDatabase();

    try {
      const viewer = ensureAccess(db, viewerId, "participant.diary.write", {
        sessionId,
        userId: viewerId,
      });
      const diary = db.participantDiaryByUserId[viewer.id];
      if (!diary) return HttpResponse.json({ message: "Дневник не найден" }, { status: 404 });

      const { dayId, ...patch } = body;
      diary.history = diary.history.map((day) =>
        day.id === dayId
          ? {
              ...day,
              events: day.events.map((entry) =>
                entry.id === entryId ? { ...entry, ...patch } : entry,
              ),
            }
          : day,
      );
      writeDatabase(db);
      return ok(getDiaryResponse(db, viewer, sessionId));
    } catch (error) {
      return fail(error);
    }
  }),

  http.patch(
    "/api/participant/sessions/:sessionId/reflections/:dayId",
    async ({ request, params }) => {
      const viewerId = request.headers.get("x-viewer-id");
      const { sessionId, dayId } = params;
      const patch = await request.json();
      const db = readDatabase();

      try {
        const viewer = ensureAccess(db, viewerId, "participant.diary.write", {
          sessionId,
          userId: viewerId,
        });
        const diary = db.participantDiaryByUserId[viewer.id];
        if (!diary) return HttpResponse.json({ message: "Дневник не найден" }, { status: 404 });

        diary.history = diary.history.map((day) =>
          day.id === dayId ? { ...day, reflection: { ...day.reflection, ...patch } } : day,
        );
        writeDatabase(db);
        return ok(getDiaryResponse(db, viewer, sessionId));
      } catch (error) {
        return fail(error);
      }
    },
  ),
];

// ─── Curator ──────────────────────────────────────────────────────────────────

const curatorHandlers = [
  http.get(
    "/api/curator/sessions/:sessionId/groups/:groupId/dashboard",
    async ({ request, params }) => {
      await delay(MS);
      const viewerId = request.headers.get("x-viewer-id");
      const { sessionId, groupId } = params;
      const db = readDatabase();

      try {
        ensureAccess(db, viewerId, "group.analytics.read", { sessionId, groupId });
        const dashboard = db.curatorDashboardByGroupId[groupId];
        if (!dashboard)
          return HttpResponse.json({ message: "Данные группы не найдены" }, { status: 404 });
        return ok(cloneJson(dashboard));
      } catch (error) {
        return fail(error);
      }
    },
  ),
];

// ─── Organizer ────────────────────────────────────────────────────────────────

const organizerHandlers = [
  http.get("/api/organizer/sessions/:sessionId/workspace", async ({ request, params }) => {
    await delay(MS);
    const viewerId = request.headers.get("x-viewer-id");
    const { sessionId } = params;
    const db = readDatabase();

    try {
      ensureAccess(db, viewerId, "session.analytics.read", { sessionId });
      const workspace = db.organizerDashboardBySessionId[sessionId];
      if (!workspace)
        return HttpResponse.json({ message: "Данные события не найдены" }, { status: 404 });
      return ok(cloneJson(workspace));
    } catch (error) {
      return fail(error);
    }
  }),

  http.get("/api/organizer/sessions/:sessionId/analytics", async ({ request, params }) => {
    await delay(MS);
    const viewerId = request.headers.get("x-viewer-id");
    const { sessionId } = params;
    const db = readDatabase();

    try {
      ensureAccess(db, viewerId, "session.analytics.read", { sessionId });
      const workspace = db.organizerDashboardBySessionId[sessionId];
      return ok(cloneJson(workspace || {}));
    } catch (error) {
      return fail(error);
    }
  }),

  http.get("/api/organizer/workspace", async ({ request }) => {
    await delay(MS);
    const viewerId = request.headers.get("x-viewer-id");
    const db = readDatabase();

    try {
      ensureAccess(db, viewerId, "session.analytics.read", {});
      return ok({ sessions: cloneJson(db.sessions) });
    } catch (error) {
      return fail(error);
    }
  }),

  // Session mutations
  http.post("/api/organizer/sessions", async () => {
    await delay(MS);
    return ok({ id: `session-${Math.random().toString(36).slice(2, 10)}` });
  }),

  http.patch("/api/organizer/sessions/:sessionId", async () => {
    await delay(MS);
    return ok({ ok: true });
  }),

  http.patch("/api/organizer/sessions/:sessionId/registration", async () => {
    await delay(MS);
    return ok({ ok: true });
  }),

  http.patch("/api/organizer/sessions/:sessionId/settings", async () => {
    await delay(MS);
    return ok({ ok: true });
  }),

  // Group mutations
  http.post("/api/organizer/sessions/:sessionId/groups", async () => {
    await delay(MS);
    return ok({ id: `group-${Math.random().toString(36).slice(2, 10)}` });
  }),

  http.patch("/api/organizer/sessions/:sessionId/groups/:groupId", async () => {
    await delay(MS);
    return ok({ ok: true });
  }),

  http.delete("/api/organizer/sessions/:sessionId/groups/:groupId", async () => {
    await delay(MS);
    return ok({ ok: true });
  }),

  http.patch("/api/organizer/sessions/:sessionId/groups/:groupId/curator", async () => {
    await delay(MS);
    return ok({ ok: true });
  }),

  http.post("/api/organizer/sessions/:sessionId/groups/:groupId/participants", async () => {
    await delay(MS);
    return ok({ ok: true });
  }),

  // Program mutations
  http.post("/api/organizer/sessions/:sessionId/programs", async () => {
    await delay(MS);
    return ok({ id: `program-${Math.random().toString(36).slice(2, 10)}` });
  }),

  http.patch("/api/organizer/sessions/:sessionId/programs/:programId", async () => {
    await delay(MS);
    return ok({ ok: true });
  }),

  http.post("/api/organizer/sessions/:sessionId/programs/:programId/publish", async () => {
    await delay(MS);
    return ok({ ok: true });
  }),

  http.post("/api/organizer/sessions/:sessionId/programs/:programId/draft", async () => {
    await delay(MS);
    return ok({ ok: true });
  }),

  http.post("/api/organizer/sessions/:sessionId/programs/:programId/select", async () => {
    await delay(MS);
    return ok({ ok: true });
  }),

  // Program day mutations
  http.post("/api/organizer/sessions/:sessionId/programs/:programId/days", async () => {
    await delay(MS);
    return ok({ id: `day-${Math.random().toString(36).slice(2, 10)}` });
  }),

  http.patch("/api/organizer/sessions/:sessionId/programs/:programId/days/:dayId", async () => {
    await delay(MS);
    return ok({ ok: true });
  }),

  http.delete("/api/organizer/sessions/:sessionId/programs/:programId/days/:dayId", async () => {
    await delay(MS);
    return ok({ ok: true });
  }),

  http.patch(
    "/api/organizer/sessions/:sessionId/programs/:programId/days/:dayId/flow-order",
    async () => {
      await delay(MS);
      return ok({ ok: true });
    },
  ),

  http.patch(
    "/api/organizer/sessions/:sessionId/programs/:programId/days/:dayId/flows",
    async () => {
      await delay(MS);
      return ok({ ok: true });
    },
  ),

  // Event mutations
  http.patch(
    "/api/organizer/sessions/:sessionId/programs/:programId/days/:dayId/events/:eventId",
    async () => {
      await delay(MS);
      return ok({ ok: true });
    },
  ),

  http.post(
    "/api/organizer/sessions/:sessionId/programs/:programId/days/:dayId/events/parallel",
    async () => {
      await delay(MS);
      return ok({ id: `event-${Math.random().toString(36).slice(2, 10)}` });
    },
  ),

  http.delete(
    "/api/organizer/sessions/:sessionId/programs/:programId/days/:dayId/events/:eventId",
    async () => {
      await delay(MS);
      return ok({ ok: true });
    },
  ),

  http.post(
    "/api/organizer/sessions/:sessionId/programs/:programId/days/:dayId/events/:eventId/activate",
    async () => {
      await delay(MS);
      return ok({ ok: true });
    },
  ),

  // Survey mutations
  http.post("/api/organizer/sessions/:sessionId/surveys", async () => {
    await delay(MS);
    return ok({ id: `survey-${Math.random().toString(36).slice(2, 10)}` });
  }),

  http.patch("/api/organizer/sessions/:sessionId/surveys/:surveyId", async () => {
    await delay(MS);
    return ok({ ok: true });
  }),

  http.post("/api/organizer/sessions/:sessionId/surveys/:surveyId/questions", async () => {
    await delay(MS);
    return ok({ id: `question-${Math.random().toString(36).slice(2, 10)}` });
  }),

  http.patch(
    "/api/organizer/sessions/:sessionId/surveys/:surveyId/questions/:questionId",
    async () => {
      await delay(MS);
      return ok({ ok: true });
    },
  ),

  http.post("/api/organizer/sessions/:sessionId/surveys/:surveyId/publish", async () => {
    await delay(MS);
    return ok({ ok: true });
  }),
];

// ─── Admin ────────────────────────────────────────────────────────────────────

const adminHandlers = [
  http.get("/api/admin/dashboard", async ({ request }) => {
    await delay(MS);
    const viewerId = request.headers.get("x-viewer-id");
    const db = readDatabase();

    try {
      ensureAccess(db, viewerId, "security.read");
      return ok(cloneJson(db.adminDashboard));
    } catch (error) {
      return fail(error);
    }
  }),

  http.get("/api/admin/workspace", async ({ request }) => {
    await delay(MS);
    const viewerId = request.headers.get("x-viewer-id");
    const db = readDatabase();

    try {
      ensureAccess(db, viewerId, "security.read");
      return ok({
        ...cloneJson(db.adminDashboard),
        users: db.users.map(toPublicUser),
        sessions: cloneJson(db.sessions),
        groups: cloneJson(db.groups),
      });
    } catch (error) {
      return fail(error);
    }
  }),

  http.post("/api/admin/users", async ({ request }) => {
    await delay(MS);
    const viewerId = request.headers.get("x-viewer-id");
    const payload = await request.json();
    const db = readDatabase();

    try {
      ensureAccess(db, viewerId, "security.manage");
      const newUser = {
        id: `user-${Math.random().toString(36).slice(2, 10)}`,
        role: "participant",
        roleLabel: "Участник",
        ...payload,
      };
      db.users.push(newUser);
      writeDatabase(db);
      return ok(toPublicUser(newUser));
    } catch (error) {
      return fail(error);
    }
  }),

  http.patch("/api/admin/users/:userId", async ({ request, params }) => {
    await delay(MS);
    const viewerId = request.headers.get("x-viewer-id");
    const payload = await request.json();
    const db = readDatabase();

    try {
      ensureAccess(db, viewerId, "security.manage");
      const idx = db.users.findIndex((u) => u.id === params.userId);
      if (idx === -1)
        return HttpResponse.json({ message: "Пользователь не найден" }, { status: 404 });
      db.users[idx] = { ...db.users[idx], ...payload };
      writeDatabase(db);
      return ok(toPublicUser(db.users[idx]));
    } catch (error) {
      return fail(error);
    }
  }),

  http.patch("/api/admin/users/:userId/status", async ({ request, params }) => {
    await delay(MS);
    const viewerId = request.headers.get("x-viewer-id");
    const { status } = await request.json();
    const db = readDatabase();

    try {
      ensureAccess(db, viewerId, "security.manage");
      const idx = db.users.findIndex((u) => u.id === params.userId);
      if (idx === -1)
        return HttpResponse.json({ message: "Пользователь не найден" }, { status: 404 });
      db.users[idx] = { ...db.users[idx], status };
      writeDatabase(db);
      return ok(toPublicUser(db.users[idx]));
    } catch (error) {
      return fail(error);
    }
  }),

  http.post("/api/admin/users/:userId/assignments", async () => {
    await delay(MS);
    return ok({ ok: true });
  }),

  http.patch("/api/admin/users/:userId/assignments/:sessionId", async () => {
    await delay(MS);
    return ok({ ok: true });
  }),

  http.post("/api/admin/sessions", async ({ request }) => {
    await delay(MS);
    const viewerId = request.headers.get("x-viewer-id");
    const payload = await request.json();
    const db = readDatabase();

    try {
      ensureAccess(db, viewerId, "security.manage");
      const session = {
        id: `session-${Math.random().toString(36).slice(2, 10)}`,
        name: payload.name || "Новое событие",
        cycle: payload.cycle || "",
        dateLabel: payload.dateLabel || "",
        location: payload.location || "",
      };
      db.sessions.push(session);
      writeDatabase(db);
      return ok(session);
    } catch (error) {
      return fail(error);
    }
  }),

  http.patch("/api/admin/sessions/:sessionId", async () => {
    await delay(MS);
    return ok({ ok: true });
  }),

  http.patch("/api/admin/sessions/:sessionId/registration", async () => {
    await delay(MS);
    return ok({ ok: true });
  }),
];

// ─── Истоки · публичная карта голосов регионов ───────────────────────────────

import istokiSeed from "../../server/seed/data/istoki-regions-seed.json";

const ISTOKI_ISO_BY_CODE = {
  sevastopol: "RU-SEV",
  pskov: "RU-PSK",
  moscow: "RU-MOW",
  spb: "RU-SPE",
  ekaterinburg: "RU-SVE",
  vladivostok: "RU-PRI",
};

const istokiHandlers = [
  http.get("/api/public/istoki/regions", async () => {
    await delay(MS);
    const regions = istokiSeed.map((region, index) => ({
      code: region.code,
      isoCode: ISTOKI_ISO_BY_CODE[region.code] ?? null,
      name: region.name,
      geographicHint: region.geographicHint ?? null,
      orderIdx: index,
      isPublished: true,
      hasContent:
        Boolean(region.podcasts?.length) ||
        Boolean(region.stories?.length) ||
        Boolean(region.chronicle?.length),
      counts: {
        podcasts: region.podcasts?.length ?? 0,
        stories: region.stories?.length ?? 0,
        chronicle: region.chronicle?.length ?? 0,
      },
    }));
    return ok({ regions });
  }),

  http.get("/api/public/istoki/regions/:code", async ({ params }) => {
    await delay(MS);
    const region = istokiSeed.find((r) => r.code === params.code);
    if (!region) {
      return HttpResponse.json({ message: "Регион не найден" }, { status: 404 });
    }
    return ok({
      code: region.code,
      isoCode: ISTOKI_ISO_BY_CODE[region.code] ?? null,
      name: region.name,
      geographicHint: region.geographicHint ?? null,
      orderIdx: 0,
      isPublished: true,
      podcasts: region.podcasts ?? [],
      stories: region.stories ?? [],
      chronicle: region.chronicle ?? [],
    });
  }),
];

// ─── Export ───────────────────────────────────────────────────────────────────

export const handlers = [
  ...authHandlers,
  ...userHandlers,
  ...bootstrapHandlers,
  ...participantHandlers,
  ...curatorHandlers,
  ...organizerHandlers,
  ...adminHandlers,
  ...istokiHandlers,
];
