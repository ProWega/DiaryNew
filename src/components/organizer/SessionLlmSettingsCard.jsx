import { useEffect, useState } from "react";

const ALL_MODELS = [
  // Anthropic
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5 — быстро и дёшево" },
  { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5 — баланс" },
  { id: "claude-opus-4-7", label: "Claude Opus 4.7 — максимально качественно" },
  // OpenAI
  { id: "gpt-5-mini", label: "GPT-5 mini — быстро и дёшево" },
  { id: "gpt-5", label: "GPT-5 — баланс качества и цены" },
  { id: "gpt-4o-mini", label: "GPT-4o mini — лёгкая legacy-модель" },
  { id: "gpt-4o", label: "GPT-4o — стабильная legacy-модель" },
];

function asNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Карточка настроек LLM для куратора: модель по умолчанию, набор разрешённых
 * моделей, лимит токенов на вызов, дневной бюджет, тумблер чата и лимит
 * концепций. Локальный state «грязный»/«сохранено», submit вызывает
 * `onSubmit({llm: patch})` — родитель отправляет PATCH /settings.
 */
function SessionLlmSettingsCard({ llmSettings, saving = false, onSubmit }) {
  const [draft, setDraft] = useState(() => normalize(llmSettings));

  useEffect(() => {
    setDraft(normalize(llmSettings));
  }, [llmSettings]);

  function toggleAllowedModel(modelId) {
    setDraft((prev) => {
      const has = prev.allowedModels.includes(modelId);
      const next = has
        ? prev.allowedModels.filter((m) => m !== modelId)
        : [...prev.allowedModels, modelId];
      // Не даём отключить ВСЁ — минимум один model должен остаться.
      if (!next.length) return prev;
      // Если выкинули defaultModel — переключаем на первый из next.
      const defaultModel = next.includes(prev.defaultModel) ? prev.defaultModel : next[0];
      return { ...prev, allowedModels: next, defaultModel };
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    await onSubmit?.({ llm: draft });
  }

  return (
    <article className="panel-card session-llm-settings-card">
      <header className="panel-head">
        <div>
          <p className="eyebrow">ИИ-помощник куратора</p>
          <h3>Модели, лимиты и чат</h3>
          <p className="subtle">
            Управляйте тем, какими моделями куратор может перегенерировать записку и сколько токенов
            может расходовать за день.
          </p>
        </div>
      </header>

      <form className="session-llm-settings-form" onSubmit={handleSubmit}>
        <fieldset className="session-llm-settings-group">
          <legend>Разрешённые модели</legend>
          <div className="session-llm-settings-checklist">
            {ALL_MODELS.map((m) => (
              <label key={m.id} className="session-llm-settings-check">
                <input
                  type="checkbox"
                  checked={draft.allowedModels.includes(m.id)}
                  onChange={() => toggleAllowedModel(m.id)}
                  disabled={saving}
                />
                <span>{m.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="session-llm-settings-row">
          <span>Модель по умолчанию</span>
          <select
            value={draft.defaultModel}
            onChange={(e) => setDraft({ ...draft, defaultModel: e.target.value })}
            disabled={saving}
          >
            {draft.allowedModels.map((m) => (
              <option key={m} value={m}>
                {ALL_MODELS.find((x) => x.id === m)?.label || m}
              </option>
            ))}
          </select>
        </label>

        <label className="session-llm-settings-row">
          <span>Макс. токенов на один вызов</span>
          <input
            type="number"
            min={64}
            max={8000}
            step={50}
            value={draft.maxTokensPerCall}
            onChange={(e) =>
              setDraft({
                ...draft,
                maxTokensPerCall: asNumber(e.target.value, draft.maxTokensPerCall),
              })
            }
            disabled={saving}
          />
        </label>

        <label className="session-llm-settings-row">
          <span>
            Дневной лимит токенов на куратора
            <small className="subtle"> (0 — без ограничений)</small>
          </span>
          <input
            type="number"
            min={0}
            step={1000}
            value={draft.curatorDailyTokenBudget}
            onChange={(e) =>
              setDraft({
                ...draft,
                curatorDailyTokenBudget: asNumber(e.target.value, draft.curatorDailyTokenBudget),
              })
            }
            disabled={saving}
          />
        </label>

        <label className="session-llm-settings-row">
          <span>Лимит символов извлечения из концепций (PDF/DOCX)</span>
          <input
            type="number"
            min={1000}
            max={50000}
            step={500}
            value={draft.conceptExtractionLimit}
            onChange={(e) =>
              setDraft({
                ...draft,
                conceptExtractionLimit: asNumber(e.target.value, draft.conceptExtractionLimit),
              })
            }
            disabled={saving}
          />
        </label>

        <label className="session-llm-settings-toggle">
          <input
            type="checkbox"
            checked={draft.curatorChatEnabled}
            onChange={(e) => setDraft({ ...draft, curatorChatEnabled: e.target.checked })}
            disabled={saving}
          />
          <span>Включить чат «Разговор с ИИ» для куратора</span>
        </label>

        <div className="session-llm-settings-actions">
          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? "Сохраняем..." : "Сохранить настройки ИИ"}
          </button>
        </div>
      </form>
    </article>
  );
}

function normalize(input) {
  return {
    defaultModel: input?.defaultModel || "claude-haiku-4-5",
    allowedModels:
      Array.isArray(input?.allowedModels) && input.allowedModels.length
        ? input.allowedModels
        : ["claude-haiku-4-5"],
    maxTokensPerCall: asNumber(input?.maxTokensPerCall, 500),
    curatorDailyTokenBudget: asNumber(input?.curatorDailyTokenBudget, 0),
    curatorChatEnabled: Boolean(input?.curatorChatEnabled),
    conceptExtractionLimit: asNumber(input?.conceptExtractionLimit, 12000),
  };
}

export default SessionLlmSettingsCard;
