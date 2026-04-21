import {
  EventEditorCard,
  EventTimeline,
  ParallelEventComposer,
  ProgramDayComposer,
  ProgramMetaEditor,
} from "./OrganizerComponents";
import { organizerWorkspaceFixture } from "../../stories/fixtures/organizerWorkspace";

export default {
  title: "Organizer/Program",
};

const workspace = organizerWorkspaceFixture;
const program = workspace.programWorkspace.programs[0];
const day = program.days[1];
const event = day.events[0];
const noop = (...args) => console.log("action", ...args);

export function ProgramMeta() {
  return <ProgramMetaEditor program={program} onSave={noop} />;
}

export function DayComposer() {
  return <ProgramDayComposer program={program} currentDay={day} onCreate={noop} onUpdate={noop} />;
}

export function EventEditor() {
  return (
    <EventEditorCard
      event={event}
      eventTypes={workspace.programWorkspace.reference.eventTypes}
      speakersCatalog={workspace.programWorkspace.speakersCatalog}
      isActive
      onSave={noop}
      onActivate={noop}
    />
  );
}

export function ParallelComposer() {
  return <ParallelEventComposer day={day} eventTypes={workspace.programWorkspace.reference.eventTypes} speakersCatalog={workspace.programWorkspace.speakersCatalog} onSubmit={noop} />;
}

export function TimelineEmpty() {
  return <EventTimeline events={[]} activeEventId={null} onActivate={noop} />;
}
