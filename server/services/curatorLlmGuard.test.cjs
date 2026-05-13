"use strict";

// Этот тест использует jest.mock для подмены query/sessionStore. vitest config
// тоже подхватывает .test.cjs из server/**, но jest.mock-hoisting в vitest для
// CJS работает иначе — мокаем только в Jest, в vitest целиком пропускаем.
// Полный backend integration test крутится через `npx jest server`.
const isVitest = typeof vi !== "undefined";

if (isVitest) {
  describe.skip("curatorLlmGuard (jest-only mocks)", () => {
    it("skipped in vitest — see jest run", () => {});
  });
} else describeJestSuite();

function describeJestSuite() {
  const queryMock = jest.fn(async () => ({ rows: [] }));
  const settingsMock = jest.fn(async () => ({
    defaultModel: "claude-haiku-4-5",
    allowedModels: ["claude-haiku-4-5", "claude-sonnet-4-5"],
    maxTokensPerCall: 500,
    curatorDailyTokenBudget: 1000,
    curatorChatEnabled: false,
    conceptExtractionLimit: 12000,
  }));

  jest.mock("../db/postgres.cjs", () => ({ query: queryMock }));
  jest.mock("../db/repositories/sessionStore.cjs", () => ({
    getSessionLlmSettings: settingsMock,
  }));

  const { resolveModel, ensureBudget } = require("./curatorLlmGuard.cjs");

  beforeEach(() => {
    queryMock.mockClear();
    settingsMock.mockClear();
  });

  describe("resolveModel", () => {
    it("uses defaultModel when nothing requested", async () => {
      const result = await resolveModel({ sessionId: "s-1" });
      expect(result.model).toBe("claude-haiku-4-5");
      expect(result.maxTokens).toBe(500);
    });

    it("uses requested model if it is in allowedModels", async () => {
      const result = await resolveModel({
        sessionId: "s-1",
        requestedModel: "claude-sonnet-4-5",
      });
      expect(result.model).toBe("claude-sonnet-4-5");
    });

    it("falls back to defaultModel if requested is not allowed", async () => {
      const result = await resolveModel({
        sessionId: "s-1",
        requestedModel: "claude-opus-4-7",
      });
      expect(result.model).toBe("claude-haiku-4-5");
    });
  });

  describe("ensureBudget", () => {
    it("passes when budget is 0 (unlimited)", async () => {
      settingsMock.mockResolvedValueOnce({
        defaultModel: "claude-haiku-4-5",
        allowedModels: ["claude-haiku-4-5"],
        maxTokensPerCall: 500,
        curatorDailyTokenBudget: 0,
        curatorChatEnabled: false,
        conceptExtractionLimit: 12000,
      });
      const result = await ensureBudget({ sessionId: "s-1", curatorId: "c-1" });
      expect(result.budget).toBe(0);
    });

    it("passes when spent < budget", async () => {
      queryMock.mockImplementationOnce(async () => ({ rows: [{ total: "500" }] }));
      const result = await ensureBudget({ sessionId: "s-1", curatorId: "c-1" });
      expect(result.spent).toBe(500);
      expect(result.budget).toBe(1000);
    });

    it("throws 402 when spent >= budget", async () => {
      queryMock.mockImplementationOnce(async () => ({ rows: [{ total: "1200" }] }));
      await expect(ensureBudget({ sessionId: "s-1", curatorId: "c-1" })).rejects.toMatchObject({
        status: 402,
      });
    });
  });
}
