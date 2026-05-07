import ReflectionNoteSection from "./sections/ReflectionNoteSection";
import ParticipantCardSection from "./sections/ParticipantCardSection";
import ProgramScoreSection from "./sections/ProgramScoreSection";

function CuratorBriefView({ brief }) {
  return (
    <div className="curator-brief-layout">
      <ReflectionNoteSection brief={brief} />
      <ParticipantCardSection brief={brief} />
      <ProgramScoreSection brief={brief} />
    </div>
  );
}

export default CuratorBriefView;
