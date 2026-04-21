import { AdminUserDirectory, UserEditorForm } from "./AdminComponents";
import { adminWorkspaceFixture } from "../../stories/fixtures/adminWorkspace";

export default {
  title: "Admin/Users",
};

const workspace = adminWorkspaceFixture;
const noop = (...args) => console.log("action", ...args);

export function DirectoryDefault() {
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

export function DirectoryEmpty() {
  return (
    <AdminUserDirectory
      users={[]}
      selectedUserId={null}
      query="нет совпадений"
      roleFilter="all"
      statusFilter="all"
      onQueryChange={noop}
      onRoleFilterChange={noop}
      onStatusFilterChange={noop}
      onSelectUser={noop}
    />
  );
}

export function EditorDisabledUser() {
  return <UserEditorForm value={workspace.users[2]} roleOptions={workspace.roleOptions} onChange={noop} onSubmit={noop} onStatusChange={noop} />;
}
