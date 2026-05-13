/**
 * Горизонтальная полоска кнопок по дням сессии. Активная — solid, остальные —
 * outline. Дни без отметок (`hasEntries=false`) показываем приглушённо, но
 * кликабельными — куратор может посмотреть состав группы и события и без
 * накопленной обратной связи.
 */
function DayPickerStrip({ days, selectedDayId, onSelect, loading = false }) {
  if (loading) {
    return <p className="subtle curator-brief-day-picker-loading">Загружаем дни программы…</p>;
  }

  if (!days || !days.length) {
    return null;
  }

  return (
    <nav className="curator-brief-day-picker" aria-label="Выбор дня программы">
      {days.map((day) => {
        const isActive = day.id === selectedDayId;
        const classes = ["curator-brief-day-pill"];
        if (isActive) classes.push("is-active");
        if (!day.hasEntries) classes.push("is-quiet");

        return (
          <button
            key={day.id}
            type="button"
            className={classes.join(" ")}
            aria-pressed={isActive}
            onClick={() => onSelect?.(day.id)}
          >
            <span className="curator-brief-day-pill-number">День {day.dayNumber}</span>
            {day.dateLabel ? (
              <span className="curator-brief-day-pill-date">{day.dateLabel}</span>
            ) : null}
            {day.entriesCount > 0 ? (
              <span
                className="curator-brief-day-pill-count"
                aria-label={`${day.entriesCount} отметок`}
              >
                {day.entriesCount}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}

export default DayPickerStrip;
