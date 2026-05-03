import Tabs from "../ui/Tabs";
import { safeArray } from "./_helpers";

export function ProgramDayTabs({
  days = [],
  currentDayId,
  disabled = false,
  compact = false,
  emptyTitle = "Дней пока нет",
  emptyDescription = "Добавьте день программы, чтобы собрать сетку мероприятий.",
  getDayLabel,
  onChange,
}) {
  const safeDays = safeArray(days);
  if (!safeDays.length) {
    return (
      <div
        className={
          compact
            ? "feedback-card program-empty-note is-compact"
            : "feedback-card program-empty-note"
        }
      >
        <h2>{emptyTitle}</h2>
        <p>{emptyDescription}</p>
      </div>
    );
  }

  return (
    <Tabs
      items={safeDays.map((day) => ({
        id: day.id,
        label: getDayLabel
          ? getDayLabel(day)
          : [day.label, day.dateLabel].filter(Boolean).join(" · "),
      }))}
      activeId={currentDayId}
      disabled={disabled}
      onChange={onChange}
      ariaLabel={compact ? "Дни" : "Дни программы"}
    />
  );
}
