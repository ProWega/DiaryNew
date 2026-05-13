import { useState, useEffect } from "react";
import { STATE_LABEL_META } from "../../../data/methodology";
import { useRegenerateCuratorBrief, useCuratorUsage } from "../../../api/hooks";
import UsageBadge from "../../../components/curator/UsageBadge";

const REASON_LABEL = {
  careful_mode: "Бережно",
  shift_down: "Резкая смена",
  silence_streak: "Тишина подряд",
};

function formatCachedAt(iso) {
  if (!iso) return null;
  try {
    const date = new Date(iso);
    return date.toLocaleString("ru-RU", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return null;
  }
}

const MODEL_LABEL = {
  "claude-haiku-4-5": "Haiku",
  "claude-sonnet-4-5": "Sonnet",
  "claude-opus-4-7": "Opus",
  "gpt-5-mini": "GPT-5 mini",
  "gpt-5": "GPT-5",
  "gpt-4o-mini": "GPT-4o mini",
  "gpt-4o": "GPT-4o",
};

function ReflectionNoteSection({ brief, sessionId, groupId }) {
  const dayId = brief?.dayId || null;
  const { regenerate, saving } = useRegenerateCuratorBrief(sessionId, groupId);
  const { data: usage } = useCuratorUsage(sessionId);
  const allowedModels = usage?.settings?.allowedModels || [];
  const defaultModel = usage?.settings?.defaultModel || allowedModels[0] || null;

  const [selectedModel, setSelectedModel] = useState(defaultModel);
  useEffect(() => {
    if (defaultModel && !selectedModel) setSelectedModel(defaultModel);
  }, [defaultModel, selectedModel]);

  if (!brief) return null;
  const { picture, stageResonance, conversationPoints, events, dayLabel, narrative } = brief;
  const dominant = picture?.dominantState ? STATE_LABEL_META[picture.dominantState] : null;
  const hasNarrativeText = Boolean(narrative?.text);
  const isFromCache = narrative?.source === "db-cache";
  const cachedAtLabel = isFromCache ? formatCachedAt(narrative?.cachedAt) : null;

  const canRegenerate = Boolean(sessionId && groupId && dayId);
  const showModelSelect = allowedModels.length > 1;

  return (
    <article className="panel-card curator-brief-section curator-brief-note">
      <header className="panel-head">
        <div>
          <p className="eyebrow">Записка к вечерней рефлексии</p>
          <h3>{dayLabel || "Сегодня"}</h3>
          {cachedAtLabel ? (
            <p className="curator-brief-note-meta subtle">из кеша от {cachedAtLabel}</p>
          ) : null}
        </div>
        <div className="curator-brief-note-controls">
          <span className="confidence-tag">
            {picture?.respondedToday ?? 0} из {picture?.totalParticipants ?? 0} отозвались
          </span>
          <UsageBadge sessionId={sessionId} compact />
          {canRegenerate ? (
            <div className="curator-brief-regen-group">
              {showModelSelect ? (
                <select
                  className="curator-brief-model-select"
                  value={selectedModel || ""}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  disabled={saving}
                  aria-label="Модель для генерации"
                >
                  {allowedModels.map((m) => (
                    <option key={m} value={m}>
                      {MODEL_LABEL[m] || m}
                    </option>
                  ))}
                </select>
              ) : null}
              <button
                type="button"
                className="ghost-button curator-brief-regen"
                onClick={() => regenerate({ dayId, model: selectedModel || undefined })}
                disabled={saving}
                title="Сгенерировать записку заново — обходит кеш"
              >
                {saving ? "Генерируем..." : "Перегенерировать"}
              </button>
            </div>
          ) : null}
        </div>
      </header>

      {hasNarrativeText ? <p className="curator-brief-narrative">{narrative.text}</p> : null}

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
