import { useRef } from "react";
import { useEventConcepts } from "../../api/hooks";

const ACCEPT =
  ".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown";

function formatSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

function formatDate(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString("ru-RU", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return null;
  }
}

/**
 * Панель загрузки концепций мероприятия. Видна в режиме edit для каждого
 * program_event. PDF/DOCX/TXT/MD до 10 МБ — извлечённый текст пойдёт в
 * LLM-контекст куратора (записка + чат).
 */
function EventConceptsPanel({ sessionId, eventId, disabled = false }) {
  const inputRef = useRef(null);
  const { data, loading, upload, remove, uploading, removing } = useEventConcepts(
    sessionId,
    eventId,
  );

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    await upload(file);
    if (inputRef.current) inputRef.current.value = "";
  }

  const concepts = data || [];

  return (
    <section className="event-concepts-panel">
      <header className="event-concepts-head">
        <div>
          <p className="eyebrow">Концепция мероприятия</p>
          <p className="subtle">
            PDF, DOCX, TXT или Markdown до 10 МБ. Текст пойдёт в контекст ИИ-куратора.
          </p>
        </div>
        <label className={uploading || disabled ? "ghost-button is-disabled" : "ghost-button"}>
          {uploading ? "Загружаем…" : "+ Файл"}
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            onChange={handleFileChange}
            disabled={uploading || disabled}
            hidden
          />
        </label>
      </header>

      {loading ? <p className="subtle">Загружаем список…</p> : null}

      {!loading && !concepts.length ? (
        <p className="subtle event-concepts-empty">Концепций пока нет.</p>
      ) : null}

      {concepts.length ? (
        <ul className="event-concepts-list">
          {concepts.map((concept) => {
            const limit = 12000;
            const truncated = concept.extractedChars > limit;
            return (
              <li key={concept.id} className="event-concepts-item">
                <div className="event-concepts-item-main">
                  <a
                    href={`/uploads/documents/${concept.storageFilename}`}
                    target="_blank"
                    rel="noreferrer"
                    className="event-concepts-item-name"
                  >
                    {concept.sourceFilename}
                  </a>
                  <p className="subtle event-concepts-item-meta">
                    {formatSize(concept.sizeBytes)} · {concept.extractedChars} симв.
                    {truncated ? " (обрезано)" : ""}
                    {concept.uploadedByName ? ` · ${concept.uploadedByName}` : ""}
                    {formatDate(concept.uploadedAt) ? ` · ${formatDate(concept.uploadedAt)}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  className="ghost-button event-concepts-item-delete"
                  onClick={() => remove(concept.id)}
                  disabled={removing || disabled}
                  aria-label={`Удалить ${concept.sourceFilename}`}
                  title="Удалить"
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}

export default EventConceptsPanel;
