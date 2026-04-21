import {
  EventEditorCard,
  EventTimeline,
  GroupsSummary,
  ParallelEventComposer,
  ParticipantDetailsCard,
  ParticipantSearchPanel,
  ProgramDayComposer,
  ProgramCreateCard,
  ProgramMetaEditor,
  ProgramSelector,
} from "./OrganizerComponents";
import { organizerWorkspaceFixture } from "../../stories/fixtures/organizerWorkspace";

export default {
  title: "Organizer/Components",
};

const workspace = organizerWorkspaceFixture;
const program = workspace.programWorkspace.programs[0];
const day = program.days[1];
const event = day.events[0];
const eventTypes = workspace.programWorkspace.reference.eventTypes;
const speakersCatalog = workspace.programWorkspace.speakersCatalog;
const noopAsync = async (payload) => {
  console.log("submit", payload);
  return workspace;
};

export function ProgramSelectorMultiple() {
  return (
    <ProgramSelector
      programs={workspace.programWorkspace.programs}
      currentProgram={program}
      currentDay={day}
      activeEventId={workspace.programWorkspace.activeEventId}
      onSelectProgram={(id) => console.log("program", id)}
      onSelectDay={(id) => console.log("day", id)}
      onActivateEvent={(programId, dayId, eventId) => console.log("activate", programId, dayId, eventId)}
    />
  );
}

export function ProgramSelectorEmpty() {
  return (
    <ProgramSelector
      programs={[]}
      currentProgram={null}
      currentDay={null}
      activeEventId={null}
      onSelectProgram={() => {}}
      onSelectDay={() => {}}
      onActivateEvent={() => {}}
    />
  );
}

export function ProgramMetaEditorFilled() {
  return <ProgramMetaEditor program={program} onSave={noopAsync} />;
}

export function ProgramMetaEditorSaving() {
  return <ProgramMetaEditor program={program} saving onSave={noopAsync} />;
}

export function ProgramCreate() {
  return <ProgramCreateCard onCreate={noopAsync} />;
}

export function ProgramDayComposerDefault() {
  return (
    <ProgramDayComposer
      program={program}
      currentDay={day}
      onCreate={noopAsync}
      onUpdate={(dayId, payload) => noopAsync({ dayId, ...payload })}
    />
  );
}

export function EventEditorWithSpeaker() {
  return (
    <EventEditorCard
      event={event}
      eventTypes={eventTypes}
      speakersCatalog={speakersCatalog}
      isActive
      onSave={noopAsync}
      onActivate={() => console.log("activate")}
    />
  );
}

export function EventEditorWithoutSpeaker() {
  return (
    <EventEditorCard
      event={{ ...event, speakerId: "", speakerName: "", status: "planned" }}
      eventTypes={eventTypes}
      speakersCatalog={speakersCatalog}
      onSave={noopAsync}
      onActivate={() => console.log("activate")}
    />
  );
}

export function ParallelComposer() {
  return <ParallelEventComposer day={day} eventTypes={eventTypes} speakersCatalog={speakersCatalog} onSubmit={noopAsync} />;
}

export function Timeline() {
  return (
    <EventTimeline
      events={day.events}
      activeEventId={workspace.programWorkspace.activeEventId}
      onActivate={(eventId) => console.log("activate", eventId)}
    />
  );
}

export function GroupsSummaryDefault() {
  return (
    <GroupsSummary
      groups={workspace.groupsSummary.groups}
      alerts={workspace.groupsSummary.alerts}
      audiencePool={workspace.audiencePool}
    />
  );
}

export function GroupsSummaryNoRisks() {
  return (
    <GroupsSummary
      groups={workspace.groupsSummary.groups.map((group) => ({ ...group, riskCases: 0, completion: 98 }))}
      alerts={[]}
      audiencePool={workspace.audiencePool}
    />
  );
}

export function ParticipantSearch() {
  return (
    <ParticipantSearchPanel
      groups={workspace.groupsSummary.groups}
      participants={workspace.audiencePool}
      selectedGroupId="all"
      query=""
      selectedParticipantId={workspace.audiencePool[0].id}
      onGroupChange={(id) => console.log("group", id)}
      onQueryChange={(query) => console.log("query", query)}
      onSelectParticipant={(id) => console.log("participant", id)}
    />
  );
}

export function ParticipantSearchEmpty() {
  return (
    <ParticipantSearchPanel
      groups={workspace.groupsSummary.groups}
      participants={[]}
      selectedGroupId="group-3"
      query="нет совпадений"
      selectedParticipantId={null}
      onGroupChange={() => {}}
      onQueryChange={() => {}}
      onSelectParticipant={() => {}}
    />
  );
}

export function ParticipantDetailsFull() {
  return <ParticipantDetailsCard participant={workspace.audiencePool[1]} />;
}

export function ParticipantDetailsEmpty() {
  return <ParticipantDetailsCard participant={null} />;
}
