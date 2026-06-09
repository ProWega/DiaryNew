/**
 * Полоска сводных метрик группы для куратора. 4-5 значений в виде «soft pill»-карточек.
 */
function MetricsStrip({ metrics }) {
  const total = metrics?.totalMembers ?? 0;
  const active = metrics?.activeToday ?? 0;
  const reflections = metrics?.reflectionsDone ?? 0;
  const pending = metrics?.pendingInvites ?? 0;
  const avg = metrics?.avgActivationToday;

  return (
    <section className="curator-group-metrics">
      <article className="metric-pill">
        <span className="metric-pill-label">Активны сегодня</span>
        <strong className="metric-pill-value">
          {active} / {total}
        </strong>
        <small className="metric-pill-hint">отметили состояние</small>
      </article>
      <article className="metric-pill">
        <span className="metric-pill-label">Рефлексия дня</span>
        <strong className="metric-pill-value">{reflections}</strong>
        <small className="metric-pill-hint">заполнили</small>
      </article>
      <article className="metric-pill">
        <span className="metric-pill-label">Pending invites</span>
        <strong className="metric-pill-value">{pending}</strong>
        <small className="metric-pill-hint">не использованы</small>
      </article>
      <article className="metric-pill">
        <span className="metric-pill-label">Средняя активация</span>
        <strong className="metric-pill-value">{avg != null ? avg.toFixed(1) : "—"}</strong>
        <small className="metric-pill-hint">по 7-балльной шкале</small>
      </article>
    </section>
  );
}

export default MetricsStrip;
