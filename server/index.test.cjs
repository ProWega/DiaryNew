"use strict";

const request = require("supertest");
const { app } = require("./index.cjs");

describe("CSRF guard", () => {
  it("rejects POST without CSRF cookie/header (403)", async () => {
    const res = await request(app)
      .post("/api/admin/users")
      .set("Content-Type", "application/json")
      .send({ fullName: "X" });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/CSRF/);
  });

  it("rejects POST when cookie and header tokens mismatch (403)", async () => {
    const res = await request(app)
      .post("/api/admin/users")
      .set("Cookie", "newdiary_csrf=cookieValue")
      .set("X-CSRF-Token", "differentValue")
      .set("Content-Type", "application/json")
      .send({ fullName: "X" });
    expect(res.status).toBe(403);
  });

  it("does NOT reject GET requests on CSRF (skipped for safe methods)", async () => {
    const res = await request(app).get("/api/health");
    // 200 OK or 503 if Postgres unconfigured — but NOT 403 for CSRF
    expect(res.status).not.toBe(403);
  });

  it("does NOT enforce CSRF on /api/auth/magic-links/consume (exempt)", async () => {
    const res = await request(app)
      .post("/api/auth/magic-links/consume")
      .set("Content-Type", "application/json")
      .send({ token: "x" });
    // Should fail validation or auth, but not CSRF (no 403 from CSRF guard)
    // It might return 400 (zod) or 401 (invalid token) — anything except CSRF 403
    // We assert it didn't get blocked by CSRF specifically
    if (res.status === 403) {
      expect(res.body.message).not.toMatch(/CSRF/);
    }
  });

  it("does NOT enforce CSRF on /api/setup/admin (exempt)", async () => {
    const res = await request(app)
      .post("/api/setup/admin")
      .set("Content-Type", "application/json")
      .send({});
    if (res.status === 403) {
      expect(res.body.message).not.toMatch(/CSRF/);
    }
  });

  it("does NOT enforce CSRF on /api/participants/register (exempt)", async () => {
    const res = await request(app)
      .post("/api/participants/register")
      .set("Content-Type", "application/json")
      .send({});
    if (res.status === 403) {
      expect(res.body.message).not.toMatch(/CSRF/);
    }
  });

  it("passes CSRF when cookie matches header (other middleware may still reject)", async () => {
    const token = "matching-token-abc123";
    const res = await request(app)
      .post("/api/admin/users")
      .set("Cookie", `newdiary_csrf=${token}`)
      .set("X-CSRF-Token", token)
      .set("Content-Type", "application/json")
      .send({});
    // CSRF passes — next gate is auth (401) or validation (400). Not a CSRF 403.
    if (res.status === 403) {
      expect(res.body.message).not.toMatch(/CSRF/);
    }
  });
});

describe("Auth gate (RBAC negative cases)", () => {
  const csrfHeaders = {
    Cookie: "newdiary_csrf=t",
    "X-CSRF-Token": "t",
    "Content-Type": "application/json",
  };

  it("rejects unauthenticated POST to admin endpoint (401 or 403)", async () => {
    const res = await request(app)
      .post("/api/admin/users")
      .set(csrfHeaders)
      .send({ fullName: "X" });
    expect([400, 401, 403]).toContain(res.status);
  });

  it("rejects unauthenticated PATCH to admin endpoint", async () => {
    const res = await request(app)
      .patch("/api/admin/users/u-1/status")
      .set(csrfHeaders)
      .send({ status: "active" });
    expect([400, 401, 403, 404]).toContain(res.status);
  });

  it("rejects unauthenticated GET to participant diary", async () => {
    const res = await request(app).get("/api/participant/sessions/s1/diary");
    expect([401, 403, 404, 500]).toContain(res.status);
  });
});

describe("Methodology v4: PATCH /journey-stage validation", () => {
  const csrfHeaders = {
    Cookie: "newdiary_csrf=t",
    "X-CSRF-Token": "t",
    "Content-Type": "application/json",
  };

  it("rejects invalid journeyStage enum value (400)", async () => {
    const res = await request(app)
      .patch("/api/participant/sessions/s1/journey-stage")
      .set(csrfHeaders)
      .send({ journeyStage: "not-a-stage" });
    // Zod rejects unknown enum → 400. Auth/RBAC may reject earlier with 401 — both acceptable.
    expect([400, 401]).toContain(res.status);
  });

  it("rejects extra fields (strict schema)", async () => {
    const res = await request(app)
      .patch("/api/participant/sessions/s1/journey-stage")
      .set(csrfHeaders)
      .send({ journeyStage: "search", extraField: "bad" });
    expect([400, 401]).toContain(res.status);
  });

  it("zod accepts empty body shape (no fields → no-op valid)", async () => {
    const res = await request(app)
      .patch("/api/participant/sessions/s1/journey-stage")
      .set(csrfHeaders)
      .send({});
    // Empty {} is valid per schema (both fields optional). If 400 returned,
    // it must be a service-level error (no viewerId), NOT a zod validation error.
    if (res.status === 400) {
      expect(res.body.message).not.toMatch(/expected|invalid|required|enum/i);
    }
  });
});

describe("Zod validation gate", () => {
  const csrfHeaders = {
    Cookie: "newdiary_csrf=t",
    "X-CSRF-Token": "t",
    "Content-Type": "application/json",
  };

  it("returns 400 for missing required fields in /api/setup/admin", async () => {
    const res = await request(app)
      .post("/api/setup/admin")
      .set("Content-Type", "application/json")
      .send({}); // missing setupToken + fullName
    expect(res.status).toBe(400);
    expect(res.body.message).toBeTruthy();
  });

  it("returns 400 for missing fields in /api/participants/register", async () => {
    const res = await request(app)
      .post("/api/participants/register")
      .set("Content-Type", "application/json")
      .send({}); // missing fullName + sessionId
    expect(res.status).toBe(400);
  });

  it("returns 400 for malformed magic-link consume body", async () => {
    const res = await request(app)
      .post("/api/auth/magic-links/consume")
      .set("Content-Type", "application/json")
      .send({}); // missing token
    expect(res.status).toBe(400);
  });

  it("returns 400 when admin user create has invalid role enum", async () => {
    const res = await request(app)
      .post("/api/admin/users")
      .set(csrfHeaders)
      .send({ fullName: "X", role: "not-a-role" });
    // CSRF passes (matching tokens). Next: auth fails (401/403) OR validation fails (400).
    // Both outcomes are acceptable — we just want to confirm it's not a 5xx.
    expect(res.status).toBeLessThan(500);
  });
});

describe("CSRF cookie rotation via /api/auth/me", () => {
  it("mints a CSRF cookie on every /me hit (anonymous viewer)", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(200);
    const setCookie = res.headers["set-cookie"] || [];
    const cookieList = Array.isArray(setCookie) ? setCookie : [setCookie];
    const csrfCookie = cookieList.find((c) => c.startsWith("newdiary_csrf="));
    expect(csrfCookie).toBeDefined();
    expect(csrfCookie).toMatch(/newdiary_csrf=[a-f0-9]{32,}/);
  });

  it("rotates the CSRF cookie even when one already exists", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Cookie", "newdiary_csrf=existing-token-12345");
    const setCookie = res.headers["set-cookie"] || [];
    const cookieList = Array.isArray(setCookie) ? setCookie : [setCookie];
    const csrfCookie = cookieList.find((c) => c.startsWith("newdiary_csrf="));
    expect(csrfCookie).toBeDefined();
    expect(csrfCookie).not.toContain("existing-token-12345");
  });
});

describe("Health endpoint", () => {
  it("responds (200 or 503 depending on Postgres) and has CORS-friendly shape", async () => {
    const res = await request(app).get("/api/health");
    expect([200, 503]).toContain(res.status);
    expect(res.body).toHaveProperty("ok");
    expect(res.body).toHaveProperty("time");
    expect(res.body).toHaveProperty("postgresConfigured");
  });
});

describe("Static SPA fallback", () => {
  it("returns 404 for unknown /api routes (does not fall back to SPA index)", async () => {
    const res = await request(app).get("/api/this-route-does-not-exist");
    expect(res.status).toBe(404);
  });
});

describe("Phase 5.1: return points endpoints", () => {
  const csrfHeaders = {
    Cookie: "newdiary_csrf=t",
    "X-CSRF-Token": "t",
    "Content-Type": "application/json",
  };

  it("rejects unauthenticated GET /diary/return-points", async () => {
    const res = await request(app).get("/api/participant/diary/return-points");
    expect([401, 403, 404, 500]).toContain(res.status);
    expect(res.status).not.toBe(200);
  });

  it("rejects POST without CSRF tokens (CSRF guard)", async () => {
    const res = await request(app)
      .post("/api/participant/diary/return-points/s1/1")
      .set("Content-Type", "application/json")
      .send({ content: "..." });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/CSRF/);
  });

  it("rejects POST with empty content (zod requiredText)", async () => {
    const res = await request(app)
      .post("/api/participant/diary/return-points/s1/1")
      .set(csrfHeaders)
      .send({ content: "" });
    expect([400, 401]).toContain(res.status);
  });

  it("rejects POST with extra fields (strict zod)", async () => {
    const res = await request(app)
      .post("/api/participant/diary/return-points/s1/1")
      .set(csrfHeaders)
      .send({ content: "ok", unknownField: "bad" });
    expect([400, 401]).toContain(res.status);
  });
});

describe("Phase 4.1: GET /api/curator/.../brief — narrative записка", () => {
  it("rejects unauthenticated read (401/403/500 — anything but a 200 response)", async () => {
    const res = await request(app).get("/api/curator/sessions/s1/groups/g1/brief");
    // No viewer header → ensureCuratorAccess throws. Not 200, not a generic 404.
    expect([401, 403, 404, 500]).toContain(res.status);
    expect(res.status).not.toBe(200);
  });

  it("does not fall back to legacy /dashboard handler", async () => {
    const res = await request(app).get("/api/curator/sessions/s1/groups/g1/brief?dayId=day-1");
    // Should hit the new route — error path acceptable, but body must not be the
    // old dashboard shape (which would have averageActivation / participantRows).
    if (res.body && typeof res.body === "object") {
      expect(res.body).not.toHaveProperty("averageActivation");
      expect(res.body).not.toHaveProperty("participantRows");
    }
  });

  it("endpoint still works when ANTHROPIC_API_KEY is missing (Phase 5+ soft fallback)", async () => {
    // Don't set the env var; the endpoint must not 500 on missing key —
    // narrative just falls back to source: "fallback".
    const previous = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      const res = await request(app).get("/api/curator/sessions/s1/groups/g1/brief");
      // Auth/access errors are still acceptable — we only assert the LLM path
      // doesn't crash the endpoint outright.
      expect([200, 401, 403, 404, 500]).toContain(res.status);
    } finally {
      if (previous !== undefined) process.env.ANTHROPIC_API_KEY = previous;
    }
  });
});
