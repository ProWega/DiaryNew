import { useEffect, useState } from "react";

const STATUS_LABEL = {
  available: "Можно дополнить",
  responded: "Дополнено",
  future: "Ещё не время",
};

function formatDate(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function ReturnPointEditor({ point, onSubmit, submitting }) {
  const [content, setContent] = useState(point.response?.content || "");
  const [isAnonymous, setIsAnonymous] = useState(point.response?.isAnonymous || false);
  const [isHiddenFromCurator, setIsHiddenFromCurator] = useState(
    point.response?.isHiddenFromCurator || false,
  );

  useEffect(() => {
    setContent(point.response?.content || "");
    setIsAnonymous(point.response?.isAnonymous || false);
    setIsHiddenFromCurator(point.response?.isHiddenFromCurator || false);
  }, [point.response?.content, point.response?.isAnonymous, point.response?.isHiddenFromCurator]);

  const canSubmit = content.trim().length > 0 && !submitting;

  function handleSubmit(event) {
    event.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      sessionId: point.sessionId,
      touchpointIndex: point.touchpointIndex,
      content: content.trim(),
      isAnonymous,
      isHiddenFromCurator,
    });
  }

  return (
    <form className="return-point-editor" onSubmit={handleSubmit}>
      <label className="return-point-text">
        <span className="visually-hidden">Текст записи</span>
        <textarea
          rows="4"
          value={content}
          placeholder="Что вспомнилось, что подвинулось…"
          onChange={(event) => setContent(event.target.value)}
        />
      </label>
      <div className="return-point-toggles">
        <label>
          <input
            type="checkbox"
            checked={isAnonymous}
            onChange={(event) => setIsAnonymous(event.target.checked)}
          />
          <span>Анонимно для куратора</span>
        </label>
        <label>
          <input
            type="checkbox"
            checked={isHiddenFromCurator}
            onChange={(event) => setIsHiddenFromCurator(event.target.checked)}
          />
          <span>Скрыть от куратора целиком</span>
        </label>
      </div>
      <div className="return-point-actions">
        <button type="submit" className="primary-button" disabled={!canSubmit}>
          {point.response ? "Обновить запись" : "Сохранить"}
        </button>
      </div>
    </form>
  );
}

function ReturnPointCard({ point, onSubmit, submitting }) {
  return (
    <article className={`return-point-card is-${point.status}`}>
      <header className="return-point-head">
        <p className="eyebrow">{point.sessionLabel}</p>
        <h3>{point.invitation}</h3>
        <p className="subtle">
          Через {point.weeksAfter}{" "}
          {point.weeksAfter === 1 ? "неделю" : point.weeksAfter < 5 ? "недели" : "недель"} после
          смены — {formatDate(point.scheduledFor)}.
        </p>
        <span className={`return-point-tag is-${point.status}`}>{STATUS_LABEL[point.status]}</span>
      </header>

      {point.status === "future" ? (
        <p className="subtle">
          Сейчас рано — приглашение откроется ближе к дате выше. Можно дополнить запись и до этого
          дня, если что-то само вспомнилось.
        </p>
      ) : (
        <ReturnPointEditor point={point} onSubmit={onSubmit} submitting={submitting} />
      )}

      {point.status === "responded" && point.response?.updatedAt ? (
        <p className="subtle return-point-saved-at">
          Сохранено {formatDate(point.response.updatedAt)}.
        </p>
      ) : null}
    </article>
  );
}

function ReturnPointsView({ data, onSubmit, submitting, hasActiveSession = false }) {
  const points = data?.points || [];

  if (!points.length) {
    return (
      <section className="role-view return-points-view">
        <header className="return-points-head">
          <p className="eyebrow">Жизнь после смены</p>
          <h2>Точки возврата</h2>
          <p className="subtle">
            {hasActiveSession
              ? "Сейчас вы в смене. Когда она закончится, здесь появятся мягкие приглашения дополнить запись — через неделю, месяц, три месяца, полгода и год. Это не задание: пишите, когда само вспомнится."
              : "Когда смена закончится, здесь появятся приглашения дополнить запись — через неделю, месяц, три месяца, полгода и год. Это мягкие напоминания, не задание: пишите, когда само вспомнится."}
          </p>
        </header>
      </section>
    );
  }

  return (
    <section className="role-view return-points-view">
      <header className="return-points-head">
        <p className="eyebrow">Жизнь после смены</p>
        <h2>Точки возврата</h2>
        <p className="subtle">
          Это не задание. Когда что-то вспомнится само — допишите. Прошлые записи можно поправить.
        </p>
      </header>
      <div className="return-points-list">
        {points.map((point) => (
          <ReturnPointCard
            key={`${point.sessionId}-${point.touchpointIndex}`}
            point={point}
            onSubmit={onSubmit}
            submitting={submitting}
          />
        ))}
      </div>
    </section>
  );
}

export default ReturnPointsView;
