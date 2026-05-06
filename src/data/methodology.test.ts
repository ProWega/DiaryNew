import { describe, it, expect } from "vitest";
import {
  STATE_LABELS,
  STATE_LABEL_META,
  STATE_SCALE_TO_METHODOLOGY,
  GROUP_LAD,
  GROUP_LAD_META,
  JOURNEY_STAGE,
  JOURNEY_STAGE_META,
  CAREFUL_MODE_META,
  SUMMARY_AXES,
  SUMMARY_AXIS_META,
  REFLECTION_PROMPTS_BY_STAGE,
  REFLECTION_PROMPTS_CAREFUL,
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

describe("JOURNEY_STAGE (4 этапа пути v4)", () => {
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

  it("does not include 'silence' as a stage (Тишина — отдельный careful_mode flag)", () => {
    expect(JOURNEY_STAGE).not.toContain("silence");
    expect(JOURNEY_STAGE).not.toContain("crossroads");
  });
});

describe("CAREFUL_MODE_META (флаг «бережно» поверх любого этапа)", () => {
  it("has non-empty ru, tagline, description", () => {
    expect(CAREFUL_MODE_META.ru).toBeTruthy();
    expect(CAREFUL_MODE_META.tagline).toBeTruthy();
    expect(CAREFUL_MODE_META.description).toBeTruthy();
  });

  it("description mentions that it can be applied over any stage", () => {
    expect(CAREFUL_MODE_META.description.toLowerCase()).toMatch(/поверх|любо|этап/);
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

  it("no prompt across all stages uses banned hard verbs (правило 6)", () => {
    for (const stage of JOURNEY_STAGE) {
      for (const axis of SUMMARY_AXES) {
        const prompt = REFLECTION_PROMPTS_BY_STAGE[stage][axis].toLowerCase();
        expect(prompt).not.toMatch(/опишите|оцените|подробно|обязательно/);
      }
    }
  });
});

describe("REFLECTION_PROMPTS_CAREFUL (мягкие промпты для careful_mode)", () => {
  it("has prompts for all 3 summary axes", () => {
    for (const axis of SUMMARY_AXES) {
      expect(REFLECTION_PROMPTS_CAREFUL[axis]).toBeTruthy();
    }
  });

  it("prompts have soft tone — no hard verbs (правило 6: мягкие пороги для бережного)", () => {
    for (const axis of SUMMARY_AXES) {
      const prompt = REFLECTION_PROMPTS_CAREFUL[axis].toLowerCase();
      expect(prompt).not.toMatch(/опишите|оцените|подробно|обязательно/);
    }
  });

  it("prompts under 100 chars (бережно = коротко)", () => {
    for (const axis of SUMMARY_AXES) {
      expect(REFLECTION_PROMPTS_CAREFUL[axis].length).toBeLessThanOrEqual(100);
    }
  });
});
