import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useProgramImport } from "../../api/hooks";

const ACCEPT =
  ".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel";

// Должен синхронизоваться с server/services/programExcelImporter.cjs.
// Если разойдётся — UI просто покажет старый дефолтный список; критичные
// стоп-слова всё равно применяются на бэке.
const DEFAULT_STOP_WORDS = [
  "завтрак",
  "обед",
  "ужин",
  "полдник",
  "перерыв",
  "перекус",
  "перекур",
  "кофе-брейк",
  "трансфер",
  "заезд",
  "заселение",
  "регистрация",
  "отбой",
  "подъём",
  "выезд",
  "приезд",
  "технический",
  "ланч",
  "пересадка",
  "зарядка",
  "итоги дня",
  "подготовка ко сну",
  "установка на день",
  "трапеза",
  "трапезная",
  "столовая",
];

const EVENT_TYPES = [
  "Лекция",
  "Мастер-класс",
  "Панельная дискуссия",
  "Торжественное мероприятие",
  "Экскурсия",
  "Групповая работа",
  "Рефлексия",
  "Поддержка",
  "Логистика",
];

function buildInitialDraftSnapshot(rawDraft) {
  // Снимаем droppedByStopWord в массив — отдельная секция «отфильтровано» в UI.
  return {
    title: rawDraft.title || "",
    description: rawDraft.description || "",
    days: (rawDraft.days || []).map((day) => ({
      label: day.label || "",
      dateLabel: day.dateLabel || "",
      dateValue: day.dateValue || "",
      events: (day.events || []).map((event) => ({
        ...event,
        included: !event.droppedByStopWord, // включаем только то, что не отфильтровано
      })),
    })),
  };
}

function formatTime(t) {
  return t || "—";
}

// Fallback-список моделей, если у сессии не настроен allowedModels
// (например, новая сессия без явных LLM-настроек).
const FALLBACK_MODELS = [
  "claude-haiku-4-5",
  "claude-sonnet-4-5",
  "claude-opus-4-5",
  "gpt-5-mini",
  "gpt-5",
  "gpt-4o-mini",
  "gpt-4o",
];

function ProgramImportModal({
  sessionId,
  existingProgram = null,
  llmSettings = null,
  open,
  onClose,
}) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState("heuristic");
  const allowedModels =
    Array.isArray(llmSettings?.allowedModels) && llmSettings.allowedModels.length
      ? llmSettings.allowedModels
      : FALLBACK_MODELS;
  const [model, setModel] = useState(llmSettings?.defaultModel || allowedModels[0] || "");
  const [stopWordsText, setStopWordsText] = useState(DEFAULT_STOP_WORDS.join(", "));
  const [draft, setDraft] = useState(null);
  const [fileName, setFileName] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [stats, setStats] = useState(null);
  const [conflictResolution, setConflictResolution] = useState("replace_draft");
  const [errorMessage, setErrorMessage] = useState(null);
  // Список листов-кандидатов из xlsx и выбранный пользователем в preview.
  const [availableSheets, setAvailableSheets] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState(null);

  const { previewImport, commitImport, previewing, committing } = useProgramImport(sessionId);

  const stopWords = useMemo(
    () =>
      stopWordsText
        .split(/[,\n]/)
        .map((w) => w.trim())
        .filter(Boolean),
    [stopWordsText],
  );

  if (!open) return null;

  async function handleAnalyze(forcedSheetName) {
    setErrorMessage(null);
    if (!file) {
      setErrorMessage("Сначала выберите файл .xlsx");
      return;
    }
    if (mode === "llm" && !model.trim()) {
      setErrorMessage("Выберите модель для режима «ИИ»");
      return;
    }
    try {
      const result = await previewImport({
        file,
        options: {
          mode,
          model: model.trim() || undefined,
          stopWords,
          sheetName: forcedSheetName || selectedSheet || undefined,
        },
      });
      if (!result) return;
      const newDraft = result.draft || {};
      setDraft(buildInitialDraftSnapshot(newDraft));
      setStats(newDraft.stats || null);
      setWarnings(newDraft.warnings || []);
      setFileName(result.fileName || file.name);
      setAvailableSheets(newDraft.availableSheets || []);
      setSelectedSheet(newDraft.selectedSheet || null);
    } catch (error) {
      setErrorMessage(error?.message || "Не удалось разобрать файл");
    }
  }

  function handleSheetChange(nextSheetName) {
    setSelectedSheet(nextSheetName);
    // Сразу пере-анализируем с новым листом, чтобы юзер увидел разницу.
    void handleAnalyze(nextSheetName);
  }

  function toggleEventIncluded(dayIndex, eventIndex) {
    setDraft((prev) => {
      if (!prev) return prev;
      const days = prev.days.map((day, i) =>
        i === dayIndex
          ? {
              ...day,
              events: day.events.map((evt, j) =>
                j === eventIndex ? { ...evt, included: !evt.included } : evt,
              ),
            }
          : day,
      );
      return { ...prev, days };
    });
  }

  function updateEventField(dayIndex, eventIndex, field, value) {
    setDraft((prev) => {
      if (!prev) return prev;
      const days = prev.days.map((day, i) =>
        i === dayIndex
          ? {
              ...day,
              events: day.events.map((evt, j) =>
                j === eventIndex ? { ...evt, [field]: value } : evt,
              ),
            }
          : day,
      );
      return { ...prev, days };
    });
  }

  function updateDayField(dayIndex, field, value) {
    setDraft((prev) => {
      if (!prev) return prev;
      const days = prev.days.map((day, i) => (i === dayIndex ? { ...day, [field]: value } : day));
      return { ...prev, days };
    });
  }

  async function handleCommit() {
    if (!draft) return;
    setErrorMessage(null);
    // Преобразуем UI-черновик обратно в формат backend-а.
    const commitDraft = {
      title: draft.title || `Программа (импорт из ${fileName || "Excel"})`,
      description: draft.description || "",
      days: draft.days.map((day) => ({
        label: day.label,
        dateLabel: day.dateLabel,
        dateValue: day.dateValue,
        events: day.events
          .filter((evt) => evt.included)
          .map((evt) => ({
            title: evt.title,
            start: evt.start,
            end: evt.end,
            type: evt.type,
            speakerName: evt.speakerName || "",
            location: evt.location || "",
            description: evt.description || "",
            parallelGroup: evt.parallelGroup || "A",
            tags: evt.tags || [],
            // droppedByStopWord обнуляем — мы уже выбрали что включить.
            droppedByStopWord: null,
          })),
      })),
    };
    try {
      await commitImport({
        draft: commitDraft,
        fileName,
        mode,
        model: mode === "llm" ? model : undefined,
        conflictResolution,
      });
      onClose();
    } catch (error) {
      setErrorMessage(error?.message || "Не удалось сохранить программу");
    }
  }

  function reset() {
    setFile(null);
    setDraft(null);
    setFileName(null);
    setWarnings([]);
    setStats(null);
    setErrorMessage(null);
    setAvailableSheets([]);
    setSelectedSheet(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const existingIsPublished = existingProgram?.status === "published";
  const totalEvents = draft ? draft.days.reduce((sum, day) => sum + day.events.length, 0) : 0;
  const includedEvents = draft
    ? draft.days.reduce((sum, day) => sum + day.events.filter((e) => e.included).length, 0)
    : 0;

  const modalContent = (
    <div
      className="program-import-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="program-import-modal" role="dialog" aria-label="Импорт программы из Excel">
        <header className="program-import-modal-head">
          <div>
            <p className="eyebrow">Импорт программы</p>
            <h3>Загрузить расписание из Excel</h3>
          </div>
          <button type="button" className="ghost-button" onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </header>

        <div className="program-import-modal-body">
          {!draft ? (
            // ШАГ 1: выбор файла + режима
            <div className="program-import-setup">
              <label className="program-import-field">
                <span>Файл .xlsx</span>
                <input
                  ref={inputRef}
                  type="file"
                  accept={ACCEPT}
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                {file ? <small className="subtle">{file.name}</small> : null}
              </label>

              <fieldset className="program-import-mode">
                <legend>Режим разбора</legend>
                <label>
                  <input
                    type="radio"
                    name="mode"
                    value="heuristic"
                    checked={mode === "heuristic"}
                    onChange={() => setMode("heuristic")}
                  />
                  <span>Локальный (быстро, бесплатно)</span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="mode"
                    value="llm"
                    checked={mode === "llm"}
                    onChange={() => setMode("llm")}
                  />
                  <span>ИИ (укажите модель)</span>
                </label>
                {mode === "llm" ? (
                  <select value={model} onChange={(e) => setModel(e.target.value)}>
                    {allowedModels.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                ) : null}
              </fieldset>

              <label className="program-import-field">
                <span>
                  Стоп-слова (через запятую — события с этими словами исключаются как «технические»)
                </span>
                <textarea
                  value={stopWordsText}
                  onChange={(e) => setStopWordsText(e.target.value)}
                  rows={3}
                />
              </label>

              {errorMessage ? <p className="alert-card severity-high">{errorMessage}</p> : null}

              <div className="program-import-actions">
                <button type="button" className="ghost-button" onClick={onClose}>
                  Отмена
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleAnalyze}
                  disabled={!file || previewing}
                >
                  {previewing ? "Анализируем…" : "Анализировать"}
                </button>
              </div>
            </div>
          ) : (
            // ШАГ 2: preview черновика
            <div className="program-import-preview">
              <div className="program-import-stats">
                <strong>
                  {draft.days.length} {pluralizeRu(draft.days.length, "день", "дня", "дней")} ·{" "}
                  {includedEvents} из {totalEvents}{" "}
                  {pluralizeRu(totalEvents, "события", "событий", "событий")} включено
                </strong>
                {stats?.filteredCount ? (
                  <span className="subtle">
                    {" "}
                    · {stats.filteredCount} отфильтровано как технические
                  </span>
                ) : null}
                {fileName ? <span className="subtle"> · {fileName}</span> : null}
              </div>

              {availableSheets.length > 1 ? (
                <label className="program-import-sheet-picker">
                  <span>Лист с расписанием:</span>
                  <select
                    value={selectedSheet || ""}
                    onChange={(e) => handleSheetChange(e.target.value)}
                    disabled={previewing}
                  >
                    {availableSheets.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                  {previewing ? <small className="subtle">Пере-анализируем…</small> : null}
                </label>
              ) : null}

              {warnings.length ? (
                <div className="program-import-warnings">
                  {warnings.map((w, idx) => (
                    <p key={idx} className="alert-card severity-medium">
                      ⚠ {w.message}
                    </p>
                  ))}
                </div>
              ) : null}

              {draft.days.map((day, dayIndex) => (
                <details key={dayIndex} className="program-import-day" open={dayIndex === 0}>
                  <summary>
                    <strong>{day.label || `День ${dayIndex + 1}`}</strong>
                    <span className="subtle">
                      {day.dateLabel ? ` · ${day.dateLabel}` : ""} ·{" "}
                      {day.events.filter((e) => e.included).length} из {day.events.length} событий
                    </span>
                  </summary>

                  <div className="program-import-day-fields">
                    <label>
                      <span>Метка дня</span>
                      <input
                        type="text"
                        value={day.label}
                        onChange={(e) => updateDayField(dayIndex, "label", e.target.value)}
                      />
                    </label>
                    <label>
                      <span>Дата (текст)</span>
                      <input
                        type="text"
                        value={day.dateLabel}
                        onChange={(e) => updateDayField(dayIndex, "dateLabel", e.target.value)}
                      />
                    </label>
                    <label>
                      <span>Дата (ISO YYYY-MM-DD)</span>
                      <input
                        type="text"
                        value={day.dateValue}
                        onChange={(e) => updateDayField(dayIndex, "dateValue", e.target.value)}
                        placeholder="2026-06-10"
                      />
                    </label>
                  </div>

                  <ul className="program-import-events">
                    {day.events.map((event, eventIndex) => (
                      <li
                        key={eventIndex}
                        className={`program-import-event ${event.included ? "" : "is-excluded"}`}
                      >
                        <label className="program-import-event-checkbox">
                          <input
                            type="checkbox"
                            checked={event.included}
                            onChange={() => toggleEventIncluded(dayIndex, eventIndex)}
                          />
                          <span className="subtle">
                            {formatTime(event.start)}–{formatTime(event.end)}
                          </span>
                          {event.droppedByStopWord ? (
                            <span
                              className="soft-pill is-outline"
                              title={`Стоп-слово: ${event.droppedByStopWord}`}
                            >
                              отфильтровано
                            </span>
                          ) : null}
                          {event.confidence === "low" ? (
                            <span
                              className="soft-pill is-outline"
                              title="Тип определён предположительно"
                            >
                              низкая уверенность
                            </span>
                          ) : null}
                        </label>
                        <div className="program-import-event-fields">
                          <input
                            type="text"
                            className="program-import-event-title"
                            value={event.title}
                            onChange={(e) =>
                              updateEventField(dayIndex, eventIndex, "title", e.target.value)
                            }
                            disabled={!event.included}
                            placeholder="Название мероприятия"
                          />
                          <select
                            value={event.type}
                            onChange={(e) =>
                              updateEventField(dayIndex, eventIndex, "type", e.target.value)
                            }
                            disabled={!event.included}
                          >
                            {EVENT_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            className="program-import-event-time"
                            value={event.start}
                            onChange={(e) =>
                              updateEventField(dayIndex, eventIndex, "start", e.target.value)
                            }
                            disabled={!event.included}
                            placeholder="09:00"
                          />
                          <input
                            type="text"
                            className="program-import-event-time"
                            value={event.end}
                            onChange={(e) =>
                              updateEventField(dayIndex, eventIndex, "end", e.target.value)
                            }
                            disabled={!event.included}
                            placeholder="10:30"
                          />
                          <input
                            type="text"
                            className="program-import-event-speaker"
                            value={event.speakerName}
                            onChange={(e) =>
                              updateEventField(dayIndex, eventIndex, "speakerName", e.target.value)
                            }
                            disabled={!event.included}
                            placeholder="Спикер"
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </details>
              ))}

              {existingProgram ? (
                <fieldset className="program-import-conflict">
                  <legend>У сессии уже есть программа ({existingProgram.status})</legend>
                  <label>
                    <input
                      type="radio"
                      name="conflict"
                      value="replace_draft"
                      checked={conflictResolution === "replace_draft"}
                      disabled={existingIsPublished}
                      onChange={() => setConflictResolution("replace_draft")}
                    />
                    <span>
                      Заменить существующую программу{" "}
                      {existingIsPublished ? "(недоступно — опубликована)" : ""}
                    </span>
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="conflict"
                      value="create_new"
                      checked={conflictResolution === "create_new"}
                      onChange={() => setConflictResolution("create_new")}
                    />
                    <span>
                      Создать новую программу как draft{" "}
                      <small className="subtle">
                        (текущая останется в БД, но workspace покажет новую)
                      </small>
                    </span>
                  </label>
                </fieldset>
              ) : null}

              {errorMessage ? <p className="alert-card severity-high">{errorMessage}</p> : null}

              <div className="program-import-actions">
                <button type="button" className="ghost-button" onClick={reset}>
                  Назад (выбрать другой файл)
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleCommit}
                  disabled={committing || includedEvents === 0}
                >
                  {committing ? "Сохраняем…" : `Принять черновик (${includedEvents} событий)`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Рендерим через Portal в document.body — иначе sticky-топбар с z-index 100
  // оказывается над модалкой из-за изолированных stacking contexts.
  return typeof document !== "undefined" ? createPortal(modalContent, document.body) : modalContent;
}

function pluralizeRu(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export default ProgramImportModal;
