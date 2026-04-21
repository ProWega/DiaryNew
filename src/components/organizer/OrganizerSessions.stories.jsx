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
  return <SessionEditorForm value={{ name: "", cycle: "", registrationStatus: "draft" }} mode="create" onChange={noop} onSubmit={noop} />;
}
