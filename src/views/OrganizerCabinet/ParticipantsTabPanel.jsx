import { ParticipantDetailsCard, ParticipantSearchPanel } from "../../components/organizer/index";

function ParticipantsTabPanel({
  groups,
  participantList,
  selectedGroupId,
  participantQuery,
  selectedParticipant,
  saving,
  onGroupChange,
  onQueryChange,
  onSelectParticipant,
  onAssignGroup,
}) {
  return (
    <div className="organizer-focus-grid">
      <ParticipantSearchPanel
        groups={groups}
        participants={participantList}
        selectedGroupId={selectedGroupId}
        query={participantQuery}
        selectedParticipantId={selectedParticipant?.id}
        onGroupChange={onGroupChange}
        onQueryChange={onQueryChange}
        onSelectParticipant={onSelectParticipant}
      />
      <ParticipantDetailsCard
        participant={selectedParticipant}
        groups={groups}
        saving={saving}
        onAssignGroup={onAssignGroup}
      />
    </div>
  );
}

export default ParticipantsTabPanel;
