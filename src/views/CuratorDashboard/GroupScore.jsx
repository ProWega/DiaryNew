import { asArray, getStateByLevel, getEventShortLabel, getStatusCopy } from "./_helpers";
import { formatPercent } from "../../lib/format";

export function GroupScore({ participants = [], events = [] }) {
  const safeParticipants = asArray(participants);
  const safeEvents = asArray(events);

  if (!safeEvents.length) {
    return <div className="curator-chart-empty">Нет событий для партитуры группы.</div>;
  }

  if (!safeParticipants.length) {
    return <div className="curator-chart-empty">Нет участников для партитуры группы.</div>;
  }

  return (
    <div className="curator-score-wrap">
      <div
        className="curator-score-grid"
        style={{
          gridTemplateColumns: `minmax(190px, 1.15fr) repeat(${safeEvents.length}, minmax(122px, 1fr)) minmax(116px, 0.7fr)`,
          minWidth: `${Math.max(760, 330 + safeEvents.length * 130)}px`,
        }}
      >
        <div className="curator-score-head">Участник</div>
        {safeEvents.map((event) => (
          <div
            key={event.id}
            className="curator-score-head curator-score-event-head"
            title={`${event.title}${event.timeLabel ? ` · ${event.timeLabel}` : ""}`}
          >
            <span className="curator-score-event-title">{getEventShortLabel(event)}</span>
            {event.timeLabel ? <small>{event.timeLabel}</small> : null}
          </div>
        ))}
        <div className="curator-score-head">Заполнено</div>

        {safeParticipants.map((participant) => {
          const status = getStatusCopy(participant.status);

          return (
            <div key={participant.id} className="curator-score-row">
              <div className="curator-score-person">
                <strong>{participant.name}</strong>
                <span className={`status-pill ${status.className}`}>{status.label}</span>
              </div>

              {safeEvents.map((event) => {
                const point = participant.trajectory?.find((item) => item.eventId === event.id);
                const state = getStateByLevel(point?.stateLevel);

                if (!state) {
                  return (
                    <div
                      key={event.id}
                      className="curator-score-cell is-empty"
                      title={`${event.title}: нет ответа`}
                    >
                      <span>—</span>
                    </div>
                  );
                }

                return (
                  <div
                    key={event.id}
                    className="curator-score-cell"
                    style={{
                      background: state.surface,
                      borderColor: state.color,
                      color: state.textColor,
                    }}
                    title={`${event.title}: ${state.label}${point?.comment ? ` — ${point.comment}` : ""}`}
                  >
                    <strong>{state.shortLabel || state.label}</strong>
                  </div>
                );
              })}

              <div className="curator-score-progress">
                <strong>{formatPercent(participant.completion)}</strong>
                <span>
                  {participant.answeredEvents}/{participant.totalEvents}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
