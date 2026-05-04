import { describe, it, expect } from "vitest";
import {
  STATE_LABELS,
  STATE_LABEL_META,
  STATE_SCALE_TO_METHODOLOGY,
  GROUP_LAD,
  GROUP_LAD_META,
  MOOD,
  MOOD_META,
  SUMMARY_AXES,
  SUMMARY_AXIS_META,
  REFLECTION_PROMPTS_BY_MOOD,
} from "./methodology";
import { STATE_SCALE_ORDER } from "./stateScaleModel";

describe("STATE_LABELS (5 methodology levels)", () => {
  it("has exactly 5 entries in canonical order", () => {
    expect(STATE_LABELS).toEqual(["silence", "tuning", "harmony", "lift", "breakdown"]);
  });

  it("every label has non-empty meta", () => {
    for (const label of STATE_LABELS) {
      expect(STATE_LABEL_META[label].ru).toBeTruthy();
      expect(STATE_LABEL_META[label].description).toBeTruthy();
      expect(STATE_LABEL_META[label].participantHint).toBeTruthy();
    }
  });
});

describe("STATE_SCALE_TO_METHODOLOGY (7 → 5 mapping)", () => {
  it("covers every existing 7-level state id", () => {
    for (const id of STATE_SCALE_ORDER) {
      expect(STATE_SCALE_TO_METHODOLOGY[id]).toBeTruthy();
    }
  });

  it("maps every id to a known methodology label", () => {
    const labelSet = new Set<string>(STATE_LABELS);
    for (const target of Object.values(STATE_SCALE_TO_METHODOLOGY)) {
      expect(labelSet.has(target)).toBe(true);
    }
  });

  it("every methodology label is reachable from at least one source state", () => {
    const reached = new Set(Object.values(STATE_SCALE_TO_METHODOLOGY));
    for (const label of STATE_LABELS) {
      expect(reached.has(label)).toBe(true);
    }
  });

  it("groups apathy+passive into silence and overstimulated+panic into breakdown", () => {
    expect(STATE_SCALE_TO_METHODOLOGY.apathy).toBe("silence");
    expect(STATE_SCALE_TO_METHODOLOGY.passive).toBe("silence");
    expect(STATE_SCALE_TO_METHODOLOGY.overstimulated).toBe("breakdown");
    expect(STATE_SCALE_TO_METHODOLOGY.panic).toBe("breakdown");
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

describe("MOOD (4 настроя)", () => {
  it("has exactly 4 moods", () => {
    expect(MOOD).toEqual(["crossroads", "support", "transmission", "silence"]);
  });

  it("every mood has non-empty meta with ru, tagline, description", () => {
    for (const mood of MOOD) {
      expect(MOOD_META[mood].ru).toBeTruthy();
      expect(MOOD_META[mood].tagline).toBeTruthy();
      expect(MOOD_META[mood].description).toBeTruthy();
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

describe("REFLECTION_PROMPTS_BY_MOOD (4 моода × 3 оси)", () => {
  it("every mood has prompts for every summary axis", () => {
    for (const mood of MOOD) {
      for (const axis of SUMMARY_AXES) {
        expect(REFLECTION_PROMPTS_BY_MOOD[mood][axis]).toBeTruthy();
      }
    }
  });

  it("prompts are short — under 120 chars (методическое правило: тон мягкий)", () => {
    for (const mood of MOOD) {
      for (const axis of SUMMARY_AXES) {
        expect(REFLECTION_PROMPTS_BY_MOOD[mood][axis].length).toBeLessThanOrEqual(120);
      }
    }
  });

  it("prompts under mood=silence avoid hard verbs (правило 6: мягкие пороги)", () => {
    const silencePrompts = REFLECTION_PROMPTS_BY_MOOD.silence;
    for (const axis of SUMMARY_AXES) {
      const prompt = silencePrompts[axis].toLowerCase();
      expect(prompt).not.toMatch(/опишите|оцените|подробно|обязательно/);
    }
  });
});
