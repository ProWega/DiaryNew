"use strict";

const { buildNarrativeBrief } = require("./narrativeBriefService.cjs");

const member = (overrides) => ({
  id: "u-1",
  fullName: "Иван И.",
  journeyStage: "support",
  isCarefulMode: false,
  ...overrides,
});

const entry = (overrides) => ({
  id: `e-${Math.random().toString(36).slice(2, 6)}`,
  userId: "u-1",
  eventId: "ev-1",
  stateId: "balance",
  stateLevel: 3,
  comment: "",
  isAnonymous: false,
  isHiddenFromCurator: false,
  ...overrides,
});

describe("buildNarrativeBrief — picture", () => {
  it("counts participants and dominant methodology label", () => {
    const result = buildNarrativeBrief({
      members: [member({ id: "u-1" }), member({ id: "u-2" }), member({ id: "u-3" })],
      todayEntries: [
        entry({ userId: "u-1", stateId: "balance" }), // harmony
        entry({ userId: "u-2", stateId: "engaged" }), // lift
        entry({ userId: "u-3", stateId: "balance" }), // harmony
      ],
    });

    expect(result.picture.totalParticipants).toBe(3);
    expect(result.picture.respondedToday).toBe(3);
    expect(result.picture.dominantState).toBe("harmony");
    expect(result.picture.dominantStateLabel).toBe("Лад");
  });

  it("counts careful_mode participants", () => {
    const result = buildNarrativeBrief({
      members: [
        member({ id: "u-1", isCarefulMode: true }),
        member({ id: "u-2", isCarefulMode: false }),
        member({ id: "u-3", isCarefulMode: true }),
      ],
    });

    expect(result.picture.carefulCount).toBe(2);
  });

  it("respondedToday counts unique users with privacy-filtered entries", () => {
    const result = buildNarrativeBrief({
      members: [member({ id: "u-1" }), member({ id: "u-2" })],
      todayEntries: [
        entry({ userId: "u-1" }),
        entry({ userId: "u-1" }), // duplicate, same user → counted once
        entry({ userId: null }), // anonymous, not counted
      ],
    });

    expect(result.picture.respondedToday).toBe(1);
  });
});

describe("buildNarrativeBrief — stageResonance", () => {
  it("counts members across 4 journey stages plus careful overlay", () => {
    const result = buildNarrativeBrief({
      members: [
        member({ id: "u-1", journeyStage: "search" }),
        member({ id: "u-2", journeyStage: "search", isCarefulMode: true }),
        member({ id: "u-3", journeyStage: "verification" }),
        member({ id: "u-4", journeyStage: "support" }),
        member({ id: "u-5", journeyStage: "transmission", isCarefulMode: true }),
      ],
    });

    expect(result.stageResonance).toEqual({
      search: 2,
      verification: 1,
      support: 1,
      transmission: 1,
      careful: 2,
    });
  });

  it("ignores unknown stages without crashing", () => {
    const result = buildNarrativeBrief({
      members: [
        member({ id: "u-1", journeyStage: null }),
        member({ id: "u-2", journeyStage: "??" }),
      ],
    });
    expect(result.stageResonance.search).toBe(0);
  });
});

describe("buildNarrativeBrief — conversationPoints", () => {
  it("flags careful_mode participants as the highest priority", () => {
    const result = buildNarrativeBrief({
      members: [member({ id: "u-1", isCarefulMode: true })],
    });

    expect(result.conversationPoints).toHaveLength(1);
    expect(result.conversationPoints[0]).toMatchObject({
      participantId: "u-1",
      reason: "careful_mode",
    });
  });

  it("flags shift_down (harmony/tuning/lift → breakdown)", () => {
    const result = buildNarrativeBrief({
      members: [member({ id: "u-1" })],
      todayEntries: [entry({ userId: "u-1", stateId: "panic" })], // breakdown
      yesterdayEntries: [entry({ userId: "u-1", stateId: "balance" })], // harmony
    });

    expect(result.conversationPoints).toHaveLength(1);
    expect(result.conversationPoints[0].reason).toBe("shift_down");
    expect(result.conversationPoints[0].note).toContain("Лад");
    expect(result.conversationPoints[0].note).toContain("Сбой");
  });

  it("flags silence_streak (silence both today and yesterday)", () => {
    const result = buildNarrativeBrief({
      members: [member({ id: "u-1" })],
      todayEntries: [entry({ userId: "u-1", stateId: "passive" })], // silence
      yesterdayEntries: [entry({ userId: "u-1", stateId: "apathy" })], // silence
    });

    expect(result.conversationPoints).toHaveLength(1);
    expect(result.conversationPoints[0].reason).toBe("silence_streak");
  });

  it("does not double-count the same user (careful beats shift_down)", () => {
    const result = buildNarrativeBrief({
      members: [member({ id: "u-1", isCarefulMode: true })],
      todayEntries: [entry({ userId: "u-1", stateId: "panic" })],
      yesterdayEntries: [entry({ userId: "u-1", stateId: "balance" })],
    });

    expect(result.conversationPoints).toHaveLength(1);
    expect(result.conversationPoints[0].reason).toBe("careful_mode");
  });

  it("never produces banned diagnostic words", () => {
    const result = buildNarrativeBrief({
      members: [
        member({ id: "u-1", isCarefulMode: true }),
        member({ id: "u-2" }),
        member({ id: "u-3" }),
      ],
      todayEntries: [
        entry({ userId: "u-2", stateId: "panic" }),
        entry({ userId: "u-3", stateId: "passive" }),
      ],
      yesterdayEntries: [
        entry({ userId: "u-2", stateId: "engaged" }),
        entry({ userId: "u-3", stateId: "passive" }),
      ],
    });

    const allText = JSON.stringify(result.conversationPoints).toLowerCase();
    for (const banned of ["риск", "уровень", "стадия", "диагноз", "метрика", "статус", "оценк"]) {
      expect(allText).not.toContain(banned);
    }
  });

  it("caps the conversation points to 5 (priority ordering preserved)", () => {
    const members = Array.from({ length: 10 }, (_, i) =>
      member({ id: `u-${i + 1}`, isCarefulMode: true }),
    );

    const result = buildNarrativeBrief({ members });
    expect(result.conversationPoints).toHaveLength(5);
    for (const point of result.conversationPoints) {
      expect(point.reason).toBe("careful_mode");
    }
  });

  it("uses fallback display name when fullName is null (anonymous member case)", () => {
    const result = buildNarrativeBrief({
      members: [member({ id: "u-1", fullName: null, isCarefulMode: true })],
    });
    expect(result.conversationPoints[0].displayName).toBe("Участник без имени");
  });
});

describe("buildNarrativeBrief — events", () => {
  it("aggregates response count and pulls non-anonymous quotes", () => {
    const result = buildNarrativeBrief({
      events: [{ id: "ev-1", title: "Утренний круг" }],
      todayEntries: [
        entry({ userId: "u-1", eventId: "ev-1", comment: "Тепло настроились" }),
        entry({ userId: "u-2", eventId: "ev-1", comment: "Хорошо вошли в день" }),
        entry({ userId: null, eventId: "ev-1", isAnonymous: true, comment: "Тайно" }),
      ],
    });

    expect(result.events).toHaveLength(1);
    expect(result.events[0].responseCount).toBe(3);
    expect(result.events[0].quotes).toEqual(["Тепло настроились", "Хорошо вошли в день"]);
  });

  it("drops empty comments from quotes", () => {
    const result = buildNarrativeBrief({
      events: [{ id: "ev-1", title: "Сбор" }],
      todayEntries: [
        entry({ userId: "u-1", eventId: "ev-1", comment: "" }),
        entry({ userId: "u-2", eventId: "ev-1", comment: "   " }),
        entry({ userId: "u-3", eventId: "ev-1", comment: "Реальный комментарий" }),
      ],
    });
    expect(result.events[0].quotes).toEqual(["Реальный комментарий"]);
  });
});

describe("buildNarrativeBrief — full shape", () => {
  it("returns all 4 sections + dayId + dayLabel", () => {
    const result = buildNarrativeBrief({
      dayId: "day-1",
      dayLabel: "День 1",
      members: [member({ id: "u-1" })],
      events: [{ id: "ev-1", title: "Сбор" }],
    });

    expect(result).toMatchObject({
      dayId: "day-1",
      dayLabel: "День 1",
      picture: expect.any(Object),
      conversationPoints: expect.any(Array),
      stageResonance: expect.any(Object),
      events: expect.any(Array),
    });
  });

  it("works with empty inputs (no crash)", () => {
    expect(() => buildNarrativeBrief({})).not.toThrow();
    const empty = buildNarrativeBrief({});
    expect(empty.picture.totalParticipants).toBe(0);
    expect(empty.conversationPoints).toEqual([]);
  });
});
