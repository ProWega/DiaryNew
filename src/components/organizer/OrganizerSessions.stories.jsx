import { SessionCatalog, SessionEditorForm } from "../admin/AdminComponents";
import { organizerWorkspaceFixture } from "../../stories/fixtures/organizerWorkspace";

export default {
  title: "Organizer/Sessions",
};

const noop = (...args) => console.log("action", ...args);

export function MySessions() {
  return (
    <SessionCatalog
      sessions={organizerWorkspaceFixture.sessionCatalog}
      selectedSessionId={organizerWorkspaceFixture.sessionId}
      query=""
      onQueryChange={noop}
      onSelectSession={noop}
    />
  );
}

export function CreateSession() {
  return (
    <SessionEditorForm
      value={{
        name: "",
        description: "",
        startDate: "",
        endDate: "",
        registrationStartsAt: "",
        registrationEndsAt: "",
        registrationCapacity: "",
        registrationStatus: "draft",
      }}
      mode="create"
      preset="organizer"
      onChange={noop}
      onSubmit={noop}
    />
  );
}

export function EditSessionParameters() {
  return (
    <SessionEditorForm
      value={organizerWorkspaceFixture.sessionCatalog[0]}
      preset="organizer"
      onChange={noop}
      onSubmit={noop}
    />
  );
}
