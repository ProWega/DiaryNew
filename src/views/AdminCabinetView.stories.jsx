import AdminCabinetView from "./AdminCabinetView";
import { adminWorkspaceFixture, emptyAdminWorkspaceFixture } from "../stories/fixtures/adminWorkspace";

export default {
  title: "Admin/Page",
  component: AdminCabinetView,
  args: {
    workspace: adminWorkspaceFixture,
    initialTab: "users",
    saving: false,
  },
};

const actions = {
  onCreateUser: async (payload) => console.log("create user", payload),
  onUpdateUser: async (id, payload) => console.log("update user", id, payload),
  onUpdateUserStatus: async (id, status) => console.log("status", id, status),
  onUpsertAssignment: async (id, payload) => console.log("assignment", id, payload),
  onCreateSession: async (payload) => console.log("create session", payload),
  onUpdateSession: async (id, payload) => console.log("update session", id, payload),
  onUpdateRegistration: async (id, payload) => console.log("registration", id, payload),
  onCreateMagicLink: async (payload) => {
    console.log("magic link", payload);
    return { url: "https://example.test/magic?token=story-token", expiresAt: "2026-04-22T12:00:00.000Z" };
  },
};

const longTextWorkspace = {
  ...adminWorkspaceFixture,
  users: adminWorkspaceFixture.users.map((user, index) =>
    index === 1
      ? {
          ...user,
          fullName: "Алексей Волков, главный организатор образовательной программы и координатор региональных площадок",
          email: "very.long.organizer.address.for.testing@example.test",
        }
      : user,
  ),
  assignments: adminWorkspaceFixture.assignments.map((assignment, index) =>
    index === 0
      ? {
          ...assignment,
          userName: "Алексей Волков, главный организатор образовательной программы",
          sessionName: "Истоки. Школа с расширенной программой практикумов и параллельных мастер-классов",
        }
      : assignment,
  ),
};

export const DefaultSection = {
  render: (args) => <AdminCabinetView {...args} {...actions} />,
};

export const SessionsSection = {
  args: {
    initialTab: "sessions",
  },
  render: (args) => <AdminCabinetView {...args} {...actions} />,
};

export const AssignmentsSection = {
  args: {
    initialTab: "assignments",
  },
  render: (args) => <AdminCabinetView {...args} {...actions} />,
};

export const AuditSection = {
  args: {
    initialTab: "audit",
  },
  render: (args) => <AdminCabinetView {...args} {...actions} />,
};

export const MobileLayout = {
  args: {
    initialTab: "assignments",
  },
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
  render: (args) => <AdminCabinetView {...args} {...actions} />,
};

export const LongLabels = {
  args: {
    workspace: longTextWorkspace,
    initialTab: "assignments",
  },
  render: (args) => <AdminCabinetView {...args} {...actions} />,
};

export const SavingState = {
  args: {
    initialTab: "sessions",
    saving: true,
  },
  render: (args) => <AdminCabinetView {...args} {...actions} />,
};

export const EmptyWorkspace = {
  args: {
    workspace: emptyAdminWorkspaceFixture,
  },
  render: (args) => <AdminCabinetView {...args} {...actions} />,
};
