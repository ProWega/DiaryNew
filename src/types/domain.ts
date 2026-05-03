export type Role = "participant" | "curator" | "organizer" | "admin";

export type AssignmentStatus = "active" | "disabled";

export type Permission =
  | "participant.diary.read"
  | "participant.diary.write"
  | "participant.self.read"
  | "participant.dynamics.read"
  | "group.analytics.read"
  | "group.notes.write"
  | "group.export"
  | "session.analytics.read"
  | "program.manage"
  | "users.manage"
  | "ai.manage"
  | "typologies.manage"
  | "security.read"
  | "security.manage";

export interface Assignment {
  sessionId: string | number;
  groupId?: string | number | null;
  role: Role;
  status: AssignmentStatus;
}

export interface Subject {
  sessionId?: string | number | null;
  groupId?: string | number | null;
  userId?: string | number;
}

export interface CurrentUser {
  id: string | number;
  fullName: string;
  role: Role;
  baseRole?: Role;
  roleLabel: string;
  sessionId?: string | number | null;
  groupId?: string | number | null;
  sessionLabel?: string;
  groupLabel?: string;
  assignments?: Assignment[];
}

export interface NavigationItem {
  id: string;
  label: string;
  to: string;
}
