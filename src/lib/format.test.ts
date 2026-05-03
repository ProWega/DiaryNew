import { describe, it, expect } from "vitest";
import { formatNumber, formatPercent, formatDelta, formatDate, formatRelative } from "./format";

describe("formatNumber", () => {
  it("returns em-dash for non-finite", () => {
    expect(formatNumber(NaN)).toBe("—");
    expect(formatNumber(undefined)).toBe("—");
    expect(formatNumber("abc")).toBe("—");
  });

  it("formats with comma decimal separator", () => {
    expect(formatNumber(1.5)).toBe("1,5");
    expect(formatNumber(2)).toBe("2,0");
  });

  it("respects digits param", () => {
    expect(formatNumber(1.2345, 2)).toBe("1,23");
    expect(formatNumber(1.2345, 0)).toBe("1");
  });
});

describe("formatPercent", () => {
  it("returns 0% for non-finite", () => {
    expect(formatPercent(NaN)).toBe("0%");
    expect(formatPercent(null)).toBe("0%");
  });

  it("rounds to integer percent", () => {
    expect(formatPercent(33.4)).toBe("33%");
    expect(formatPercent(33.5)).toBe("34%");
  });
});

describe("formatDelta", () => {
  it("prefixes positive values with +", () => {
    expect(formatDelta(1.5)).toBe("+1,5");
    expect(formatDelta(0)).toBe("0,0");
  });

  it("preserves minus for negatives", () => {
    expect(formatDelta(-1.2)).toBe("-1,2");
  });

  it("returns em-dash for non-finite", () => {
    expect(formatDelta(NaN)).toBe("—");
  });
});

describe("formatDate", () => {
  it("returns em-dash for falsy values", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate("")).toBe("—");
  });

  it("returns the input string for invalid dates", () => {
    expect(formatDate("not-a-date")).toBe("not-a-date");
  });

  it("formats ISO date as ru-RU locale", () => {
    const result = formatDate("2026-05-01T12:00:00Z");
    // We don't pin the exact output (depends on timezone) but it must contain a year
    expect(result).toMatch(/2026/);
    expect(result).not.toBe("—");
  });
});

describe("formatRelative", () => {
  it("returns em-dash for falsy/invalid", () => {
    expect(formatRelative(null)).toBe("—");
    expect(formatRelative("not-a-date")).toBe("—");
  });

  it("returns a non-em-dash string for a valid date", () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = formatRelative(yesterday);
    expect(result).not.toBe("—");
    expect(typeof result).toBe("string");
  });
});
