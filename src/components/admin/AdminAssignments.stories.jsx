import { GroupAssignmentPanel, RoleAssignmentMatrix } from "./AdminComponents";
import { adminWorkspaceFixture } from "../../stories/fixtures/adminWorkspace";

export default {
  title: "Admin/Assignments",
  component: RoleAssignmentMatrix,
};

const workspace = adminWorkspaceFixture;
const noop = (...args) => console.log("action", ...args);
const value = { userId: "user-organizer-1", sessionId: "session-istoki-school-2026", role: "organizer", groupId: "" };

const assignmentWithAllRoles = [
  ...workspace.assignments,
  {
    id: "a3",
    userId: "user-participant-1",
    userName: "Боря Соколов",
    sessionId: "session-istoki-school-2026",
    sessionName: "Истоки. Школа",
    role: "participant",
    roleLabel: "Участник",
    groupName: "Группа 1",
    status: "active",
  },
  {
    id: "a4",
    userId: "user-admin-1",
    userName: "Системный администратор",
    sessionId: "session-vypusknoy-2026",
    sessionName: "Выпускной",
    role: "admin",
    roleLabel: "Администратор",
    groupName: "",
    status: "disabled",
  },
];

function Template(args) {
  return (
    <RoleAssignmentMatrix
      users={workspace.users}
      sessions={workspace.sessions}
      groups={workspace.groups}
      roleOptions={workspace.roleOptions}
      value={value}
      onChange={noop}
      onFiltersChange={noop}
      onSubmit={noop}
      {...args}
    />
  );
}

export const DefaultStaffOnly = {
  args: {
    assignments: assignmentWithAllRoles,
  },
  render: Template,
};

export const AllRoles = {
  args: {
    assignments: assignmentWithAllRoles,
    filters: { query: "", role: "all", sessionId: "all", status: "all" },
  },
  render: Template,
};

export const FilteredBySession = {
  args: {
    assignments: assignmentWithAllRoles,
    filters: { query: "", role: "staff", sessionId: "session-istoki-school-2026", status: "active" },
  },
  render: Template,
};

export const EmptyAfterFilter = {
  args: {
    assignments: assignmentWithAllRoles,
    filters: { query: "нет такого пользователя", role: "staff", sessionId: "all", status: "active" },
  },
  render: Template,
};

export const SavingState = {
  args: {
    assignments: assignmentWithAllRoles,
    saving: true,
  },
  render: Template,
};

export const DisabledState = {
  args: {
    assignments: assignmentWithAllRoles,
    disabled: true,
  },
  render: Template,
};

export const NoAssignments = {
  args: {
    assignments: [],
    value: { userId: "", sessionId: "", role: "participant", groupId: "" },
  },
  render: Template,
};

export function GroupsPanel() {
  return <GroupAssignmentPanel groups={workspace.groups} />;
}
