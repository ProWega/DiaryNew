import { describe, it, expect } from "vitest";
import {
  STATE_SCALE_META,
  STATE_SCALE_ORDER,
  findMethodologyGroupForStateId,
  methodologyStateGroups,
  normalizeStateScale,
} from "./stateScaleModel";
import { STATE_LABELS, STATE_METHODOLOGY_TO_DEFAULT_SCALE } from "./methodology";

const seed = STATE_SCALE_ORDER.map((id) => ({ id }));

describe("methodologyStateGroups", () => {
  const groups = methodologyStateGroups(seed);

  it("returns exactly 5 groups in canonical order", () => {
    expect(groups.map((group) => group.id)).toEqual([...STATE_LABELS]);
  });

  it("each group has level 0..4 ascending", () => {
    expect(groups.map((group) => group.level)).toEqual([0, 1, 2, 3, 4]);
  });

  it("color of each group equals color of its canonical 7-level state", () => {
    for (const group of groups) {
      expect(group.color).toBe(STATE_SCALE_META[group.canonicalId].color);
    }
  });

  it("sourceIds together cover every 7-level state with no duplicates", () => {
    const flat = groups.flatMap((group) => group.sourceIds);
    expect(new Set(flat).size).toBe(flat.length);
    expect(new Set(flat)).toEqual(new Set(STATE_SCALE_ORDER));
  });

  it("canonicalId for each group is the configured reverse-mapping target", () => {
    for (const group of groups) {
      expect(group.canonicalId).toBe(STATE_METHODOLOGY_TO_DEFAULT_SCALE[group.id]);
    }
  });

  it("works with the default seed when called with empty array", () => {
    const fallback = methodologyStateGroups([]);
    expect(fallback).toHaveLength(5);
    expect(fallback[0].id).toBe("silence");
  });
});

describe("findMethodologyGroupForStateId", () => {
  const groups = methodologyStateGroups(seed);

  it("matches canonical id directly", () => {
    expect(findMethodologyGroupForStateId(groups, "balance")?.id).toBe("harmony");
  });

  it("matches edge legacy ids — panic → breakdown, apathy → silence", () => {
    expect(findMethodologyGroupForStateId(groups, "panic")?.id).toBe("breakdown");
    expect(findMethodologyGroupForStateId(groups, "apathy")?.id).toBe("silence");
  });

  it("returns null for empty / unknown id", () => {
    expect(findMethodologyGroupForStateId(groups, "")).toBeNull();
    expect(findMethodologyGroupForStateId(groups, "totally-unknown")).toBeNull();
  });
});

describe("normalizeStateScale (regression — must still work after helper additions)", () => {
  it("preserves length and order", () => {
    const result = normalizeStateScale(seed);
    expect(result).toHaveLength(STATE_SCALE_ORDER.length);
    expect(result.map((state) => state.id)).toEqual([...STATE_SCALE_ORDER]);
  });
});
