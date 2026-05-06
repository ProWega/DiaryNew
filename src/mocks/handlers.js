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

  // Methodology v4: PATCH journey_stage + careful_mode (см. methodology-mapping.md §2.4)
  http.patch("/api/participant/sessions/:sessionId/journey-stage", async ({ request }) => {
    const viewerId = request.headers.get("x-viewer-id");
    const body = await request.json();
    const db = readDatabase();

    try {
      const viewer = getViewer(db, viewerId);
      const userIndex = db.users.findIndex((u) => u.id === viewer.id);
      if (userIndex < 0) {
        return HttpResponse.json({ message: "Пользователь не найден" }, { status: 404 });
      }

      const next = { ...db.users[userIndex] };
      if ("journeyStage" in body) next.journeyStage = body.journeyStage ?? null;
      if ("isCarefulMode" in body) next.isCarefulMode = Boolean(body.isCarefulMode);
      db.users[userIndex] = next;
      writeDatabase(db);

      return ok({
        journeyStage: next.journeyStage ?? null,
        isCarefulMode: next.isCarefulMode ?? false,
      });
    } catch (error) {
      return fail(error);
    }
  }),
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
import istokiRfSubjects from "../../server/seed/data/istoki-rf-subjects.json";

// Mirror of seedIstoki.cjs logic for MSW: build the same merged region list
// the real backend would return. Pass 1 — stub all 89 RF subjects; pass 2 —
// overlay the featured regions (with content) on top by code.
const istokiRegionsByCode = new Map();
istokiRfSubjects.forEach((subject, index) =>
  istokiRegionsByCode.set(subject.code, {
    code: subject.code,
    isoCode: subject.iso,
    name: subject.name,
    geographicHint: null,
    orderIdx: 1000 + index,
    isPublished: true,
    podcasts: [],
    stories: [],
    chronicle: [],
  }),
);
istokiSeed.forEach((region, index) => {
  const existing = istokiRegionsByCode.get(region.code);
  istokiRegionsByCode.set(region.code, {
    ...existing,
    code: region.code,
    isoCode: existing?.isoCode ?? null,
    name: region.name,
    geographicHint: region.geographicHint ?? null,
    orderIdx: index,
    isPublished: true,
    podcasts: region.podcasts ?? [],
    stories: region.stories ?? [],
    chronicle: region.chronicle ?? [],
  });
});

function regionSummary(region) {
  return {
    code: region.code,
    isoCode: region.isoCode,
    name: region.name,
    geographicHint: region.geographicHint,
    orderIdx: region.orderIdx,
    isPublished: region.isPublished,
    hasContent:
      Boolean(region.podcasts?.length) ||
      Boolean(region.stories?.length) ||
      Boolean(region.chronicle?.length),
    counts: {
      podcasts: region.podcasts?.length ?? 0,
      stories: region.stories?.length ?? 0,
      chronicle: region.chronicle?.length ?? 0,
    },
  };
}

const istokiHandlers = [
  http.get("/api/public/istoki/regions", async () => {
    await delay(MS);
    const regions = Array.from(istokiRegionsByCode.values())
      .map(regionSummary)
      .sort((a, b) => a.orderIdx - b.orderIdx || a.name.localeCompare(b.name, "ru"));
    return ok({ regions });
  }),

  http.get("/api/public/istoki/regions/:code", async ({ params }) => {
    await delay(MS);
    const region = istokiRegionsByCode.get(params.code);
    if (!region) {
      return HttpResponse.json({ message: "Регион не найден" }, { status: 404 });
    }
    return ok(region);
  }),

  // Admin endpoints — same in-memory store as public.
  http.get("/api/admin/istoki/regions", async () => {
    await delay(MS);
    const regions = Array.from(istokiRegionsByCode.values())
      .map(regionSummary)
      .sort((a, b) => a.orderIdx - b.orderIdx || a.name.localeCompare(b.name, "ru"));
    return ok({ regions });
  }),
  http.get("/api/admin/istoki/regions/:code", async ({ params }) => {
    await delay(MS);
    const region = istokiRegionsByCode.get(params.code);
    if (!region) {
      return HttpResponse.json({ message: "Регион не найден" }, { status: 404 });
    }
    return ok(region);
  }),
  http.post("/api/admin/istoki/regions", async ({ request }) => {
    await delay(MS);
    const body = await request.json();
    const existing = istokiRegionsByCode.get(body.code) || {
      podcasts: [],
      stories: [],
      chronicle: [],
    };
    istokiRegionsByCode.set(body.code, {
      ...existing,
      code: body.code,
      isoCode: body.isoCode ?? existing.isoCode ?? null,
      name: body.name,
      geographicHint: body.geographicHint ?? null,
      orderIdx: body.orderIdx ?? 0,
      isPublished: body.isPublished !== false,
    });
    return HttpResponse.json({ code: body.code }, { status: 201 });
  }),
  http.put("/api/admin/istoki/regions/:code", async ({ params, request }) => {
    await delay(MS);
    const body = await request.json();
    const existing = istokiRegionsByCode.get(params.code);
    if (!existing) {
      return HttpResponse.json({ message: "Регион не найден" }, { status: 404 });
    }
    istokiRegionsByCode.set(params.code, {
      ...existing,
      name: body.name,
      geographicHint: body.geographicHint ?? null,
      orderIdx: body.orderIdx ?? 0,
      isPublished: body.isPublished !== false,
      isoCode: body.isoCode ?? existing.isoCode,
    });
    return ok({ code: params.code });
  }),
  http.delete("/api/admin/istoki/regions/:code", async ({ params }) => {
    await delay(MS);
    istokiRegionsByCode.delete(params.code);
    return new HttpResponse(null, { status: 204 });
  }),

  // Generic helper for nested CRUD: build closures per kind
  ...["podcasts", "stories", "chronicle"].flatMap((kind) => {
    const idPrefix = { podcasts: "pod", stories: "sty", chronicle: "chr" }[kind];
    const childKey = { podcasts: "podcasts", stories: "stories", chronicle: "chronicle" }[kind];
    const urlSegment = kind === "chronicle" ? "chronicle" : kind;
    return [
      http.post(`/api/admin/istoki/regions/:code/${urlSegment}`, async ({ params, request }) => {
        await delay(MS);
        const body = await request.json();
        const region = istokiRegionsByCode.get(params.code);
        if (!region) return HttpResponse.json({ message: "Регион не найден" }, { status: 404 });
        const id = body.id || `${idPrefix}-${Math.random().toString(36).slice(2, 10)}`;
        const next = [...(region[childKey] || []), { ...body, id }];
        istokiRegionsByCode.set(params.code, { ...region, [childKey]: next });
        return HttpResponse.json({ id }, { status: 201 });
      }),
      http.put(`/api/admin/istoki/${urlSegment}/:id`, async ({ params, request }) => {
        await delay(MS);
        const body = await request.json();
        for (const [code, region] of istokiRegionsByCode.entries()) {
          const list = region[childKey] || [];
          const idx = list.findIndex((entry) => entry.id === params.id);
          if (idx >= 0) {
            const next = list.slice();
            next[idx] = { ...next[idx], ...body, id: params.id };
            istokiRegionsByCode.set(code, { ...region, [childKey]: next });
            return ok({ id: params.id });
          }
        }
        return HttpResponse.json({ message: "Не найдено" }, { status: 404 });
      }),
      http.delete(`/api/admin/istoki/${urlSegment}/:id`, async ({ params }) => {
        await delay(MS);
        for (const [code, region] of istokiRegionsByCode.entries()) {
          const list = region[childKey] || [];
          const next = list.filter((entry) => entry.id !== params.id);
          if (next.length !== list.length) {
            istokiRegionsByCode.set(code, { ...region, [childKey]: next });
            return new HttpResponse(null, { status: 204 });
          }
        }
        return HttpResponse.json({ message: "Не найдено" }, { status: 404 });
      }),
    ];
  }),

  // Uploads — return a fake URL (MSW can't actually persist files)
  http.post("/api/admin/istoki/uploads/audio", async () => {
    await delay(MS);
    return HttpResponse.json(
      { url: "/uploads/audio/mock.mp3", sizeBytes: 0, mime: "audio/mpeg" },
      { status: 201 },
    );
  }),
  http.post("/api/admin/istoki/uploads/photo", async () => {
    await delay(MS);
    return HttpResponse.json(
      { url: "/uploads/photos/mock.jpg", sizeBytes: 0, mime: "image/jpeg" },
      { status: 201 },
    );
  }),

  // Phase E — analytics ingestion + admin aggregates.
  // The mock store keeps a tiny in-memory event log so that, when the
  // dev/test environment uses MSW, the admin dashboard renders real
  // counts driven by the user's own clicks rather than empty zeros.
  ...(() => {
    const events = [];
    function inRange(event, days) {
      const since = Date.now() - days * 24 * 60 * 60 * 1000;
      return new Date(event.created_at).getTime() >= since;
    }
    return [
      http.post("/api/public/istoki/events", async ({ request }) => {
        await delay(MS);
        const body = await request.json();
        const ipHash = "mock-ip-hash";
        for (const ev of body.events ?? []) {
          events.push({
            ...ev,
            ipHash,
            created_at: new Date().toISOString(),
          });
        }
        return HttpResponse.json({ inserted: body.events?.length ?? 0 }, { status: 202 });
      }),

      http.get("/api/admin/istoki/analytics/kpi", async ({ request }) => {
        await delay(MS);
        const days = Number(new URL(request.url).searchParams.get("days") || 30);
        const recent = events.filter((e) => inRange(e, days));
        const opens = recent.filter((e) => e.type === "region.opened");
        return ok({
          days,
          regionOpens: opens.length,
          uniqueVisitors: new Set(opens.map((e) => e.ipHash)).size,
          listenedSecTotal: recent
            .filter((e) => e.type === "podcast.progress")
            .reduce((sum, e) => sum + Number(e.payload?.listenedSec || 0), 0),
          podcastPlays: recent.filter((e) => e.type === "podcast.played").length,
          storyViews: recent.filter((e) => e.type === "story.viewed").length,
        });
      }),

      http.get("/api/admin/istoki/analytics/top-regions", async ({ request }) => {
        await delay(MS);
        const url = new URL(request.url);
        const days = Number(url.searchParams.get("days") || 30);
        const limit = Number(url.searchParams.get("limit") || 5);
        const counts = new Map();
        for (const e of events.filter((x) => x.type === "region.opened" && inRange(x, days))) {
          if (!e.regionCode) continue;
          const row = counts.get(e.regionCode) || {
            regionCode: e.regionCode,
            name: istokiRegionsByCode.get(e.regionCode)?.name || e.regionCode,
            opens: 0,
            ips: new Set(),
          };
          row.opens += 1;
          row.ips.add(e.ipHash);
          counts.set(e.regionCode, row);
        }
        const items = Array.from(counts.values())
          .map(({ ips, ...rest }) => ({ ...rest, uniqueVisitors: ips.size }))
          .sort((a, b) => b.opens - a.opens)
          .slice(0, limit);
        return ok({ items });
      }),

      http.get("/api/admin/istoki/analytics/top-podcasts", async ({ request }) => {
        await delay(MS);
        const limit = Number(new URL(request.url).searchParams.get("limit") || 5);
        const items = [];
        for (const region of istokiRegionsByCode.values()) {
          for (const p of region.podcasts ?? []) {
            const completions = events.filter(
              (e) =>
                e.type === "podcast.progress" &&
                e.entityId === p.id &&
                Number(e.payload?.listenedSec || 0) >= 0.8 * (p.durationSec || 60),
            ).length;
            items.push({
              id: p.id,
              regionCode: region.code,
              title: p.title,
              completions,
            });
          }
        }
        return ok({
          items: items.sort((a, b) => b.completions - a.completions).slice(0, limit),
        });
      }),

      http.get("/api/admin/istoki/analytics/top-stories", async ({ request }) => {
        await delay(MS);
        const url = new URL(request.url);
        const days = Number(url.searchParams.get("days") || 30);
        const limit = Number(url.searchParams.get("limit") || 5);
        const counts = new Map();
        for (const e of events.filter((x) => x.type === "story.viewed" && inRange(x, days))) {
          if (!e.entityId) continue;
          counts.set(e.entityId, (counts.get(e.entityId) || 0) + 1);
        }
        const items = [];
        for (const region of istokiRegionsByCode.values()) {
          for (const s of region.stories ?? []) {
            if (!counts.has(s.id)) continue;
            items.push({
              id: s.id,
              regionCode: region.code,
              participantName: s.participantName,
              views: counts.get(s.id),
            });
          }
        }
        return ok({ items: items.sort((a, b) => b.views - a.views).slice(0, limit) });
      }),

      http.get("/api/admin/istoki/analytics/timeseries", async ({ request }) => {
        await delay(MS);
        const url = new URL(request.url);
        const days = Number(url.searchParams.get("days") || 30);
        const eventType = url.searchParams.get("eventType");
        const buckets = new Map();
        for (const e of events.filter((x) => inRange(x, days))) {
          if (eventType && e.type !== eventType) continue;
          const day = e.created_at.slice(0, 10);
          buckets.set(day, (buckets.get(day) || 0) + 1);
        }
        const points = Array.from(buckets.entries())
          .map(([day, count]) => ({ day, count }))
          .sort((a, b) => a.day.localeCompare(b.day));
        return ok({ points });
      }),
    ];
  })(),
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
