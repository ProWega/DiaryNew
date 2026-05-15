/**
 * Картка выбора параллельного блока. Появляется когда в одном временном слоте
 * у участника несколько вариантов мероприятий, и он ещё не выбрал.
 *
 * Mobile-first:
 *   - Все опции в вертикальном столбике, без горизонтального скролла.
 *   - Тач-области ≥44px.
 *   - Минимум визуального шума — карточка-обёртка как у обычного события,
 *     внутри список альтернатив с большими кнопками «Выбрать».
 */
function ParallelSlotPicker({ slot, position, onSelect, saving }) {
  const timeLabel = formatSlotTime(slot);
  return (
    <article className="participant-event-shell participant-parallel-slot is-pending">
      <header className="participant-parallel-slot-head">
        <span className="participant-event-index">{position}</span>
        <div className="participant-parallel-slot-titles">
          <strong>Параллельные блоки</strong>
          <small>Выберите один — без выбора шкала и заметка недоступны.</small>
          {timeLabel ? <span className="event-time">{timeLabel}</span> : null}
        </div>
      </header>

      <ul className="participant-parallel-options">
        {slot.events.map((event) => (
          <li key={event.id} className="participant-parallel-option">
            <div className="participant-parallel-option-text">
              <strong>{event.title}</strong>
              <small>
                {event.type || ""}
                {event.parallelGroup ? ` · поток ${event.parallelGroup}` : ""}
              </small>
            </div>
            <button
              type="button"
              className="primary-button participant-parallel-select"
              disabled={saving}
              onClick={() => onSelect(event)}
            >
              Выбрать
            </button>
          </li>
        ))}
      </ul>
    </article>
  );
}

/**
 * Маленький футер «↔ Сменить блок» внутри выбранной карточки параллельного слота.
 * При раскрытии — список альтернатив с кнопкой «Перейти сюда» и предупреждением.
 */
function ParallelSlotSwitcher({ slot, currentEventId, onSelect, saving }) {
  const alternatives = slot.events.filter((e) => e.id !== currentEventId);
  if (!alternatives.length) return null;
  return (
    <details className="participant-parallel-switcher">
      <summary>↔ Сменить блок (есть {alternatives.length})</summary>
      <p className="confidence-note participant-parallel-switcher-warn">
        Если уже писали комментарий — он сохранится в архиве у куратора, но активным станет новый
        блок.
      </p>
      <ul className="participant-parallel-switcher-list">
        {alternatives.map((event) => (
          <li key={event.id}>
            <div>
              <strong>{event.title}</strong>
              <small>
                {event.type || ""}
                {event.parallelGroup ? ` · поток ${event.parallelGroup}` : ""}
              </small>
            </div>
            <button
              type="button"
              className="ghost-button"
              disabled={saving}
              onClick={() => onSelect(event)}
            >
              Перейти сюда
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}

function formatSlotTime(slot) {
  if (!slot) return "";
  const start = slot.startTime || slot.key || "";
  const end = slot.endTime || "";
  if (start && end) return `${start} – ${end}`;
  return start || "";
}

export default ParallelSlotPicker;
export { ParallelSlotSwitcher };
