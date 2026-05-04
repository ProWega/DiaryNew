function formatChronicleDate(iso) {
  try {
    return new Date(iso).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function pluralizeParticipants(count) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} участник`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} участника`;
  return `${count} участников`;
}

function ChronicleTimeline({ entries }) {
  if (!entries.length) {
    return <div className="istoki-empty">Архив пока пуст.</div>;
  }

  return (
    <div className="istoki-chronicle">
      {entries.map((entry) => (
        <article key={entry.id} className="istoki-chronicle-entry">
          <div className="istoki-chronicle-date">{formatChronicleDate(entry.eventDate)}</div>
          <h3 className="istoki-chronicle-title">{entry.eventTitle}</h3>
          <span className="istoki-chronicle-badge">
            {pluralizeParticipants(entry.participantsCount)}
          </span>
          <ul className="istoki-chronicle-insights">
            {entry.keyInsights.map((insight, idx) => (
              <li key={idx}>{insight}</li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}

export default ChronicleTimeline;
