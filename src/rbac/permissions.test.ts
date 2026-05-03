import { describe, it, expect } from "vitest";
import { can, getDefaultRoute, getNavigationItems, getScopeBadges } from "./permissions";
import type { CurrentUser } from "../types/domain";

const admin: CurrentUser = {
  id: "u-admin",
  fullName: "Admin",
  role: "admin",
  roleLabel: "Администратор",
};

const participant: CurrentUser = {
  id: "u-p1",
  fullName: "Participant",
  role: "participant",
  roleLabel: "Участник",
  sessionId: "s1",
  sessionLabel: "Заезд 1",
  groupId: "g1",
  groupLabel: "Группа 1",
};

const curator: CurrentUser = {
  id: "u-c1",
  fullName: "Curator",
  role: "curator",
  roleLabel: "Куратор",
  sessionId: "s1",
  sessionLabel: "Заезд 1",
  groupId: "g1",
  groupLabel: "Группа 1",
};

const organizer: CurrentUser = {
  id: "u-o1",
  fullName: "Organizer",
  role: "organizer",
  roleLabel: "Организатор",
  sessionId: "s1",
};

describe("can() — admin override", () => {
  it("admin has every permission", () => {
    expect(can(admin, "participant.diary.read")).toBe(true);
    expect(can(admin, "security.manage")).toBe(true);
    expect(can(admin, "users.manage")).toBe(true);
  });

  it("baseRole admin works the same way", () => {
    expect(can({ ...participant, baseRole: "admin" }, "users.manage")).toBe(true);
  });

  it("returns false for null / undefined user", () => {
    expect(can(null, "participant.diary.read")).toBe(false);
    expect(can(undefined, "users.manage")).toBe(false);
  });
});

describe("can() — participant", () => {
  it("can read own diary in own session", () => {
    expect(can(participant, "participant.diary.read", { sessionId: "s1", userId: "u-p1" })).toBe(
      true,
    );
  });

  it("cannot read another participant's diary", () => {
    expect(can(participant, "participant.diary.read", { sessionId: "s1", userId: "u-other" })).toBe(
      false,
    );
  });

  it("cannot read group analytics", () => {
    expect(can(participant, "group.analytics.read", { sessionId: "s1" })).toBe(false);
  });

  it("cannot manage program / security", () => {
    expect(can(participant, "program.manage", { sessionId: "s1" })).toBe(false);
    expect(can(participant, "security.read")).toBe(false);
  });
});

describe("can() — curator", () => {
  it("can read analytics for own group", () => {
    expect(can(curator, "group.analytics.read", { sessionId: "s1", groupId: "g1" })).toBe(true);
  });

  it("cannot read analytics for another group", () => {
    expect(can(curator, "group.analytics.read", { sessionId: "s1", groupId: "g2" })).toBe(false);
  });

  it("can write notes for their group", () => {
    expect(can(curator, "group.notes.write", { sessionId: "s1", groupId: "g1" })).toBe(true);
  });

  it("cannot manage program", () => {
    expect(can(curator, "program.manage", { sessionId: "s1" })).toBe(false);
  });
});

describe("can() — organizer", () => {
  it("can manage program and read session analytics", () => {
    expect(can(organizer, "program.manage")).toBe(true);
    expect(can(organizer, "session.analytics.read")).toBe(true);
    expect(can(organizer, "users.manage")).toBe(true);
  });

  it("can read group analytics in any group", () => {
    expect(can(organizer, "group.analytics.read", { sessionId: "s1", groupId: "any" })).toBe(true);
  });

  it("cannot read security (admin-only)", () => {
    expect(can(organizer, "security.read")).toBe(false);
    expect(can(organizer, "security.manage")).toBe(false);
  });
});

describe("getDefaultRoute()", () => {
  it("returns / for null user", () => {
    expect(getDefaultRoute(null)).toBe("/");
  });

  it("routes participant to today screen", () => {
    expect(getDefaultRoute(participant)).toBe("/participant/session/s1/today");
  });

  it("routes curator to group dashboard", () => {
    expect(getDefaultRoute(curator)).toBe("/curator/session/s1/group/g1");
  });

  it("routes organizer to session view", () => {
    expect(getDefaultRoute(organizer)).toBe("/organizer/session/s1");
  });

  it("routes admin to security", () => {
    expect(getDefaultRoute(admin)).toBe("/admin/security");
  });
});

describe("getNavigationItems()", () => {
  it("returns empty array for null", () => {
    expect(getNavigationItems(null)).toEqual([]);
  });

  it("participant gets diary/self/dynamics + curator's own group view", () => {
    const items = getNavigationItems(participant).map((i) => i.id);
    expect(items).toContain("participant-today");
    expect(items).toContain("participant-self");
    expect(items).toContain("participant-dynamics");
    expect(items).not.toContain("admin-security");
    expect(items).not.toContain("organizer-session");
  });

  it("admin gets security item", () => {
    const items = getNavigationItems(admin).map((i) => i.id);
    expect(items).toContain("admin-security");
  });

  it("organizer sees session + groups + admin gets security", () => {
    const items = getNavigationItems(organizer).map((i) => i.id);
    expect(items).toContain("organizer-session");
    expect(items).toContain("curator-group");
  });
});

describe("getScopeBadges()", () => {
  it("returns empty for null", () => {
    expect(getScopeBadges(null)).toEqual([]);
  });

  it("includes role + session + group when present", () => {
    expect(getScopeBadges(participant)).toEqual([
      "Роль: Участник",
      "Заезд: Заезд 1",
      "Группа: Группа 1",
    ]);
  });

  it("omits session/group badges when fields are missing", () => {
    expect(getScopeBadges(admin)).toEqual(["Роль: Администратор"]);
  });
});
