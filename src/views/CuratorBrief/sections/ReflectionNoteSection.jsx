import { STATE_LABEL_META } from "../../../data/methodology";

const REASON_LABEL = {
  careful_mode: "Бережно",
  shift_down: "Резкая смена",
  silence_streak: "Тишина подряд",
};

function ReflectionNoteSection({ brief }) {
  if (!brief) return null;
  const { picture, stageResonance, conversationPoints, events, dayLabel, narrative } = brief;
  const dominant = picture?.dominantState ? STATE_LABEL_META[picture.dominantState] : null;
  const hasLlmNarrative = narrative?.source === "llm" && narrative?.text;

  return (
    <article className="panel-card curator-brief-section curator-brief-note">
      <header className="panel-head">
        <div>
          <p className="eyebrow">Записка к вечерней рефлексии</p>
          <h3>{dayLabel || "Сегодня"}</h3>
        </div>
        <span className="confidence-tag">
          {picture?.respondedToday ?? 0} из {picture?.totalParticipants ?? 0} отозвались
        </span>
      </header>

      {hasLlmNarrative ? <p className="curator-brief-narrative">{narrative.text}</p> : null}

      <div className="curator-brief-picture">
        {dominant ? (
          <p className="curator-brief-picture-line">
            Сегодня в группе чаще всего слышался <strong>{dominant.ru}</strong>:{" "}
            <span className="subtle">{dominant.description}</span>
          </p>
        ) : (
          <p className="subtle">Сегодня записей пока мало — картина дня прояснится позже.</p>
        )}
        {picture?.carefulCount ? (
          <p className="curator-brief-picture-line is-careful">
            {picture.carefulCount}{" "}
            {picture.carefulCount === 1 ? "участник просит" : "участника(ов) просят"} бережно —
            стоит подойти деликатно.
          </p>
        ) : null}
      </div>

      <section className="curator-brief-stages">
        <h4>Резонанс по этапам пути</h4>
        <ul className="curator-brief-stage-list">
          <li>
            <span>Поиск</span>
            <strong>{stageResonance?.search ?? 0}</strong>
          </li>
          <li>
            <span>Проверка</span>
            <strong>{stageResonance?.verification ?? 0}</strong>
          </li>
          <li>
            <span>Опора</span>
            <strong>{stageResonance?.support ?? 0}</strong>
          </li>
          <li>
            <span>Передача</span>
            <strong>{stageResonance?.transmission ?? 0}</strong>
          </li>
          <li className="is-careful">
            <span>Бережно</span>
            <strong>{stageResonance?.careful ?? 0}</strong>
          </li>
        </ul>
      </section>

      {conversationPoints?.length ? (
        <section className="curator-brief-points">
          <h4>Точки для разговора</h4>
          <ul className="curator-brief-point-list">
            {conversationPoints.map((point) => (
              <li key={`${point.participantId}-${point.reason}`} className="curator-brief-point">
                <span className={`curator-brief-point-tag is-${point.reason}`}>
                  {REASON_LABEL[point.reason] || "Подойти"}
                </span>
                <div>
                  <strong>{point.displayName}</strong>
                  <p>{point.note}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {events?.length ? (
        <section className="curator-brief-events">
          <h4>События дня</h4>
          <ul className="curator-brief-event-list">
            {events.map((event) => (
              <li key={event.id} className="curator-brief-event">
                <div className="curator-brief-event-head">
                  <strong>{event.title}</strong>
                  <small>{event.responseCount} отметок</small>
                </div>
                {event.quotes?.length ? (
                  <ul className="curator-brief-quotes">
                    {event.quotes.map((quote, index) => (
                      <li key={index}>
                        <span aria-hidden="true">«</span>
                        {quote}
                        <span aria-hidden="true">»</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}

export default ReflectionNoteSection;
