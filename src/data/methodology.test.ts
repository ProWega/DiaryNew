import { describe, it, expect } from "vitest";
import {
  GROUP_LAD,
  GROUP_LAD_META,
  JOURNEY_STAGE,
  JOURNEY_STAGE_META,
  SUMMARY_AXES,
  SUMMARY_AXIS_META,
  REFLECTION_PROMPTS_BY_STAGE,
} from "./methodology";
import { STATE_SCALE_ORDER, STATE_SCALE_META } from "./stateScaleModel";

describe("STATE_SCALE_META (7-балльная активационная шкала)", () => {
  it("covers all 7 state ids from STATE_SCALE_ORDER", () => {
    for (const id of STATE_SCALE_ORDER) {
      const entry = (STATE_SCALE_META as Record<string, { label: string }>)[id];
      expect(entry).toBeTruthy();
      expect(entry.label).toBeTruthy();
    }
  });

  it("labels Апатия → Паника в порядке шкалы", () => {
    expect((STATE_SCALE_META as Record<string, { label: string }>).apathy.label).toBe("Апатия");
    expect((STATE_SCALE_META as Record<string, { label: string }>).panic.label).toBe("Паника");
  });
});

describe("GROUP_LAD (3 values)", () => {
  it("has exactly 3 entries", () => {
    expect(GROUP_LAD).toHaveLength(3);
  });

  it("every value has non-empty meta", () => {
    for (const value of GROUP_LAD) {
      expect(GROUP_LAD_META[value].ru).toBeTruthy();
      expect(GROUP_LAD_META[value].description).toBeTruthy();
    }
  });
});

describe("JOURNEY_STAGE (4 этапа пути)", () => {
  it("has exactly 4 stages in canonical order", () => {
    expect(JOURNEY_STAGE).toEqual(["search", "verification", "support", "transmission"]);
  });

  it("every stage has non-empty meta with ru, tagline, description", () => {
    for (const stage of JOURNEY_STAGE) {
      expect(JOURNEY_STAGE_META[stage].ru).toBeTruthy();
      expect(JOURNEY_STAGE_META[stage].tagline).toBeTruthy();
      expect(JOURNEY_STAGE_META[stage].description).toBeTruthy();
    }
  });
});

describe("SUMMARY_AXES (Ум / Сердце / Воля)", () => {
  it("has exactly 3 axes in canonical order", () => {
    expect(SUMMARY_AXES).toEqual(["mind", "heart", "will"]);
  });

  it("every axis has non-empty meta", () => {
    for (const axis of SUMMARY_AXES) {
      expect(SUMMARY_AXIS_META[axis].ru).toBeTruthy();
      expect(SUMMARY_AXIS_META[axis].defaultPrompt).toBeTruthy();
    }
  });
});

describe("REFLECTION_PROMPTS_BY_STAGE (4 этапа × 3 оси)", () => {
  it("every journey stage has prompts for every summary axis", () => {
    for (const stage of JOURNEY_STAGE) {
      for (const axis of SUMMARY_AXES) {
        expect(REFLECTION_PROMPTS_BY_STAGE[stage][axis]).toBeTruthy();
      }
    }
  });

  it("prompts are short — under 120 chars (методическое правило: тон мягкий)", () => {
    for (const stage of JOURNEY_STAGE) {
      for (const axis of SUMMARY_AXES) {
        expect(REFLECTION_PROMPTS_BY_STAGE[stage][axis].length).toBeLessThanOrEqual(120);
      }
    }
  });

  it("no prompt uses banned hard verbs (правило: мягкий тон)", () => {
    for (const stage of JOURNEY_STAGE) {
      for (const axis of SUMMARY_AXES) {
        const prompt = REFLECTION_PROMPTS_BY_STAGE[stage][axis].toLowerCase();
        expect(prompt).not.toMatch(/опишите|оцените|подробно|обязательно/);
      }
    }
  });
});
