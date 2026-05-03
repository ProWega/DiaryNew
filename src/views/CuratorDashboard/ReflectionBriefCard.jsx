import {
  asArray,
  getStatusCopy,
  getSeverityClass,
  getConfidenceLabel,
  formatCuratorText,
} from "./_helpers";
import { formatPercent } from "../../lib/format";

export function FactList({ title, eyebrow, items = [], emptyLabel, renderItem }) {
  return (
    <article className="panel-card curator-fact-card">
      <div className="panel-head">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h3>{title}</h3>
        </div>
      </div>

      {items.length ? (
        <div className="curator-fact-list">{items.map(renderItem)}</div>
      ) : (
        <p className="curator-empty-copy">{emptyLabel}</p>
      )}
    </article>
  );
}

export function ConfidencePill({ confidence }) {
  return (
    <span className={`curator-confidence-pill is-${confidence || "medium"}`}>
      {getConfidenceLabel(confidence)}
    </span>
  );
}

export function ReflectionBriefCard({ brief }) {
  const coverage = brief.coverage || {};
  const talkingPoints = asArray(brief.talkingPoints);
  const participantsToCheckIn = asArray(brief.participantsToCheckIn);
  const blindSpots = asArray(brief.blindSpots);

  return (
    <article className="panel-card curator-reflection-card">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Бриф к рефлексии</p>
          <h3>Что вынести в вечерний круг</h3>
        </div>
        <ConfidencePill confidence={coverage.confidence} />
      </div>

      <div className="curator-coverage-strip">
        <strong>{formatPercent(coverage.completion)}</strong>
        <span>{coverage.summary}</span>
      </div>

      <div className="curator-reflection-columns">
        <section className="curator-reflection-block">
          <h4>Темы для разговора</h4>
          {talkingPoints.length ? (
            <div className="curator-fact-list">
              {talkingPoints.map((point) => (
                <div
                  key={point.id}
                  className={`curator-fact-item ${getSeverityClass(point.severity)}`}
                >
                  <div className="curator-fact-title-row">
                    <strong>{point.title}</strong>
                    <ConfidencePill confidence={point.confidence} />
                  </div>
                  <p>{point.prompt}</p>
                  {asArray(point.evidence).length ? (
                    <span>{asArray(point.evidence).map(formatCuratorText).join("; ")}</span>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="curator-empty-copy">Пока нет подтвержденных тем для выноса в круг.</p>
          )}
        </section>

        <section className="curator-reflection-block">
          <h4>Кого бережно проверить</h4>
          {participantsToCheckIn.length ? (
            <div className="curator-fact-list">
              {participantsToCheckIn.map((participant) => {
                const status = getStatusCopy(participant.status);
                return (
                  <div key={participant.id} className="curator-fact-item">
                    <div className="curator-fact-title-row">
                      <strong>{participant.name}</strong>
                      <span className={`status-pill ${status.className}`}>{status.label}</span>
                    </div>
                    <p>{asArray(participant.evidence).map(formatCuratorText).join("; ")}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="curator-empty-copy">
              Нет участников с подтвержденными сигналами для отдельной проверки.
            </p>
          )}
        </section>
      </div>

      {blindSpots.length ? (
        <div className="curator-blind-spots">
          <h4>Где не перегревать выводы</h4>
          {blindSpots.map((spot) => (
            <div key={spot.id} className="curator-blind-spot">
              <strong>{spot.title}</strong>
              <p>{spot.detail}</p>
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}
