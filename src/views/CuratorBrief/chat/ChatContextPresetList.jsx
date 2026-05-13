import { useState } from "react";

/**
 * Горизонтальная полоса pill'ов с preset'ами куратора. Клик по pill'у —
 * применяет filter. Inline-edit/delete на hover. Кнопка «+ создать» открывает
 * формочку с label-input'ом, которая сохраняет текущий filter как preset.
 */
function ChatContextPresetList({
  presets,
  activePresetId,
  onApply,
  onCreate,
  onUpdate,
  onDelete,
  saving,
  currentFilter,
}) {
  const [creating, setCreating] = useState(false);
  const [draftLabel, setDraftLabel] = useState("");
  const [draftDefault, setDraftDefault] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renameLabel, setRenameLabel] = useState("");

  async function handleCreate(event) {
    event.preventDefault();
    const label = draftLabel.trim();
    if (!label) return;
    const result = await onCreate({
      label,
      filter: currentFilter,
      isDefault: draftDefault,
    });
    if (result) {
      setCreating(false);
      setDraftLabel("");
      setDraftDefault(false);
    }
  }

  async function handleRename(preset) {
    const label = renameLabel.trim();
    if (!label) return;
    await onUpdate(preset.id, { label });
    setRenamingId(null);
  }

  return (
    <div className="chat-context-presets">
      <span className="subtle chat-context-presets-label">Шаблоны:</span>
      {(presets || []).length === 0 && !creating ? <span className="subtle">пока нет</span> : null}

      {(presets || []).map((p) => {
        const isActive = activePresetId === p.id;
        const isRenaming = renamingId === p.id;
        return (
          <span key={p.id} className={`chat-context-preset-pill ${isActive ? "is-active" : ""}`}>
            {isRenaming ? (
              <>
                <input
                  className="chat-context-preset-rename-input"
                  value={renameLabel}
                  onChange={(e) => setRenameLabel(e.target.value)}
                  autoFocus
                  maxLength={120}
                />
                <button
                  type="button"
                  className="ghost-button-mini"
                  onClick={() => handleRename(p)}
                  disabled={saving}
                  title="Сохранить"
                >
                  ✓
                </button>
                <button
                  type="button"
                  className="ghost-button-mini"
                  onClick={() => setRenamingId(null)}
                  title="Отмена"
                >
                  ✕
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="chat-context-preset-apply"
                  onClick={() => onApply(p)}
                  title={
                    p.isDefault ? "Применить (по умолчанию)" : "Применить этот шаблон контекста"
                  }
                >
                  {p.isDefault ? "★ " : ""}
                  {p.label}
                </button>
                <button
                  type="button"
                  className="ghost-button-mini"
                  onClick={() => {
                    setRenamingId(p.id);
                    setRenameLabel(p.label);
                  }}
                  title="Переименовать"
                >
                  ✎
                </button>
                <button
                  type="button"
                  className="ghost-button-mini"
                  onClick={() => {
                    if (window.confirm(`Удалить шаблон «${p.label}»?`)) onDelete(p.id);
                  }}
                  disabled={saving}
                  title="Удалить"
                >
                  ×
                </button>
              </>
            )}
          </span>
        );
      })}

      {creating ? (
        <form className="chat-context-preset-create" onSubmit={handleCreate}>
          <input
            value={draftLabel}
            onChange={(e) => setDraftLabel(e.target.value)}
            placeholder="Название (например, «Только сегодня»)"
            autoFocus
            maxLength={120}
          />
          <label className="chat-context-preset-default-checkbox">
            <input
              type="checkbox"
              checked={draftDefault}
              onChange={(e) => setDraftDefault(e.target.checked)}
            />
            <span>По умолчанию</span>
          </label>
          <button type="submit" className="primary-button-small" disabled={saving}>
            Сохранить
          </button>
          <button
            type="button"
            className="ghost-button-mini"
            onClick={() => {
              setCreating(false);
              setDraftLabel("");
              setDraftDefault(false);
            }}
          >
            Отмена
          </button>
        </form>
      ) : (
        <button
          type="button"
          className="ghost-button-mini chat-context-preset-add"
          onClick={() => setCreating(true)}
          title="Сохранить текущий контекст как именованный шаблон"
        >
          + Сохранить как…
        </button>
      )}
    </div>
  );
}

export default ChatContextPresetList;
