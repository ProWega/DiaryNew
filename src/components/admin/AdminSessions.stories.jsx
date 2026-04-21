import { SessionCatalog, SessionEditorForm } from "./AdminComponents";
import { RegistrationAccessPanel } from "../access/AccessComponents";
import { adminWorkspaceFixture } from "../../stories/fixtures/adminWorkspace";

export default {
  title: "Admin/Sessions",
};

const workspace = adminWorkspaceFixture;
const noop = (...args) => console.log("action", ...args);

export function CatalogAllStatuses() {
  return <SessionCatalog sessions={workspace.sessions} selectedSessionId="session-istoki-school-2026" query="" onQueryChange={noop} onSelectSession={noop} />;
}

export function SessionEditorNew() {
  return <SessionEditorForm value={{ name: "", registrationStatus: "draft" }} mode="create" onChange={noop} onSubmit={noop} />;
}

export function RegistrationClosedFull() {
  return <RegistrationAccessPanel value={workspace.sessions[1]} onChange={noop} onSubmit={noop} />;
}
