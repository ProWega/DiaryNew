import { useEffect, useMemo, useRef, useState } from "react";
import { useCuratorChat, useCuratorChatPresets, useCuratorUsage } from "../../api/hooks";
import FeedbackState from "../../components/FeedbackState";
import UsageBadge from "../../components/curator/UsageBadge";
import ChatContextDrawer from "./chat/ChatContextDrawer";
import ChatContextPresetList from "./chat/ChatContextPresetList";

const MODEL_LABEL = {
  "claude-haiku-4-5": "Haiku",
  "claude-sonnet-4-5": "Sonnet",
  "claude-opus-4-7": "Opus",
  "gpt-5-mini": "GPT-5 mini",
  "gpt-5": "GPT-5",
  "gpt-4o-mini": "GPT-4o mini",
  "gpt-4o": "GPT-4o",
};

function formatTime(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("ru-RU", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/**
 * Вкладка «Разговор с ИИ» в куратор-кабинете. Чат привязан к (curator, group);
 * контекст ответа — все brief'ы группы + концепции мероприятий сессии.
 *
 * Видна только если организатор включил `llmSettings.curatorChatEnabled`.
 */
function ChatPanel({ sessionId, groupId }) {
  const { data, loading, error, send, reset, sending, resetting, refresh } = useCuratorChat(
    sessionId,
    groupId,
  );
  const { data: usage } = useCuratorUsage(sessionId);
  const allowedModels = usage?.settings?.allowedModels || [];
  const defaultModel = usage?.settings?.defaultModel || allowedModels[0] || null;

  const [draft, setDraft] = useState("");
  const [model, setModel] = useState(defaultModel);
  const [filter, setFilter] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activePresetId, setActivePresetId] = useState(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const {
    data: presets,
    createPreset,
    updatePreset,
    deletePreset,
    saving: presetsSaving,
  } = useCuratorChatPresets(sessionId, groupId);

  // Подхватываем default preset на первом рендере, если filter ещё не задан вручную.
  useEffect(() => {
    if (filter !== null) return;
    if (!presets) return;
    const def = presets.find((p) => p.isDefault);
    if (def) {
      setFilter(def.filter);
      setActivePresetId(def.id);
    }
  }, [presets, filter]);

  const filterSummary = useMemo(() => buildFilterSummary(filter), [filter]);

  useEffect(() => {
    if (defaultModel && !model) setModel(defaultModel);
  }, [defaultModel, model]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [data?.messages]);

  if (loading && !data) {
    return (
      <FeedbackState
        title="Загружаем разговор"
        description="Готовим контекст группы и историю чата."
      />
    );
  }

  if (error && error.status === 403) {
    return (
      <FeedbackState
        title="Чат с ИИ выключен"
        description="Организатор не включил функцию «Разговор с ИИ» для этого заезда."
      />
    );
  }

  if (error) {
    return (
      <FeedbackState
        title="Не удалось загрузить разговор"
        description={error?.message || "Похоже, API-слой вернул ошибку."}
        actionLabel="Повторить"
        onAction={refresh}
      />
    );
  }

  const messages = data?.messages || [];
  const showModelSelect = allowedModels.length > 1;

  async function handleSubmit(event) {
    event.preventDefault();
    if (!draft.trim() || sending) return;
    const text = draft;
    setDraft("");
    await send({ text, model: model || undefined, filter: filter || undefined });
    textareaRef.current?.focus();
  }

  function handleKey(event) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      handleSubmit(event);
    }
  }

  return (
    <article className="panel-card curator-chat-panel">
      <header className="panel-head curator-chat-panel-head">
        <div>
          <p className="eyebrow">Разговор с ИИ</p>
          <h3>Вопросы про группу</h3>
          <p className="subtle">
            Спросите про резонанс группы, поведение участников, концепции мероприятий. Ответ
            опирается на загруженные данные сессии.
          </p>
        </div>
        <div className="curator-chat-panel-controls">
          <UsageBadge sessionId={sessionId} compact />
          <button
            type="button"
            className="ghost-button"
            onClick={() => setDrawerOpen(true)}
            title="Что включить в контекст для ИИ"
          >
            ⚙ Контекст: {filterSummary}
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => reset()}
            disabled={resetting || sending}
            title="Начать новый разговор — старый архивируется"
          >
            {resetting ? "Сбрасываем..." : "Начать заново"}
          </button>
        </div>
      </header>

      <ChatContextPresetList
        presets={presets || []}
        activePresetId={activePresetId}
        onApply={(p) => {
          setFilter(p.filter);
          setActivePresetId(p.id);
        }}
        onCreate={createPreset}
        onUpdate={updatePreset}
        onDelete={deletePreset}
        saving={presetsSaving}
        currentFilter={filter}
      />

      <ChatContextDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sessionId={sessionId}
        groupId={groupId}
        filter={filter}
        onApply={(next) => {
          setFilter(next);
          setActivePresetId(null);
        }}
      />

      <div className="curator-chat-messages">
        {messages.length ? (
          messages.map((msg) => (
            <div key={msg.id} className={`curator-chat-bubble is-${msg.role}`} data-role={msg.role}>
              <p className="curator-chat-bubble-text">{msg.content}</p>
              <span className="curator-chat-bubble-meta subtle">
                {formatTime(msg.createdAt)}
                {msg.model ? ` · ${MODEL_LABEL[msg.model] || msg.model}` : ""}
              </span>
            </div>
          ))
        ) : (
          <p className="subtle curator-chat-empty">
            Пока пусто. Например, можно спросить: «Кто из группы сегодня в наибольшем напряжении?»
            или «Какие концепции мероприятий созвучны?».
          </p>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="curator-chat-form" onSubmit={handleSubmit}>
        {showModelSelect ? (
          <select
            className="curator-chat-model-select"
            value={model || ""}
            onChange={(e) => setModel(e.target.value)}
            disabled={sending}
            aria-label="Модель"
          >
            {allowedModels.map((m) => (
              <option key={m} value={m}>
                {MODEL_LABEL[m] || m}
              </option>
            ))}
          </select>
        ) : null}
        <textarea
          ref={textareaRef}
          className="curator-chat-textarea"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Вопрос про группу… (Cmd/Ctrl + Enter — отправить)"
          rows={2}
          disabled={sending}
        />
        <button
          type="submit"
          className="primary-button curator-chat-send"
          disabled={!draft.trim() || sending}
        >
          {sending ? "Отправляем…" : "Отправить"}
        </button>
      </form>
    </article>
  );
}

function buildFilterSummary(filter) {
  if (!filter) return "полный";
  const parts = [];
  if (filter.includeMembers === false) {
    parts.push("без участников");
  } else if ((filter.memberIds || []).length) {
    parts.push(pluralizeRu(filter.memberIds.length, "участник", "участника", "участников"));
  }
  if (filter.includeDays === false) {
    parts.push("без дней");
  } else if ((filter.dayIds || []).length) {
    parts.push(pluralizeRu(filter.dayIds.length, "день", "дня", "дней"));
  }
  if (filter.includeConcepts === false) {
    parts.push("без концепций");
  } else if ((filter.eventIds || []).length) {
    parts.push(pluralizeRu(filter.eventIds.length, "концепция", "концепции", "концепций"));
  }
  return parts.length ? parts.join(", ") : "полный";
}

function pluralizeRu(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} ${one}`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} ${few}`;
  return `${n} ${many}`;
}

export default ChatPanel;
