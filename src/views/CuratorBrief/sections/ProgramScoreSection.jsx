function ProgramScoreSection({ brief }) {
  const days = brief?.programArc?.dayBreakdown || [];
  const stages = brief?.stageResonance;

  return (
    <article className="panel-card curator-brief-section curator-brief-score">
      <header className="panel-head">
        <div>
          <p className="eyebrow">Партитура смены</p>
          <h3>Дуга всей программы</h3>
        </div>
        <span className="confidence-tag">{days.length} дней</span>
      </header>

      {days.length ? (
        <ol className="curator-arc-list">
          {days.map((day) => (
            <li
              key={day.dayId}
              className={`curator-arc-day ${day.dayId === brief?.dayId ? "is-current" : ""} ${
                day.dominantState ? `is-${day.dominantState}` : "is-empty"
              }`}
            >
              <header>
                <strong>{day.dayLabel || day.dayId}</strong>
                <small>
                  {day.respondedCount} {day.respondedCount === 1 ? "отозвался" : "отозвались"}
                </small>
              </header>
              <p className="curator-arc-state">{day.dominantStateLabel || "Записей пока нет"}</p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="subtle">Дуга смены прорастает по мере записей — пока что данных нет.</p>
      )}

      {stages ? (
        <p className="curator-arc-resonance subtle">
          Сегодня в группе: Поиск — {stages.search ?? 0}, Проверка — {stages.verification ?? 0},
          Опора — {stages.support ?? 0}, Передача — {stages.transmission ?? 0}, Бережно —{" "}
          {stages.careful ?? 0}.
        </p>
      ) : null}
    </article>
  );
}

export default ProgramScoreSection;
