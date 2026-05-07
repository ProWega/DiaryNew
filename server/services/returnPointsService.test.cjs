"use strict";

const {
  TOUCHPOINT_WEEKS,
  TOUCHPOINT_INVITATIONS,
  scheduledDateFor,
  computeStatus,
  buildReturnPointsForSession,
} = require("./returnPointsService.cjs");

describe("TOUCHPOINT_WEEKS", () => {
  it("matches the methodology spec (1, 4, 12, 26, 52)", () => {
    expect(TOUCHPOINT_WEEKS).toEqual([1, 4, 12, 26, 52]);
  });

  it("has an invitation copy for every touchpoint index 1..5", () => {
    for (let i = 1; i <= 5; i++) {
      expect(TOUCHPOINT_INVITATIONS[i]).toBeTruthy();
      expect(TOUCHPOINT_INVITATIONS[i].length).toBeGreaterThan(20);
    }
  });

  it("invitations don't contain banned diagnostic vocabulary", () => {
    const all = Object.values(TOUCHPOINT_INVITATIONS).join(" ").toLowerCase();
    for (const banned of ["риск", "уровень", "стадия", "диагноз", "статус", "прогресс"]) {
      expect(all).not.toContain(banned);
    }
  });
});

describe("scheduledDateFor", () => {
  const sessionEnd = new Date("2026-01-01T00:00:00Z");

  it("adds the right number of weeks for each touchpoint", () => {
    expect(scheduledDateFor(sessionEnd, 1).toISOString()).toBe("2026-01-08T00:00:00.000Z");
    expect(scheduledDateFor(sessionEnd, 2).toISOString()).toBe("2026-01-29T00:00:00.000Z");
    expect(scheduledDateFor(sessionEnd, 3).toISOString()).toBe("2026-03-26T00:00:00.000Z");
    expect(scheduledDateFor(sessionEnd, 4).toISOString()).toBe("2026-07-02T00:00:00.000Z");
    expect(scheduledDateFor(sessionEnd, 5).toISOString()).toBe("2026-12-31T00:00:00.000Z");
  });

  it("returns null when session end_date is missing", () => {
    expect(scheduledDateFor(null, 1)).toBeNull();
    expect(scheduledDateFor(undefined, 1)).toBeNull();
  });

  it("returns null for invalid touchpoint index", () => {
    expect(scheduledDateFor(sessionEnd, 0)).toBeNull();
    expect(scheduledDateFor(sessionEnd, 6)).toBeNull();
  });

  it("accepts ISO string as input", () => {
    expect(scheduledDateFor("2026-01-01", 1).toISOString()).toBe("2026-01-08T00:00:00.000Z");
  });
});

describe("computeStatus", () => {
  const past = new Date("2026-01-01");
  const future = new Date("2027-01-01");
  const now = new Date("2026-06-01");

  it("returns 'responded' whenever a response exists, regardless of date", () => {
    expect(computeStatus({ scheduledFor: past, now, hasResponse: true })).toBe("responded");
    expect(computeStatus({ scheduledFor: future, now, hasResponse: true })).toBe("responded");
  });

  it("returns 'available' when scheduled date has passed and no response", () => {
    expect(computeStatus({ scheduledFor: past, now, hasResponse: false })).toBe("available");
  });

  it("returns 'future' when scheduled date is in the future", () => {
    expect(computeStatus({ scheduledFor: future, now, hasResponse: false })).toBe("future");
  });

  it("returns 'future' when scheduledFor is null", () => {
    expect(computeStatus({ scheduledFor: null, now, hasResponse: false })).toBe("future");
  });
});

describe("buildReturnPointsForSession", () => {
  const session = { id: "s-1", name: "Школа: январь 2026", end_date: "2026-01-01" };
  const now = new Date("2026-06-01"); // 5 months after = ~22 weeks → indexes 1-3 available, 4-5 future

  it("returns 5 points per session in canonical order", () => {
    const points = buildReturnPointsForSession({ session, responses: [], now });
    expect(points).toHaveLength(5);
    expect(points.map((p) => p.touchpointIndex)).toEqual([1, 2, 3, 4, 5]);
    expect(points.map((p) => p.weeksAfter)).toEqual([1, 4, 12, 26, 52]);
  });

  it("each point has scheduledFor, invitation, status, and sessionLabel", () => {
    const [first] = buildReturnPointsForSession({ session, responses: [], now });
    expect(first.sessionId).toBe("s-1");
    expect(first.sessionLabel).toBe("Школа: январь 2026");
    expect(first.scheduledFor).toBeTruthy();
    expect(first.invitation).toBeTruthy();
  });

  it("classifies past touchpoints as 'available' and far-future as 'future'", () => {
    const points = buildReturnPointsForSession({ session, responses: [], now });
    expect(points[0].status).toBe("available"); // 1 week
    expect(points[1].status).toBe("available"); // 4 weeks
    expect(points[2].status).toBe("available"); // 12 weeks
    expect(points[3].status).toBe("future"); // 26 weeks (June 2026 hasn't reached July 2026)
    expect(points[4].status).toBe("future"); // 52 weeks
  });

  it("attaches response data when one exists for the touchpoint", () => {
    const responses = [
      {
        id: "r-1",
        touchpoint_index: 2,
        content: "Месяц спустя — тепло вспоминается",
        is_anonymous: false,
        is_hidden_from_curator: false,
        updated_at: "2026-02-01T12:00:00Z",
      },
    ];
    const points = buildReturnPointsForSession({ session, responses, now });
    expect(points[1].status).toBe("responded");
    expect(points[1].response).toMatchObject({
      id: "r-1",
      content: "Месяц спустя — тепло вспоминается",
      isAnonymous: false,
      isHiddenFromCurator: false,
    });
  });

  it("falls back to session id when name is empty", () => {
    const [first] = buildReturnPointsForSession({
      session: { id: "s-2", name: null, end_date: "2026-01-01" },
      responses: [],
      now,
    });
    expect(first.sessionLabel).toBe("s-2");
  });
});
