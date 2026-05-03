import { describe, it, expect } from "vitest";
import {
  getIsoDateDayStamp,
  addDaysToIsoDate,
  formatProgramDayDateLabel,
  isCustomProgramDayDateLabel,
  selectClosestProgramDay,
} from "./programDays";

describe("getIsoDateDayStamp", () => {
  it("returns null for invalid input", () => {
    expect(getIsoDateDayStamp("")).toBeNull();
    expect(getIsoDateDayStamp("not-a-date")).toBeNull();
    expect(getIsoDateDayStamp(null)).toBeNull();
    expect(getIsoDateDayStamp("2026-13-01")).toBeNull();
  });

  it("returns a stable integer for valid ISO dates", () => {
    const a = getIsoDateDayStamp("2026-05-01");
    const b = getIsoDateDayStamp("2026-05-02");
    expect(typeof a).toBe("number");
    expect(b).toBe((a ?? 0) + 1);
  });
});

describe("addDaysToIsoDate", () => {
  it("returns empty string for invalid input", () => {
    expect(addDaysToIsoDate("not-a-date", 1)).toBe("");
  });

  it("adds days correctly", () => {
    expect(addDaysToIsoDate("2026-05-01", 1)).toBe("2026-05-02");
    expect(addDaysToIsoDate("2026-05-01", 5)).toBe("2026-05-06");
  });

  it("handles month boundary", () => {
    expect(addDaysToIsoDate("2026-05-31", 1)).toBe("2026-06-01");
  });

  it("handles year boundary", () => {
    expect(addDaysToIsoDate("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("handles negative offsets", () => {
    expect(addDaysToIsoDate("2026-05-02", -1)).toBe("2026-05-01");
  });
});

describe("formatProgramDayDateLabel", () => {
  it("returns empty string for invalid input", () => {
    expect(formatProgramDayDateLabel("not-a-date")).toBe("");
  });

  it("formats valid ISO dates as ru-RU", () => {
    const result = formatProgramDayDateLabel("2026-05-01");
    expect(result).toMatch(/мая/);
    expect(result).toMatch(/1/);
  });
});

describe("isCustomProgramDayDateLabel", () => {
  it("false for empty label", () => {
    expect(isCustomProgramDayDateLabel("2026-05-01", "")).toBe(false);
  });

  it("true when label differs from auto-generated", () => {
    expect(isCustomProgramDayDateLabel("2026-05-01", "Открытие")).toBe(true);
  });

  it("false when label matches auto-generated", () => {
    const auto = formatProgramDayDateLabel("2026-05-01");
    expect(isCustomProgramDayDateLabel("2026-05-01", auto)).toBe(false);
  });
});

describe("selectClosestProgramDay", () => {
  it("returns null for empty array", () => {
    expect(selectClosestProgramDay([], "2026-05-01")).toBeNull();
  });

  it("returns exact match when present", () => {
    const days = [
      { id: "d1", dateValue: "2026-04-30" },
      { id: "d2", dateValue: "2026-05-01" },
      { id: "d3", dateValue: "2026-05-02" },
    ];
    const result = selectClosestProgramDay(days, "2026-05-01");
    expect(result?.id).toBe("d2");
  });

  it("returns nearest day when no exact match", () => {
    const days = [
      { id: "d1", dateValue: "2026-04-29" },
      { id: "d3", dateValue: "2026-05-03" },
    ];
    const result = selectClosestProgramDay(days, "2026-05-01");
    // 2026-04-29 is 2 days away, 2026-05-03 is 2 days away — past wins on equal distance
    expect(result?.id).toBe("d1");
  });

  it("prefers past over future on equal distance", () => {
    const days = [
      { id: "future", dateValue: "2026-05-03" },
      { id: "past", dateValue: "2026-04-29" },
    ];
    const result = selectClosestProgramDay(days, "2026-05-01");
    expect(result?.id).toBe("past");
  });

  it("returns first day when today date is invalid", () => {
    const days = [
      { id: "d1", dateValue: "2026-05-01" },
      { id: "d2", dateValue: "2026-05-02" },
    ];
    const result = selectClosestProgramDay(days, "not-a-date");
    expect(result?.id).toBe("d1");
  });

  it("ignores days without dateValue", () => {
    const days = [{ id: "d1" }, { id: "d2", dateValue: "2026-05-01" }];
    const result = selectClosestProgramDay(days, "2026-05-01");
    expect(result?.id).toBe("d2");
  });
});
