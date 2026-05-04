"use strict";

const { applyToEntry, applyToList } = require("./privacy.cjs");

describe("applyToEntry — single record", () => {
  it("returns participant's own entry unchanged", () => {
    const entry = { id: "e1", user_id: "u1", comment: "secret", is_anonymous: true };
    expect(applyToEntry(entry, "participant")).toEqual(entry);
  });

  it("returns admin view unchanged (admin gates via audit_log, not via filter)", () => {
    const entry = {
      id: "e1",
      user_id: "u1",
      comment: "secret",
      is_anonymous: true,
      is_hidden_from_curator: true,
    };
    expect(applyToEntry(entry, "admin")).toEqual(entry);
  });

  it("drops hidden entry for curator", () => {
    const entry = { id: "e1", user_id: "u1", is_hidden_from_curator: true };
    expect(applyToEntry(entry, "curator")).toBeNull();
  });

  it("drops hidden entry for organizer", () => {
    const entry = { id: "e1", user_id: "u1", is_hidden_from_curator: true };
    expect(applyToEntry(entry, "organizer")).toBeNull();
  });

  it("scrubs user fields for anonymous entry shown to curator", () => {
    const entry = {
      id: "e1",
      user_id: "u1",
      full_name: "Анна Иванова",
      comment: "содержание",
      is_anonymous: true,
    };
    const result = applyToEntry(entry, "curator");
    expect(result).not.toBeNull();
    expect(result.user_id).toBeNull();
    expect(result.full_name).toBeNull();
    expect(result.comment).toBe("содержание");
    expect(result.anonymous).toBe(true);
  });

  it("supports camelCase field names alongside snake_case", () => {
    const entry = {
      id: "e1",
      userId: "u1",
      fullName: "Анна",
      isAnonymous: true,
    };
    const result = applyToEntry(entry, "curator");
    expect(result.userId).toBeNull();
    expect(result.fullName).toBeNull();
    expect(result.anonymous).toBe(true);
  });

  it("hidden flag wins over anonymous (hidden first)", () => {
    const entry = {
      id: "e1",
      user_id: "u1",
      is_anonymous: true,
      is_hidden_from_curator: true,
    };
    expect(applyToEntry(entry, "curator")).toBeNull();
  });

  it("returns null for null input", () => {
    expect(applyToEntry(null, "curator")).toBeNull();
  });

  it("passes non-flagged entry through unchanged for curator", () => {
    const entry = { id: "e1", user_id: "u1", comment: "ok", is_anonymous: false };
    expect(applyToEntry(entry, "curator")).toBe(entry);
  });
});

describe("applyToList — array of records", () => {
  it("filters hidden and scrubs anonymous in one pass", () => {
    const entries = [
      { id: "1", user_id: "u1", comment: "a" },
      { id: "2", user_id: "u2", comment: "b", is_anonymous: true, full_name: "B" },
      { id: "3", user_id: "u3", comment: "c", is_hidden_from_curator: true },
      { id: "4", user_id: "u4", comment: "d" },
    ];
    const result = applyToList(entries, "curator");
    expect(result).toHaveLength(3); // entry 3 dropped
    expect(result[0].id).toBe("1");
    expect(result[1].id).toBe("2");
    expect(result[1].user_id).toBeNull();
    expect(result[1].anonymous).toBe(true);
    expect(result[2].id).toBe("4");
  });

  it("returns participant list unchanged", () => {
    const entries = [
      { id: "1", is_anonymous: true },
      { id: "2", is_hidden_from_curator: true },
    ];
    expect(applyToList(entries, "participant")).toBe(entries);
  });

  it("handles non-array input gracefully", () => {
    expect(applyToList(null, "curator")).toBeNull();
    expect(applyToList(undefined, "curator")).toBeUndefined();
  });
});
