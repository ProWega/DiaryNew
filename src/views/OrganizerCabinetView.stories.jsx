import OrganizerCabinetView from "./OrganizerCabinetView";
import {
  emptyOrganizerWorkspaceFixture,
  organizerWorkspaceFixture,
} from "../stories/fixtures/organizerWorkspace";

export default {
  title: "Organizer/Page",
};

const actions = {
  onCreateProgram: async (payload) => {
    console.log("createProgram", payload);
    return organizerWorkspaceFixture;
  },
  onUpdateProgram: async (...args) => console.log("updateProgram", args),
  onSelectProgram: async (programId) => {
    console.log("selectProgram", programId);
    return organizerWorkspaceFixture;
  },
  onUpdateEvent: async (...args) => console.log("updateEvent", args),
  onAddParallelEvent: async (...args) => console.log("addParallelEvent", args),
  onActivateEvent: async (...args) => console.log("activateEvent", args),
  onCreateSession: async (...args) => {
    console.log("createSession", args);
    return organizerWorkspaceFixture.sessionCatalog?.[0] || { id: "session-new" };
  },
  onUpdateSession: async (...args) => console.log("updateSession", args),
  onUpdateRegistration: async (...args) => console.log("updateRegistration", args),
  onCreateProgramDay: async (...args) => console.log("createProgramDay", args),
  onUpdateProgramDay: async (...args) => console.log("updateProgramDay", args),
  onSessionCreated: (...args) => console.log("sessionCreated", args),
};

export function SessionsTab() {
  return <OrganizerCabinetView workspace={organizerWorkspaceFixture} initialTab="sessions" {...actions} />;
}

export function ProgramTab() {
  return <OrganizerCabinetView workspace={organizerWorkspaceFixture} initialTab="program" {...actions} />;
}

export function RegistrationTab() {
  return <OrganizerCabinetView workspace={organizerWorkspaceFixture} initialTab="registration" {...actions} />;
}

export function GroupsTab() {
  return <OrganizerCabinetView workspace={organizerWorkspaceFixture} initialTab="groups" {...actions} />;
}

export function ParticipantsTab() {
  return <OrganizerCabinetView workspace={organizerWorkspaceFixture} initialTab="participants" {...actions} />;
}

export function SavingState() {
  return <OrganizerCabinetView workspace={organizerWorkspaceFixture} saving initialTab="program" {...actions} />;
}

export function MutationError() {
  return (
    <OrganizerCabinetView
      workspace={organizerWorkspaceFixture}
      mutationError={new Error("PostgreSQL временно недоступен")}
      initialTab="program"
      {...actions}
    />
  );
}

export function EmptyWorkspace() {
  return <OrganizerCabinetView workspace={emptyOrganizerWorkspaceFixture} initialTab="program" {...actions} />;
}
