"use strict";

const { normalizeLlmSettings, mergeLlmSettings, DEFAULTS } = require("./llmSettings.cjs");

describe("llmSettings.normalizeLlmSettings", () => {
  it("returns full defaults for empty object", () => {
    expect(normalizeLlmSettings({})).toEqual(DEFAULTS);
  });

  it("returns defaults for null/undefined", () => {
    expect(normalizeLlmSettings(null)).toEqual(DEFAULTS);
    expect(normalizeLlmSettings(undefined)).toEqual(DEFAULTS);
  });

  it("clamps maxTokensPerCall into [64, 8000]", () => {
    expect(normalizeLlmSettings({ maxTokensPerCall: 10 }).maxTokensPerCall).toBe(64);
    expect(normalizeLlmSettings({ maxTokensPerCall: 999999 }).maxTokensPerCall).toBe(8000);
    expect(normalizeLlmSettings({ maxTokensPerCall: 1200 }).maxTokensPerCall).toBe(1200);
  });

  it("drops unknown models from allowedModels", () => {
    const result = normalizeLlmSettings({
      allowedModels: ["claude-haiku-4-5", "gpt-9000", "claude-opus-4-7"],
    });
    expect(result.allowedModels).toEqual(["claude-haiku-4-5", "claude-opus-4-7"]);
  });

  it("falls back to defaults if allowedModels is empty after filter", () => {
    const result = normalizeLlmSettings({ allowedModels: ["gpt-9000"] });
    expect(result.allowedModels).toEqual(DEFAULTS.allowedModels);
  });

  it("defaultModel must be in allowedModels", () => {
    const result = normalizeLlmSettings({
      defaultModel: "claude-opus-4-7",
      allowedModels: ["claude-haiku-4-5"],
    });
    expect(result.defaultModel).toBe("claude-haiku-4-5");
  });

  it("accepts curatorChatEnabled as truthy/falsy", () => {
    expect(normalizeLlmSettings({ curatorChatEnabled: true }).curatorChatEnabled).toBe(true);
    expect(normalizeLlmSettings({ curatorChatEnabled: 1 }).curatorChatEnabled).toBe(true);
    expect(normalizeLlmSettings({ curatorChatEnabled: 0 }).curatorChatEnabled).toBe(false);
  });
});

describe("llmSettings.mergeLlmSettings", () => {
  it("returns normalized base if patch is empty", () => {
    expect(mergeLlmSettings({}, {})).toEqual(DEFAULTS);
  });

  it("preserves base fields not present in patch", () => {
    const base = {
      ...DEFAULTS,
      maxTokensPerCall: 1000,
      curatorDailyTokenBudget: 50000,
    };
    const merged = mergeLlmSettings(base, { curatorChatEnabled: true });
    expect(merged.maxTokensPerCall).toBe(1000);
    expect(merged.curatorDailyTokenBudget).toBe(50000);
    expect(merged.curatorChatEnabled).toBe(true);
  });

  it("re-anchors defaultModel when allowedModels narrows it out", () => {
    const base = {
      ...DEFAULTS,
      allowedModels: ["claude-haiku-4-5", "claude-opus-4-7"],
      defaultModel: "claude-opus-4-7",
    };
    const merged = mergeLlmSettings(base, { allowedModels: ["claude-haiku-4-5"] });
    expect(merged.defaultModel).toBe("claude-haiku-4-5");
  });

  it("clamps patched values", () => {
    const merged = mergeLlmSettings(DEFAULTS, { maxTokensPerCall: -5 });
    expect(merged.maxTokensPerCall).toBe(64);
  });
});
