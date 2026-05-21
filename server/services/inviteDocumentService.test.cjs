"use strict";

jest.mock("../db/postgres.cjs", () => ({
  query: jest.fn(),
}));
jest.mock("../db/repositories/authStore.cjs", () => ({
  createMagicLink: jest.fn(),
}));

const xlsx = require("xlsx");
const { query } = require("../db/postgres.cjs");
const { createMagicLink } = require("../db/repositories/authStore.cjs");
const {
  buildTemplateXlsx,
  parseTemplateXlsx,
  createBulkInvites,
  renderInvitesPdf,
  TEMPLATE_HEADERS,
} = require("./inviteDocumentService.cjs");

function buildXlsx(rows) {
  const wb = xlsx.utils.book_new();
  const sheet = xlsx.utils.aoa_to_sheet(rows);
  xlsx.utils.book_append_sheet(wb, sheet, "Приглашения");
  return xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
}

function rows(arr) {
  return { rows: arr };
}

describe("buildTemplateXlsx", () => {
  it("returns a non-empty buffer with xlsx zip-magic", () => {
    const buf = buildTemplateXlsx();
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(100);
    // xlsx — это zip-архив, магия PK..
    expect(buf.slice(0, 2).toString("hex")).toBe("504b");
  });

  it("template round-trips through parseTemplateXlsx", () => {
    const buf = buildTemplateXlsx();
    const parsed = parseTemplateXlsx(buf);
    expect(parsed.stats.groupsCount).toBeGreaterThan(0);
    expect(parsed.stats.participantsCount).toBeGreaterThan(0);
    expect(parsed.groups[0]).toHaveProperty("name");
    expect(parsed.groups[0]).toHaveProperty("curator");
    expect(Array.isArray(parsed.groups[0].participants)).toBe(true);
  });
});

describe("parseTemplateXlsx", () => {
  it("groups rows by group name and dedupes participants", () => {
    const buf = buildXlsx([
      TEMPLATE_HEADERS,
      ["Группа A", "Иван Куратор", "Пётр"],
      ["Группа A", "Иван Куратор", "Анна"],
      ["Группа A", "", "Пётр"], // дубль — выкидывается
      ["Группа B", "Мария Куратор", "Ольга"],
    ]);
    const result = parseTemplateXlsx(buf);
    expect(result.groups).toHaveLength(2);
    const g1 = result.groups.find((g) => g.name === "Группа A");
    expect(g1.curator).toBe("Иван Куратор");
    expect(g1.participants.sort()).toEqual(["Анна", "Пётр"]);
    const g2 = result.groups.find((g) => g.name === "Группа B");
    expect(g2.participants).toEqual(["Ольга"]);
    expect(result.stats.curatorsCount).toBe(2);
  });

  it("emits warning when curator missing for a group", () => {
    const buf = buildXlsx([TEMPLATE_HEADERS, ["Группа без куратора", "", "Имя"]]);
    const result = parseTemplateXlsx(buf);
    expect(result.warnings.some((w) => w.kind === "missing_curator")).toBe(true);
    expect(result.stats.curatorsCount).toBe(0);
  });

  it("uses first non-empty curator if column has gaps", () => {
    const buf = buildXlsx([
      TEMPLATE_HEADERS,
      ["Группа X", "", "Имя 1"],
      ["Группа X", "Куратор Иванов", "Имя 2"],
    ]);
    const result = parseTemplateXlsx(buf);
    expect(result.groups[0].curator).toBe("Куратор Иванов");
  });

  it("throws 400 when required columns missing", () => {
    const buf = buildXlsx([
      ["Просто", "колонка"],
      ["a", "b"],
    ]);
    expect(() => parseTemplateXlsx(buf)).toThrow();
  });

  it("throws 400 on empty template", () => {
    const buf = buildXlsx([TEMPLATE_HEADERS]); // только заголовки
    expect(() => parseTemplateXlsx(buf)).toThrow();
  });

  it("warns on group without curator-column at all", () => {
    const buf = buildXlsx([
      ["Группа", "Участник"],
      ["Группа A", "Иван"],
      ["Группа A", "Пётр"],
    ]);
    const result = parseTemplateXlsx(buf);
    expect(result.warnings.some((w) => w.kind === "missing_column")).toBe(true);
    expect(result.groups[0].curator).toBe("");
  });
});

describe("createBulkInvites", () => {
  beforeEach(() => {
    query.mockReset();
    createMagicLink.mockReset();
  });

  it("creates magic links for existing group (curator + participants)", async () => {
    // findOrCreateGroup → group exists
    query.mockResolvedValueOnce(rows([{ id: "group-1" }]));
    // findExistingSessionUserId × 3 → all return null (нет существующих юзеров)
    query.mockResolvedValue(rows([]));
    createMagicLink.mockImplementation(async ({ fullName, role }) => ({
      id: "mlink-" + fullName,
      url: "https://example.com/magic?token=" + role,
      expiresAt: "2026-06-01T00:00:00Z",
    }));

    const result = await createBulkInvites({
      sessionId: "s-1",
      actorId: "admin-1",
      groups: [{ name: "Группа A", curator: "Иван Куратор", participants: ["Пётр", "Анна"] }],
      ttlMinutes: 60,
    });

    expect(createMagicLink).toHaveBeenCalledTimes(3);
    expect(result).toHaveLength(3);
    expect(result[0].role).toBe("curator");
    expect(result[0].groupId).toBe("group-1");
  });

  it("reuses existing user id when fullName already exists in session", async () => {
    // findOrCreateGroup → exists
    query.mockResolvedValueOnce(rows([{ id: "group-1" }]));
    // findExistingSessionUserId for curator → returns user id
    query.mockResolvedValueOnce(rows([{ id: "user-existing-1" }]));
    // findExistingSessionUserId for participant → null
    query.mockResolvedValueOnce(rows([]));

    createMagicLink.mockResolvedValue({
      id: "mlink-1",
      url: "https://example.com/magic?token=xxx",
      expiresAt: "2026-06-01T00:00:00Z",
    });

    await createBulkInvites({
      sessionId: "s-1",
      actorId: "admin-1",
      groups: [{ name: "Группа A", curator: "Существующий Куратор", participants: ["Новый"] }],
    });

    // Первый createMagicLink — куратор с targetUserId, второй — participant без targetUserId.
    const calls = createMagicLink.mock.calls;
    expect(calls[0][0].targetUserId).toBe("user-existing-1");
    expect(calls[0][0].meta.reusedExistingUser).toBe(true);
    expect(calls[1][0].targetUserId).toBeNull();
    expect(calls[1][0].meta.reusedExistingUser).toBe(false);
  });

  it("auto-creates missing group", async () => {
    // group not found
    query.mockResolvedValueOnce(rows([]));
    // INSERT group
    query.mockResolvedValueOnce(rows([]));
    // INSERT audit_log
    query.mockResolvedValueOnce(rows([]));
    // findExistingSessionUserId
    query.mockResolvedValueOnce(rows([]));
    createMagicLink.mockResolvedValue({
      id: "mlink-1",
      url: "https://example.com/magic?token=xxx",
      expiresAt: "2026-06-01T00:00:00Z",
    });

    const result = await createBulkInvites({
      sessionId: "s-1",
      actorId: "admin-1",
      groups: [{ name: "Новая группа", curator: "", participants: ["Иван"] }],
    });

    expect(result).toHaveLength(1);
    expect(result[0].groupName).toBe("Новая группа");
    const insertCalls = query.mock.calls.filter((c) => /^insert into/i.test(c[0]));
    expect(insertCalls).toHaveLength(2);
  });

  it("skips curator-link when curator is empty", async () => {
    query.mockResolvedValueOnce(rows([{ id: "group-1" }]));
    // findExistingSessionUserId for participant
    query.mockResolvedValueOnce(rows([]));
    createMagicLink.mockResolvedValue({
      id: "mlink-1",
      url: "https://example.com/magic?token=xxx",
      expiresAt: "2026-06-01T00:00:00Z",
    });

    const result = await createBulkInvites({
      sessionId: "s-1",
      actorId: "admin-1",
      groups: [{ name: "Группа A", curator: "", participants: ["Иван"] }],
    });

    expect(createMagicLink).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe("participant");
  });
});

describe("renderInvitesPdf", () => {
  const invites = [
    {
      groupId: "g-1",
      groupName: "Группа A",
      role: "curator",
      fullName: "Иван Куратор",
      url: "https://example.com/magic?token=ABC",
      expiresAt: "2026-06-01",
    },
    {
      groupId: "g-1",
      groupName: "Группа A",
      role: "participant",
      fullName: "Пётр Иванов",
      url: "https://example.com/magic?token=DEF",
      expiresAt: "2026-06-01",
    },
  ];

  it("renders card layout to non-empty PDF buffer", async () => {
    const buf = await renderInvitesPdf({ invites, layout: "card", title: "Test", footer: "" });
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(500);
    expect(buf.slice(0, 5).toString()).toBe("%PDF-");
  });

  it("renders table layout", async () => {
    const buf = await renderInvitesPdf({ invites, layout: "table", title: "Test" });
    expect(buf.slice(0, 5).toString()).toBe("%PDF-");
  });

  it("falls back to card on unknown layout", async () => {
    const buf = await renderInvitesPdf({ invites, layout: "bogus", title: "Test" });
    expect(buf.slice(0, 5).toString()).toBe("%PDF-");
  });

  it("throws on empty invites", async () => {
    await expect(renderInvitesPdf({ invites: [], layout: "card" })).rejects.toThrow();
  });
});
