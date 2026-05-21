"use strict";

// vi.mock не работает в .cjs из-за отсутствия hoisting'а в vitest для CJS-файлов.
// Подменяем agentPromptsStore через require.cache до загрузки сервиса.

const storePath = require.resolve("../db/repositories/agentPromptsStore.cjs");
const getCurrentMock = vi.fn();
require.cache[storePath] = {
  id: storePath,
  filename: storePath,
  loaded: true,
  exports: { getCurrent: getCurrentMock },
};

const service = require("./agentPromptsService.cjs");
const agentPromptsStore = { getCurrent: getCurrentMock };

beforeEach(() => {
  agentPromptsStore.getCurrent.mockReset();
  service.__resetCache();
});

describe("agentPromptsService.resolvePrompt", () => {
  it("returns DB row when present, marks source=db", async () => {
    agentPromptsStore.getCurrent.mockResolvedValueOnce({
      id: "agent-prompt-abc",
      agentType: "curator_chat",
      name: "Чат",
      version: 4,
      systemText: "from db",
      blocksConfig: [{ key: "members", enabled: true }],
      model: null,
      maxTokens: null,
      isCurrent: true,
    });

    const result = await service.resolvePrompt("curator_chat");
    expect(result.source).toBe("db");
    expect(result.version).toBe(4);
    expect(result.systemText).toBe("from db");
  });

  it("uses hardcoded fallback when DB returns null", async () => {
    agentPromptsStore.getCurrent.mockResolvedValueOnce(null);
    const result = await service.resolvePrompt("curator_chat");
    expect(result.source).toBe("fallback");
    expect(result.systemText).toContain("методолог-наставник");
    expect(result.blocksConfig.length).toBeGreaterThan(0);
  });

  it("uses fallback when DB throws", async () => {
    agentPromptsStore.getCurrent.mockRejectedValueOnce(new Error("DB down"));
    const result = await service.resolvePrompt("narrative_brief");
    expect(result.source).toBe("fallback");
    expect(result.systemText).toContain("записку к вечерней рефлексии");
  });

  it("caches the resolved value (no extra DB calls within TTL)", async () => {
    agentPromptsStore.getCurrent.mockResolvedValueOnce({
      id: "agent-prompt-ttl",
      agentType: "curator_chat",
      name: "Чат",
      version: 1,
      systemText: "cached value",
      blocksConfig: [],
      model: null,
      maxTokens: null,
      isCurrent: true,
    });

    await service.resolvePrompt("curator_chat");
    await service.resolvePrompt("curator_chat");
    await service.resolvePrompt("curator_chat");
    expect(agentPromptsStore.getCurrent).toHaveBeenCalledTimes(1);
  });

  it("invalidateCache forces re-read", async () => {
    agentPromptsStore.getCurrent
      .mockResolvedValueOnce({
        id: "a1",
        agentType: "curator_chat",
        name: "v1",
        version: 1,
        systemText: "first",
        blocksConfig: [],
        model: null,
        maxTokens: null,
        isCurrent: true,
      })
      .mockResolvedValueOnce({
        id: "a2",
        agentType: "curator_chat",
        name: "v2",
        version: 2,
        systemText: "second",
        blocksConfig: [],
        model: null,
        maxTokens: null,
        isCurrent: true,
      });

    const first = await service.resolvePrompt("curator_chat");
    expect(first.systemText).toBe("first");

    service.invalidateCache("curator_chat");
    const second = await service.resolvePrompt("curator_chat");
    expect(second.systemText).toBe("second");
    expect(agentPromptsStore.getCurrent).toHaveBeenCalledTimes(2);
  });

  it("returns a copy — mutating the result does not pollute the cache", async () => {
    agentPromptsStore.getCurrent.mockResolvedValueOnce({
      id: "a1",
      agentType: "curator_chat",
      name: "x",
      version: 1,
      systemText: "original",
      blocksConfig: [{ key: "members", enabled: true }],
      model: null,
      maxTokens: null,
      isCurrent: true,
    });

    const first = await service.resolvePrompt("curator_chat");
    first.systemText = "MUTATED";
    const second = await service.resolvePrompt("curator_chat");
    expect(second.systemText).toBe("original");
  });

  it("returns generic fallback for unknown custom agent type", async () => {
    agentPromptsStore.getCurrent.mockResolvedValueOnce(null);
    const result = await service.resolvePrompt("my_custom_thing");
    expect(result.source).toBe("fallback");
    expect(result.agentType).toBe("my_custom_thing");
    expect(result.systemText).toBe("");
    expect(result.blocksConfig).toEqual([]);
  });
});

describe("agentPromptsService.getPromptFingerprint", () => {
  it("fingerprint changes between versions", () => {
    const fp1 = service.getPromptFingerprint({
      id: "abc12345-aaa",
      agentType: "narrative_brief",
      version: 1,
    });
    const fp2 = service.getPromptFingerprint({
      id: "def67890-bbb",
      agentType: "narrative_brief",
      version: 2,
    });
    expect(fp1).not.toBe(fp2);
    expect(fp1).toContain("v1");
    expect(fp2).toContain("v2");
  });

  it("fallback gets stable fingerprint", () => {
    const fp = service.getPromptFingerprint({ id: null, agentType: "curator_chat" });
    expect(fp).toBe("fallback:curator_chat");
  });
});

describe("agentPromptsService.listBlockCatalog", () => {
  it("returns blocks for known agent types", () => {
    expect(service.listBlockCatalog("curator_chat").map((b) => b.key)).toEqual([
      "members",
      "feedback",
      "concepts",
    ]);
    expect(service.listBlockCatalog("narrative_brief").length).toBeGreaterThan(0);
  });

  it("returns [] for unknown agent type", () => {
    expect(service.listBlockCatalog("custom_thing")).toEqual([]);
  });
});
