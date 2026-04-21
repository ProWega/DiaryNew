import {
  AdminUserDirectory,
  AuditTimeline,
  GroupAssignmentPanel,
  RoleAssignmentMatrix,
  SessionCatalog,
  SessionEditorForm,
  UserEditorForm,
} from "./AdminComponents";
import { RegistrationAccessPanel } from "../access/AccessComponents";
import { adminWorkspaceFixture } from "../../stories/fixtures/adminWorkspace";

export default {
  title: "Admin/Components",
};

const workspace = adminWorkspaceFixture;
const noop = (...args) => console.log("action", ...args);

export function UsersDirectory() {
  return (
    <AdminUserDirectory
      users={workspace.users}
      selectedUserId="user-organizer-1"
      query=""
      roleFilter="all"
      statusFilter="all"
      onQueryChange={noop}
      onRoleFilterChange={noop}
      onStatusFilterChange={noop}
      onSelectUser={noop}
    />
  );
}

export function UserFormEdit() {
  return <UserEditorForm value={workspace.users[1]} roleOptions={workspace.roleOptions} onChange={noop} onSubmit={noop} onStatusChange={noop} />;
}

export function UserFormCreate() {
  return <UserEditorForm value={{ fullName: "", role: "organizer", status: "active" }} mode="create" roleOptions={workspace.roleOptions} onChange={noop} onSubmit={noop} />;
}

export function SessionsCatalog() {
  return <SessionCatalog sessions={workspace.sessions} selectedSessionId="session-istoki-school-2026" query="" onQueryChange={noop} onSelectSession={noop} />;
}

export function SessionFormEdit() {
  return <SessionEditorForm value={workspace.sessions[0]} onChange={noop} onSubmit={noop} />;
}

export function RegistrationOpen() {
  return <RegistrationAccessPanel value={workspace.sessions[0]} onChange={noop} onSubmit={noop} />;
}

export function RegistrationCapacityFull() {
  return <RegistrationAccessPanel value={workspace.sessions[1]} onChange={noop} onSubmit={noop} />;
}

export function Assignments() {
  return (
    <RoleAssignmentMatrix
      users={workspace.users}
      sessions={workspace.sessions}
      groups={workspace.groups}
      assignments={workspace.assignments}
      roleOptions={workspace.roleOptions}
      value={{ userId: "user-organizer-1", sessionId: "session-istoki-school-2026", role: "organizer", groupId: "" }}
      onChange={noop}
      onSubmit={noop}
    />
  );
}

export function Groups() {
  return <GroupAssignmentPanel groups={workspace.groups} />;
}

export function Audit() {
  return <AuditTimeline items={workspace.auditLog} />;
}
