"use strict";

/**
 * Юнит-тесты для agentPromptsStore: мокаем postgres.cjs.query.
 */

// vi.mock не работает в .cjs из-за отсутствия hoisting'а в vitest для CJS-файлов.
// Обходим через прямую подмену query в require.cache до первого require'а
// тестируемого модуля.

const path = require("node:path");

const postgresPath = require.resolve("../postgres.cjs");
const queryMock = vi.fn();
require.cache[postgresPath] = {
  id: postgresPath,
  filename: postgresPath,
  loaded: true,
  exports: { query: queryMock },
};

const store = require("./agentPromptsStore.cjs");
const query = queryMock;

function rows(arr) {
  return { rows: arr };
}

beforeEach(() => {
  query.mockReset();
});

describe("agentPromptsStore.normalizeBlocks", () => {
  it("returns [] for null / undefined / non-array", () => {
    expect(store.__normalizeBlocks(null)).toEqual([]);
    expect(store.__normalizeBlocks(undefined)).toEqual([]);
    expect(store.__normalizeBlocks({})).toEqual([]);
    expect(store.__normalizeBlocks("not-json")).toEqual([]);
  });

  it("parses JSON string", () => {
    const parsed = store.__normalizeBlocks(
      JSON.stringify([{ key: "members", enabled: true }, { key: "feedback" }]),
    );
    expect(parsed).toEqual([
      { key: "members", enabled: true },
      { key: "feedback", enabled: true },
    ]);
  });

  it("drops blocks without a key", () => {
    expect(
      store.__normalizeBlocks([
        { key: "members", enabled: false },
        { enabled: true },
        { key: "  ", enabled: true },
        { key: "feedback" },
      ]),
    ).toEqual([
      { key: "members", enabled: false },
      { key: "feedback", enabled: true },
    ]);
  });
});

describe("agentPromptsStore.saveNewVersion", () => {
  it("increments version, demotes previous current, inserts new as current", async () => {
    // queries in saveNewVersion: BEGIN, max(version), update old, insert, COMMIT
    query.mockResolvedValueOnce(rows([])); // BEGIN
    query.mockResolvedValueOnce(rows([{ v: 4 }])); // max version
    query.mockResolvedValueOnce(rows([])); // update demote
    query.mockResolvedValueOnce(
      rows([
        {
          id: "agent-prompt-xyz",
          agent_type: "curator_chat",
          name: "Чат",
          version: 5,
          system_text: "new prompt",
          blocks_config: [{ key: "members", enabled: true }],
          model: null,
          max_tokens: null,
          is_current: true,
          notes: "test",
          created_by: "admin-1",
          created_at: "2026-05-20T00:00:00Z",
        },
      ]),
    );
    query.mockResolvedValueOnce(rows([])); // COMMIT

    const result = await store.saveNewVersion(
      "curator_chat",
      {
        name: "Чат",
        systemText: "new prompt",
        blocksConfig: [{ key: "members", enabled: true }],
        notes: "test",
      },
      "admin-1",
    );

    expect(result.version).toBe(5);
    expect(result.isCurrent).toBe(true);
    expect(result.blocksConfig).toEqual([{ key: "members", enabled: true }]);

    // Verify the SQL sequence: BEGIN → max → UPDATE → INSERT → COMMIT
    const calls = query.mock.calls.map((c) => String(c[0]).trim().split(/\s+/)[0].toUpperCase());
    expect(calls).toEqual(["BEGIN", "SELECT", "UPDATE", "INSERT", "COMMIT"]);
  });

  it("starts from version 1 when no prior versions", async () => {
    query.mockResolvedValueOnce(rows([])); // BEGIN
    query.mockResolvedValueOnce(rows([{ v: 0 }])); // max returns 0
    query.mockResolvedValueOnce(rows([])); // update demote (no-op)
    query.mockResolvedValueOnce(
      rows([
        {
          id: "agent-prompt-new",
          agent_type: "custom_agent",
          name: "Custom",
          version: 1,
          system_text: "x",
          blocks_config: [],
          model: null,
          max_tokens: null,
          is_current: true,
          notes: null,
          created_by: null,
          created_at: "2026-05-20T00:00:00Z",
        },
      ]),
    );
    query.mockResolvedValueOnce(rows([])); // COMMIT

    const result = await store.saveNewVersion("custom_agent", {
      name: "Custom",
      systemText: "x",
      blocksConfig: [],
    });
    expect(result.version).toBe(1);
  });

  it("rolls back on insert failure", async () => {
    query.mockResolvedValueOnce(rows([])); // BEGIN
    query.mockResolvedValueOnce(rows([{ v: 0 }]));
    query.mockResolvedValueOnce(rows([]));
    query.mockRejectedValueOnce(new Error("constraint violation"));
    query.mockResolvedValueOnce(rows([])); // ROLLBACK

    await expect(
      store.saveNewVersion("curator_chat", {
        name: "x",
        systemText: "x",
        blocksConfig: [],
      }),
    ).rejects.toThrow("constraint violation");

    const lastCall = String(query.mock.calls.at(-1)[0]).trim().toUpperCase();
    expect(lastCall).toBe("ROLLBACK");
  });

  it("throws when agentType missing", async () => {
    await expect(store.saveNewVersion("", { systemText: "x" })).rejects.toThrow("agentType");
  });
});

describe("agentPromptsStore.restoreVersion", () => {
  it("creates a new row with bumped version when restoring older version", async () => {
    // getByVersionId
    query.mockResolvedValueOnce(
      rows([
        {
          id: "agent-prompt-old",
          agent_type: "curator_chat",
          name: "Старая",
          version: 2,
          system_text: "old prompt",
          blocks_config: [{ key: "feedback", enabled: true }],
          model: null,
          max_tokens: null,
          is_current: false,
          notes: null,
          created_by: null,
          created_at: "2026-04-01T00:00:00Z",
        },
      ]),
    );

    // saveNewVersion path
    query.mockResolvedValueOnce(rows([])); // BEGIN
    query.mockResolvedValueOnce(rows([{ v: 5 }])); // max
    query.mockResolvedValueOnce(rows([])); // update demote
    query.mockResolvedValueOnce(
      rows([
        {
          id: "agent-prompt-restored",
          agent_type: "curator_chat",
          name: "Старая",
          version: 6,
          system_text: "old prompt",
          blocks_config: [{ key: "feedback", enabled: true }],
          model: null,
          max_tokens: null,
          is_current: true,
          notes: "Откат на v2",
          created_by: "admin-1",
          created_at: "2026-05-20T00:00:00Z",
        },
      ]),
    );
    query.mockResolvedValueOnce(rows([])); // COMMIT

    const result = await store.restoreVersion("agent-prompt-old", "admin-1");
    expect(result.version).toBe(6);
    expect(result.systemText).toBe("old prompt");
    expect(result.notes).toBe("Откат на v2");
    expect(result.isCurrent).toBe(true);
  });

  it("returns row unchanged when restoring the already-current version", async () => {
    query.mockResolvedValueOnce(
      rows([
        {
          id: "agent-prompt-current",
          agent_type: "curator_chat",
          name: "Current",
          version: 3,
          system_text: "...",
          blocks_config: [],
          model: null,
          max_tokens: null,
          is_current: true,
          notes: null,
          created_by: null,
          created_at: "2026-05-19T00:00:00Z",
        },
      ]),
    );

    const result = await store.restoreVersion("agent-prompt-current", "admin-1");
    expect(result.isCurrent).toBe(true);
    expect(result.version).toBe(3);
    // Only 1 query — the getByVersionId. No saveNewVersion path.
    expect(query.mock.calls).toHaveLength(1);
  });

  it("throws 404 when version not found", async () => {
    query.mockResolvedValueOnce(rows([]));
    await expect(store.restoreVersion("missing", "admin-1")).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe("agentPromptsStore.listCurrent / getCurrent / listHistory", () => {
  it("listCurrent maps rows", async () => {
    query.mockResolvedValueOnce(
      rows([
        {
          id: "a",
          agent_type: "curator_chat",
          name: "Chat",
          version: 1,
          system_text: "s",
          blocks_config: [],
          model: null,
          max_tokens: null,
          is_current: true,
          notes: null,
          created_by: null,
          created_at: "2026-05-01",
        },
      ]),
    );
    const list = await store.listCurrent();
    expect(list).toHaveLength(1);
    expect(list[0].agentType).toBe("curator_chat");
  });

  it("getCurrent returns null for missing agentType", async () => {
    expect(await store.getCurrent("")).toBeNull();
    expect(query).not.toHaveBeenCalled();
  });

  it("listHistory returns empty for missing agentType", async () => {
    expect(await store.listHistory("")).toEqual([]);
  });
});
