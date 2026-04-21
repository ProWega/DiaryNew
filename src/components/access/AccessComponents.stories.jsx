import {
  AccessToggle,
  CapacityMeter,
  RegistrationAccessPanel,
  RegistrationGateCard,
  RegistrationStatusBadge,
} from "./AccessComponents";
import { adminWorkspaceFixture } from "../../stories/fixtures/adminWorkspace";

export default {
  title: "Organizer/Registration",
};

const openSession = adminWorkspaceFixture.sessions[0];
const fullSession = adminWorkspaceFixture.sessions[1];
const draftSession = adminWorkspaceFixture.sessions[2];
const noop = (...args) => console.log("action", ...args);

export function Statuses() {
  return (
    <div className="pill-grid" style={{ padding: 24 }}>
      <RegistrationStatusBadge status="draft" />
      <RegistrationStatusBadge status="open" />
      <RegistrationStatusBadge status="closed" />
      <RegistrationStatusBadge status="archived" />
    </div>
  );
}

export function CapacityStates() {
  return (
    <div style={{ display: "grid", gap: 20, padding: 24 }}>
      <CapacityMeter capacity={56} used={24} />
      <CapacityMeter capacity={120} used={120} />
      <CapacityMeter capacity={null} used={7} />
    </div>
  );
}

export function GateCards() {
  return (
    <div style={{ display: "grid", gap: 16, padding: 24 }}>
      <RegistrationGateCard session={openSession} selected onSelect={noop} />
      <RegistrationGateCard session={fullSession} onSelect={noop} />
      <RegistrationGateCard session={draftSession} onSelect={noop} />
    </div>
  );
}

export function AccessPanelOpen() {
  return <RegistrationAccessPanel value={openSession} onChange={noop} onSubmit={noop} />;
}

export function AccessPanelDisabled() {
  return <RegistrationAccessPanel value={fullSession} mode="view" disabled onChange={noop} onSubmit={noop} />;
}

export function Toggle() {
  return <AccessToggle checked onChange={noop} />;
}
