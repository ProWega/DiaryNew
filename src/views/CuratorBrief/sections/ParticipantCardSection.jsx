import { useEffect, useState } from "react";

const REASON_LABEL = {
  careful_mode: "Бережно",
  shift_down: "Резкая смена",
  silence_streak: "Тишина подряд",
};

function ParticipantSummary({ card }) {
  if (!card) return null;
  const stageBits = [card.journeyStageLabel, card.isCarefulMode ? "бережно" : null].filter(Boolean);

  return (
    <div className="curator-card-summary">
      <header>
        <strong>{card.displayName}</strong>
        {stageBits.length ? <span className="subtle">{stageBits.join(" · ")}</span> : null}
      </header>

      <dl className="curator-card-states">
        <div>
          <dt>Сегодня</dt>
          <dd>{card.today?.ru || "—"}</dd>
        </div>
        <div>
          <dt>Вчера</dt>
          <dd>{card.yesterday?.ru || "—"}</dd>
        </div>
      </dl>

      {card.conversationHint ? (
        <div className={`curator-card-hint is-${card.conversationHint.reason}`}>
          <span className="curator-brief-point-tag">
            {REASON_LABEL[card.conversationHint.reason] || "Подойти"}
          </span>
          <p>{card.conversationHint.note}</p>
        </div>
      ) : (
        <p className="subtle">
          Ничего срочного — можно просто побыть рядом, без специального повода.
        </p>
      )}
    </div>
  );
}

function ParticipantCardSection({ brief }) {
  const cards = brief?.participantCards || [];
  const [selectedUserId, setSelectedUserId] = useState(() => cards[0]?.userId || "");

  useEffect(() => {
    if (!cards.length) {
      setSelectedUserId("");
      return;
    }
    if (!cards.some((card) => card.userId === selectedUserId)) {
      setSelectedUserId(cards[0].userId);
    }
  }, [cards, selectedUserId]);

  const selected = cards.find((card) => card.userId === selectedUserId) || null;

  return (
    <article className="panel-card curator-brief-section curator-brief-card">
      <header className="panel-head">
        <div>
          <p className="eyebrow">Карточка участника</p>
          <h3>Для личного разговора</h3>
        </div>
        <span className="confidence-tag">{cards.length} карточек</span>
      </header>

      {cards.length ? (
        <>
          <div className="curator-card-grid" role="tablist" aria-label="Выбор участника">
            {cards.map((card) => {
              const isActive = card.userId === selectedUserId;
              return (
                <button
                  key={card.userId}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`curator-card-pill ${isActive ? "is-active" : ""} ${
                    card.isCarefulMode ? "is-careful" : ""
                  } ${card.conversationHint ? "has-hint" : ""}`}
                  onClick={() => setSelectedUserId(card.userId)}
                >
                  <strong>{card.displayName}</strong>
                  <small>{card.journeyStageLabel || "—"}</small>
                </button>
              );
            })}
          </div>
          <ParticipantSummary card={selected} />
        </>
      ) : (
        <p className="subtle">
          В группе пока нет активных участников — карточки появятся, когда люди подключатся.
        </p>
      )}
    </article>
  );
}

export default ParticipantCardSection;
