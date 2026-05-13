import DayPickerStrip from "./sections/DayPickerStrip";
import ReflectionNoteSection from "./sections/ReflectionNoteSection";
import ParticipantCardSection from "./sections/ParticipantCardSection";
import ProgramScoreSection from "./sections/ProgramScoreSection";

function CuratorBriefView({
  brief,
  sessionId,
  groupId,
  availableDays = [],
  selectedDayId = null,
  daysLoading = false,
  onDaySelect,
}) {
  // `brief.dayId` — это id фактически отрисованного дня (backend выбирает
  // последний если selectedDayId == null). Используем его как fallback,
  // чтобы при первом рендере активная кнопка соответствовала контенту.
  const activeDayId = selectedDayId || brief?.dayId || null;

  return (
    <div className="curator-brief-layout">
      <DayPickerStrip
        days={availableDays}
        selectedDayId={activeDayId}
        onSelect={onDaySelect}
        loading={daysLoading}
      />
      <ReflectionNoteSection brief={brief} sessionId={sessionId} groupId={groupId} />
      <ParticipantCardSection brief={brief} />
      <ProgramScoreSection brief={brief} />
    </div>
  );
}

export default CuratorBriefView;
