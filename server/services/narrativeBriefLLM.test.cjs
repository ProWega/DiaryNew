"use strict";

const {
  enrichWithNarrative,
  fingerprint,
  SYSTEM_PROMPT,
  BANNED_TERMS,
  buildProxyDispatcher,
  __resetCache,
} = require("./narrativeBriefLLM.cjs");

const sampleBrief = {
  dayId: "day-1",
  dayLabel: "День 1",
  picture: { totalParticipants: 10, respondedToday: 8, dominantState: "harmony", carefulCount: 1 },
  conversationPoints: [{ participantId: "u-1", reason: "careful_mode", note: "..." }],
  stageResonance: { search: 3, verification: 2, support: 3, transmission: 2, careful: 1 },
  events: [{ id: "e-1", title: "Утренний круг", responseCount: 8, quotes: [] }],
};

describe("enrichWithNarrative — fallback when API key missing", () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    __resetCache();
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalKey;
  });

  it("returns brief with narrative.source = fallback when no key", async () => {
    const result = await enrichWithNarrative(sampleBrief, { groupId: "g-1" });
    expect(result.narrative).toEqual({ text: null, source: "fallback" });
    // Original brief fields preserved
    expect(result.dayId).toBe("day-1");
    expect(result.picture).toEqual(sampleBrief.picture);
  });

  it("returns null/undefined briefs unchanged", async () => {
    expect(await enrichWithNarrative(null)).toBeNull();
    expect(await enrichWithNarrative(undefined)).toBeUndefined();
  });

  it("does not mutate the original brief", async () => {
    const before = JSON.stringify(sampleBrief);
    await enrichWithNarrative(sampleBrief, { groupId: "g-1" });
    expect(JSON.stringify(sampleBrief)).toBe(before);
  });
});

describe("fingerprint", () => {
  beforeEach(() => __resetCache());

  it("is stable for identical brief content", () => {
    const a = fingerprint(sampleBrief);
    const b = fingerprint({ ...sampleBrief });
    expect(a).toBe(b);
  });

  it("changes when picture changes", () => {
    const a = fingerprint(sampleBrief);
    const b = fingerprint({
      ...sampleBrief,
      picture: { ...sampleBrief.picture, dominantState: "breakdown" },
    });
    expect(a).not.toBe(b);
  });

  it("changes when conversationPoints reasons change", () => {
    const a = fingerprint(sampleBrief);
    const b = fingerprint({
      ...sampleBrief,
      conversationPoints: [{ participantId: "u-1", reason: "shift_down", note: "..." }],
    });
    expect(a).not.toBe(b);
  });
});

describe("buildProxyDispatcher — protocol auto-detection", () => {
  it("returns null when no URL given", () => {
    expect(buildProxyDispatcher("")).toBeNull();
    expect(buildProxyDispatcher(null)).toBeNull();
    expect(buildProxyDispatcher(undefined)).toBeNull();
  });

  it("builds an undici ProxyAgent for http://", () => {
    const dispatcher = buildProxyDispatcher("http://proxy.example.com:8080");
    const { ProxyAgent } = require("undici");
    expect(dispatcher).toBeInstanceOf(ProxyAgent);
  });

  it("builds an undici ProxyAgent for https:// with auth", () => {
    const dispatcher = buildProxyDispatcher("https://user:pass@proxy.example.com:443");
    const { ProxyAgent } = require("undici");
    expect(dispatcher).toBeInstanceOf(ProxyAgent);
  });

  it("builds a SOCKS-bridged undici Agent for socks5://", () => {
    const dispatcher = buildProxyDispatcher("socks5://127.0.0.1:1080");
    const { Agent, ProxyAgent } = require("undici");
    expect(dispatcher).toBeInstanceOf(Agent);
    expect(dispatcher).not.toBeInstanceOf(ProxyAgent);
  });

  it("treats socks:// (no version) as socks", () => {
    const dispatcher = buildProxyDispatcher("socks://127.0.0.1:1080");
    const { ProxyAgent } = require("undici");
    expect(dispatcher).not.toBeInstanceOf(ProxyAgent);
  });
});

describe("SYSTEM_PROMPT — methodology contract", () => {
  it("does not itself contain banned terms in instruction position", () => {
    // The prompt mentions banned words to forbid them, but it should not
    // *use* them as descriptors — verify by looking at sentences that don't
    // come from the BANNED_TERMS list itself.
    const lines = SYSTEM_PROMPT.split("\n").filter((line) => !line.includes("Не используй слова"));
    const joined = lines.join("\n").toLowerCase();
    // Sanity: "риск" should appear in the prompt only inside the ban-list line.
    expect(joined).not.toMatch(/риск(?!и)/);
  });

  it("instructs the model not to write participant names", () => {
    expect(SYSTEM_PROMPT).toMatch(/имён|имена/i);
  });

  it("specifies a 3-5 sentence range", () => {
    expect(SYSTEM_PROMPT).toMatch(/3.{0,3}5 предлож/);
  });

  it("BANNED_TERMS includes the high-priority diagnostic words", () => {
    for (const word of ["риск", "уровень", "статус", "диагноз", "прогресс", "метрика"]) {
      expect(BANNED_TERMS).toContain(word);
    }
  });
});
