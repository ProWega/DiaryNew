"use strict";

const {
  ALL_INCLUDED,
  normalizeFilter,
  describeFilter,
  isAllIncluded,
} = require("./chatContextFilter.cjs");

describe("chatContextFilter.normalizeFilter", () => {
  it("returns ALL_INCLUDED defaults for empty object", () => {
    expect(normalizeFilter({})).toEqual(ALL_INCLUDED);
  });

  it("returns ALL_INCLUDED for null/undefined", () => {
    expect(normalizeFilter(null)).toEqual(ALL_INCLUDED);
    expect(normalizeFilter(undefined)).toEqual(ALL_INCLUDED);
  });

  it("normalises boolean flags from undefined to true (default include)", () => {
    const result = normalizeFilter({ memberIds: ["u-1"] });
    expect(result.includeMembers).toBe(true);
    expect(result.memberIds).toEqual(["u-1"]);
  });

  it("coerces non-boolean flags via Boolean()", () => {
    expect(normalizeFilter({ includeMembers: 0 }).includeMembers).toBe(false);
    expect(normalizeFilter({ includeMembers: 1 }).includeMembers).toBe(true);
    expect(normalizeFilter({ includeDays: false }).includeDays).toBe(false);
  });

  it("filters non-string entries and de-duplicates arrays", () => {
    const result = normalizeFilter({
      memberIds: ["u-1", "u-2", "u-1", "", null, undefined, 42, "  u-3  "],
    });
    expect(result.memberIds).toEqual(["u-1", "u-2", "u-3"]);
  });

  it("ignores non-array input for *Ids", () => {
    const result = normalizeFilter({ memberIds: "not-an-array", dayIds: 42 });
    expect(result.memberIds).toEqual([]);
    expect(result.dayIds).toEqual([]);
  });
});

describe("chatContextFilter.isAllIncluded", () => {
  it("true for ALL_INCLUDED", () => {
    expect(isAllIncluded(ALL_INCLUDED)).toBe(true);
    expect(isAllIncluded({})).toBe(true);
  });

  it("false if any section is toggled off", () => {
    expect(isAllIncluded({ includeMembers: false })).toBe(false);
    expect(isAllIncluded({ includeDays: false })).toBe(false);
    expect(isAllIncluded({ includeConcepts: false })).toBe(false);
  });

  it("false if any *Ids array is non-empty", () => {
    expect(isAllIncluded({ memberIds: ["u-1"] })).toBe(false);
    expect(isAllIncluded({ dayIds: ["d-1"] })).toBe(false);
    expect(isAllIncluded({ eventIds: ["e-1"] })).toBe(false);
  });
});

describe("chatContextFilter.describeFilter", () => {
  it("returns «Полный контекст» for default", () => {
    expect(describeFilter({})).toBe("Полный контекст");
    expect(describeFilter(ALL_INCLUDED)).toBe("Полный контекст");
  });

  it("describes Russian plural forms correctly", () => {
    expect(describeFilter({ memberIds: ["u-1"] })).toBe("1 участник");
    expect(describeFilter({ memberIds: ["u-1", "u-2"] })).toBe("2 участника");
    expect(describeFilter({ memberIds: ["u-1", "u-2", "u-3", "u-4", "u-5"] })).toBe("5 участников");
    expect(describeFilter({ dayIds: ["d-1", "d-2"] })).toBe("2 дня");
    expect(describeFilter({ dayIds: ["d-1", "d-2", "d-3", "d-4", "d-5"] })).toBe("5 дней");
  });

  it("combines multiple sections", () => {
    const filter = {
      memberIds: ["u-1", "u-2"],
      dayIds: ["d-1"],
      eventIds: ["e-1", "e-2", "e-3"],
    };
    expect(describeFilter(filter)).toBe("2 участника, 1 день, 3 концепции");
  });

  it("annotates excluded sections", () => {
    expect(describeFilter({ includeConcepts: false })).toBe("без концепций");
    expect(describeFilter({ includeMembers: false, dayIds: ["d-1"] })).toBe(
      "без состава группы, 1 день",
    );
  });
});
