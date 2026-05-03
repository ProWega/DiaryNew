import { normalizeScheduleEvent, safeArray } from "./_helpers";

export function EventTimeline({ events = [], activeEventId, onActivate }) {
  const safeEvents = safeArray(events).map((event, index) => normalizeScheduleEvent(event, index));

  if (!safeEvents.length) {
    return (
      <div className="feedback-card">
        <h2>В этот день нет мероприятий</h2>
        <p>Добавьте мероприятие или параллельный слот в программу дня.</p>
      </div>
    );
  }

  return (
    <div className="timeline-list">
      {safeEvents.map((event) => (
        <button
          key={event.id}
          type="button"
          className={activeEventId === event.id ? "timeline-item is-active" : "timeline-item"}
          onClick={() => onActivate?.(event.id)}
        >
          <strong>{event.title}</strong>
          <span>
            {event.type} · {event.start} - {event.end}
          </span>
          <span>
            {event.speakerName || "Без спикера"} · поток {event.parallelGroup}
          </span>
        </button>
      ))}
    </div>
  );
}
