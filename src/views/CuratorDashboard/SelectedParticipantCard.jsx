import MetricBadge from "../../components/MetricBadge";
import { getStatusCopy, formatAverageState } from "./_helpers";
import { formatNumber, formatPercent } from "../../lib/format";

export function SelectedParticipantCard({ participant, onClear }) {
  if (!participant) {
    return (
      <div className="curator-selected-participant is-empty">
        Нажмите на точку на карте, чтобы увидеть имя участника и краткие метрики.
      </div>
    );
  }

  const status = getStatusCopy(participant.status);

  return (
    <article className="curator-selected-participant">
      <div>
        <span className={`status-pill ${status.className}`}>{status.label}</span>
        <h3>{participant.name}</h3>
      </div>
      <div className="curator-selected-metrics">
        <MetricBadge label="Среднее" value={formatAverageState(participant.average)} />
        <MetricBadge label="Амплитуда" value={formatNumber(participant.amplitude)} />
        <MetricBadge label="Заполнение" value={formatPercent(participant.completion)} />
        <MetricBadge label="Риски" value={`${participant.openRiskSignalsCount || 0}`} />
      </div>
      <p>
        Комментариев: {participant.commentsCount || 0}; событий заполнено:{" "}
        {participant.answeredEvents || 0}/{participant.totalEvents || 0}.
      </p>
      <button type="button" className="ghost-button curator-clear-selection" onClick={onClear}>
        Снять выбор
      </button>
    </article>
  );
}
