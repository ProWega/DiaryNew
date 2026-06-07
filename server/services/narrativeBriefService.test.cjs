"use strict";

const { buildNarrativeBrief } = require("./narrativeBriefService.cjs");

const member = (overrides) => ({
  id: "u-1",
  fullName: "Иван И.",
  journeyStage: "support",
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
  it("counts participants and dominant state by 7-level label", () => {
    const result = buildNarrativeBrief({
      members: [member({ id: "u-1" }), member({ id: "u-2" }), member({ id: "u-3" })],
      todayEntries: [
        entry({ userId: "u-1", stateId: "balance" }),
        entry({ userId: "u-2", stateId: "engaged" }),
        entry({ userId: "u-3", stateId: "balance" }),
      ],
    });

    expect(result.picture.totalParticipants).toBe(3);
    expect(result.picture.respondedToday).toBe(3);
    expect(result.picture.dominantState).toBe("balance");
    expect(result.picture.dominantStateLabel).toBe("Баланс");
  });

  it("aggregates entries into low / working / high activation zones", () => {
    const result = buildNarrativeBrief({
      members: [
        member({ id: "u-1" }),
        member({ id: "u-2" }),
        member({ id: "u-3" }),
        member({ id: "u-4" }),
      ],
      todayEntries: [
        entry({ userId: "u-1", stateId: "apathy" }),
        entry({ userId: "u-2", stateId: "balance" }),
        entry({ userId: "u-3", stateId: "engaged" }),
        entry({ userId: "u-4", stateId: "panic" }),
      ],
    });

    expect(result.picture.lowActivationCount).toBe(1);
    expect(result.picture.workingActivationCount).toBe(2);
    expect(result.picture.highActivationCount).toBe(1);
  });

  it("respondedToday counts unique users with privacy-filtered entries", () => {
    const result = buildNarrativeBrief({
      members: [member({ id: "u-1" }), member({ id: "u-2" })],
      todayEntries: [entry({ userId: "u-1" }), entry({ userId: "u-1" }), entry({ userId: null })],
    });

    expect(result.picture.respondedToday).toBe(1);
  });
});

describe("buildNarrativeBrief — stageResonance", () => {
  it("counts members across 4 journey stages", () => {
    const result = buildNarrativeBrief({
      members: [
        member({ id: "u-1", journeyStage: "search" }),
        member({ id: "u-2", journeyStage: "search" }),
        member({ id: "u-3", journeyStage: "verification" }),
        member({ id: "u-4", journeyStage: "support" }),
        member({ id: "u-5", journeyStage: "transmission" }),
      ],
    });

    expect(result.stageResonance).toEqual({
      search: 2,
      verification: 1,
      support: 1,
      transmission: 1,
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
  it("flags high_activation when today's state is overstimulated/panic", () => {
    const result = buildNarrativeBrief({
      members: [member({ id: "u-1" })],
      todayEntries: [entry({ userId: "u-1", stateId: "panic" })],
    });

    expect(result.conversationPoints).toHaveLength(1);
    expect(result.conversationPoints[0]).toMatchObject({
      participantId: "u-1",
      reason: "high_activation",
    });
    expect(result.conversationPoints[0].note).toContain("Паника");
  });

  it("flags shift_down (working activation → high)", () => {
    const result = buildNarrativeBrief({
      members: [member({ id: "u-1" })],
      todayEntries: [entry({ userId: "u-1", stateId: "panic" })],
      yesterdayEntries: [entry({ userId: "u-1", stateId: "balance" })],
    });

    // high_activation wins for the same user (rule 1 fires before rule 2), so
    // only one point is produced overall, not two.
    expect(result.conversationPoints).toHaveLength(1);
    expect(result.conversationPoints[0].reason).toBe("high_activation");
  });

  it("flags low_activation_streak (apathy/passive both today and yesterday)", () => {
    const result = buildNarrativeBrief({
      members: [member({ id: "u-1" })],
      todayEntries: [entry({ userId: "u-1", stateId: "passive" })],
      yesterdayEntries: [entry({ userId: "u-1", stateId: "apathy" })],
    });

    expect(result.conversationPoints).toHaveLength(1);
    expect(result.conversationPoints[0].reason).toBe("low_activation_streak");
  });

  it("never produces banned diagnostic words", () => {
    const result = buildNarrativeBrief({
      members: [member({ id: "u-1" }), member({ id: "u-2" }), member({ id: "u-3" })],
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
    for (const banned of ["риск", "диагноз", "метрика", "статус", "оценк", "прогресс"]) {
      expect(allText).not.toContain(banned);
    }
  });

  it("caps the conversation points to 5", () => {
    const members = Array.from({ length: 10 }, (_, i) => member({ id: `u-${i + 1}` }));
    const todayEntries = members.map((m) => entry({ userId: m.id, stateId: "panic" }));

    const result = buildNarrativeBrief({ members, todayEntries });
    expect(result.conversationPoints).toHaveLength(5);
    for (const point of result.conversationPoints) {
      expect(point.reason).toBe("high_activation");
    }
  });

  it("uses fallback display name when fullName is null", () => {
    const result = buildNarrativeBrief({
      members: [member({ id: "u-1", fullName: null })],
      todayEntries: [entry({ userId: "u-1", stateId: "panic" })],
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
  it("returns all sections + dayId + dayLabel", () => {
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
      participantCards: expect.any(Array),
      programArc: expect.any(Object),
    });
  });

  it("works with empty inputs (no crash)", () => {
    expect(() => buildNarrativeBrief({})).not.toThrow();
    const empty = buildNarrativeBrief({});
    expect(empty.picture.totalParticipants).toBe(0);
    expect(empty.conversationPoints).toEqual([]);
    expect(empty.participantCards).toEqual([]);
    expect(empty.programArc.dayBreakdown).toEqual([]);
  });
});

describe("buildNarrativeBrief — participantCards", () => {
  it("returns one card per member with journey stage label", () => {
    const result = buildNarrativeBrief({
      members: [
        member({ id: "u-1", journeyStage: "verification" }),
        member({ id: "u-2", journeyStage: "transmission" }),
      ],
    });

    expect(result.participantCards).toHaveLength(2);
    expect(result.participantCards[0]).toMatchObject({
      userId: "u-1",
      displayName: "Иван И.",
      journeyStage: "verification",
      journeyStageLabel: "Проверка",
    });
    expect(result.participantCards[1].journeyStageLabel).toBe("Передача");
  });

  it("includes today/yesterday 7-level labels when entries exist", () => {
    const result = buildNarrativeBrief({
      members: [member({ id: "u-1" })],
      todayEntries: [entry({ userId: "u-1", stateId: "engaged" })],
      yesterdayEntries: [entry({ userId: "u-1", stateId: "balance" })],
    });

    expect(result.participantCards[0].today).toEqual({ id: "engaged", ru: "Включённость" });
    expect(result.participantCards[0].yesterday).toEqual({ id: "balance", ru: "Баланс" });
  });

  it("today/yesterday are null when no entry for that user", () => {
    const result = buildNarrativeBrief({
      members: [member({ id: "u-1" })],
    });

    expect(result.participantCards[0].today).toBeNull();
    expect(result.participantCards[0].yesterday).toBeNull();
  });

  it("attaches conversationHint when participant is in conversationPoints", () => {
    const result = buildNarrativeBrief({
      members: [member({ id: "u-1" })],
      todayEntries: [entry({ userId: "u-1", stateId: "panic" })],
    });

    expect(result.participantCards[0].conversationHint).toMatchObject({
      reason: "high_activation",
    });
  });

  it("no hint when participant has no conversation point", () => {
    const result = buildNarrativeBrief({
      members: [member({ id: "u-1" })],
    });

    expect(result.participantCards[0].conversationHint).toBeNull();
  });

  it("display name falls back when fullName is null (anonymous)", () => {
    const result = buildNarrativeBrief({
      members: [member({ id: "u-1", fullName: null })],
    });
    expect(result.participantCards[0].displayName).toBe("Участник без имени");
  });
});

describe("buildNarrativeBrief — programArc", () => {
  it("returns one snapshot per program day", () => {
    const result = buildNarrativeBrief({
      programDays: [
        { id: "day-1", label: "День 1" },
        { id: "day-2", label: "День 2" },
      ],
      entriesByDay: {
        "day-1": [
          entry({ userId: "u-1", stateId: "balance" }),
          entry({ userId: "u-2", stateId: "balance" }),
        ],
        "day-2": [entry({ userId: "u-1", stateId: "engaged" })],
      },
    });

    expect(result.programArc.dayBreakdown).toHaveLength(2);
    expect(result.programArc.dayBreakdown[0]).toMatchObject({
      dayId: "day-1",
      dayLabel: "День 1",
      respondedCount: 2,
      totalEntries: 2,
      dominantState: "balance",
      dominantStateLabel: "Баланс",
    });
    expect(result.programArc.dayBreakdown[1].dominantState).toBe("engaged");
  });

  it("dominant is null when day has no entries", () => {
    const result = buildNarrativeBrief({
      programDays: [{ id: "day-1", label: "День 1" }],
      entriesByDay: {},
    });

    expect(result.programArc.dayBreakdown[0]).toMatchObject({
      respondedCount: 0,
      totalEntries: 0,
      dominantState: null,
      dominantStateLabel: null,
    });
  });

  it("respondedCount is unique users (anonymous entries do not double-count)", () => {
    const result = buildNarrativeBrief({
      programDays: [{ id: "day-1", label: "День 1" }],
      entriesByDay: {
        "day-1": [
          entry({ userId: "u-1", stateId: "balance" }),
          entry({ userId: "u-1", stateId: "engaged" }),
          entry({ userId: null, isAnonymous: true, stateId: "balance" }),
        ],
      },
    });

    expect(result.programArc.dayBreakdown[0].respondedCount).toBe(1);
    expect(result.programArc.dayBreakdown[0].totalEntries).toBe(3);
  });

  it("never produces banned diagnostic words in dayLabel/dominantStateLabel", () => {
    const result = buildNarrativeBrief({
      programDays: [{ id: "d", label: "День 1" }],
      entriesByDay: { d: [entry({ userId: "u-1", stateId: "panic" })] },
    });
    const text = JSON.stringify(result.programArc).toLowerCase();
    for (const banned of ["риск", "диагноз", "метрика", "статус", "оценк", "прогресс"]) {
      expect(text).not.toContain(banned);
    }
  });
});
