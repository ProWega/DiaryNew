import { useEffect, useMemo, useRef, useState } from "react";
import MetricBadge from "../MetricBadge";
import {
  EventImpactBarChart,
  MultiLineTrendChart,
  RiskScatterChart,
  StackedDistributionChart,
  chartPalette,
} from "../Charts";
import Field from "../ui/Field";
import Tabs from "../ui/Tabs";
import { AlertCard, SoftPill, StatusPill } from "../ui/Pills";
import {
  getEventStatusLabel,
  getEventStatusTone,
  getProgramStatusLabel,
  getProgramStatusTone,
  getSeverityTone,
  normalizeList,
} from "../../lib/organizerWorkspace";
import {
  createProgramDayDraft as createAutoProgramDayDraft,
  formatProgramDayDateLabel,
  isCustomProgramDayDateLabel,
} from "../../lib/programDays";
import { stateScale } from "../../data/mockData";

export function createProgramDraft() {
  return {
    title: "",
    description: "",
    status: "draft",
    eventContext: {
      title: "",
      eventType: "Форумное событие",
      venue: "",
      startDate: "",
      endDate: "",
      participantCount: "",
      description: "",
    },
  };
}

export function createParallelEventDraft(day, speakerOptions = [], eventTypes = []) {
  const referenceEvent = day?.events?.[0];

  return {
    title: "",
    start: referenceEvent?.start || "16:00",
    end: referenceEvent?.end || "17:00",
    type: referenceEvent?.type || eventTypes[0] || "Лекция",
    speakerId: referenceEvent?.speakerId || speakerOptions[0]?.id || "",
    location: "",
    track: "Параллельный поток",
    parallelGroup: "P2",
    status: "planned",
    tags: "",
    description: "",
  };
}

export function createProgramDayDraft(program) {
  return createAutoProgramDayDraft(program);
}

function createProgramDayFormModel(dayDraft = {}) {
  const dateValue = dayDraft?.dateValue || "";
  const isAutoDateLabel = !isCustomProgramDayDateLabel(dateValue, dayDraft?.dateLabel || "");

  return {
    isAutoDateLabel,
    form: {
      label: dayDraft?.label || "День",
      dateLabel: isAutoDateLabel ? formatProgramDayDateLabel(dateValue) : dayDraft?.dateLabel || "",
      dateValue,
    },
  };
}

function applyProgramDayDateValue(form, nextDateValue, isAutoDateLabel) {
  return {
    ...form,
    dateValue: nextDateValue,
    dateLabel: isAutoDateLabel ? formatProgramDayDateLabel(nextDateValue) : form.dateLabel,
  };
}

const DEFAULT_EVENT_STATUS_OPTIONS = [
  { value: "planned", label: "Запланировано" },
  { value: "active", label: "Текущее" },
  { value: "completed", label: "Завершено" },
];

const EMPTY_PROGRAM = { eventContext: {}, days: [] };
const EMPTY_EVENT = {};

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function createReflectionQuestionDraft() {
  const suffix =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().slice(0, 8)
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  return {
    id: `reflection-question-${suffix}`,
    text: "",
    required: false,
  };
}

function normalizeReflectionQuestions(value = []) {
  return safeArray(value)
    .map((question) => ({
      id: String(question?.id || createReflectionQuestionDraft().id).trim(),
      text: String(question?.text || question?.title || "").trimStart(),
      required: Boolean(question?.required),
    }))
    .filter((question) => question.id);
}

function normalizeScheduleEvent(event, fallbackIndex = 0, fallbackPrefix = "event") {
  const rawEvent = safeObject(event);
  return {
    ...rawEvent,
    id: rawEvent.id || `${fallbackPrefix}-${fallbackIndex}`,
    title: rawEvent.title || "Без названия",
    start: rawEvent.start || "09:00",
    end: rawEvent.end || "10:00",
    type: rawEvent.type || "",
    speakerId: rawEvent.speakerId || "",
    speakerName: rawEvent.speakerName || "",
    location: rawEvent.location || "",
    track: rawEvent.track || "",
    parallelGroup: rawEvent.parallelGroup || "A",
    status: rawEvent.status || "planned",
    tags: normalizeList(rawEvent.tags),
    description: rawEvent.description || "",
    reflectionQuestions: normalizeReflectionQuestions(rawEvent.reflectionQuestions),
  };
}

function normalizeComponentProgram(program, fallbackIndex = 0) {
  const rawProgram = safeObject(program);
  const eventContext = safeObject(rawProgram.eventContext);
  return {
    ...rawProgram,
    id: rawProgram.id || `program-${fallbackIndex}`,
    title: rawProgram.title || "Без названия",
    description: rawProgram.description || "",
    status: rawProgram.status || "draft",
    eventContext: {
      ...eventContext,
      title: eventContext.title || rawProgram.title || "Событие",
      eventType: eventContext.eventType || "Событие",
      venue: eventContext.venue || "",
    },
    days: safeArray(rawProgram.days),
  };
}

function normalizeStatusOptions(statusOptions = DEFAULT_EVENT_STATUS_OPTIONS) {
  return safeArray(statusOptions).map((option) =>
    typeof option === "string" ? { value: option, label: getEventStatusLabel(option) } : option,
  );
}

function parseTimeToMinutes(value) {
  if (typeof value !== "string") {
    return null;
  }

  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return hours * 60 + minutes;
}

function formatMinutesAsTime(value) {
  const safeValue = Math.max(0, Math.min(24 * 60, Number(value) || 0));
  const hours = Math.floor(safeValue / 60);
  const minutes = safeValue % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function floorToStep(value, step) {
  return Math.floor(value / step) * step;
}

function ceilToStep(value, step) {
  return Math.ceil(value / step) * step;
}

function getEventStartMinutes(event) {
  return parseTimeToMinutes(event?.start) ?? 9 * 60;
}

function getEventEndMinutes(event, defaultDurationMinutes = 60) {
  const start = getEventStartMinutes(event);
  const end = parseTimeToMinutes(event?.end);
  return end !== null && end > start ? end : start + defaultDurationMinutes;
}

function normalizeColumnDefinition(column, fallbackIndex = 0) {
  if (typeof column === "string") {
    return {
      id: column || `P${fallbackIndex + 1}`,
      label: column || `P${fallbackIndex + 1}`,
      track: "",
    };
  }

  const id = column?.id || column?.value || column?.parallelGroup || `P${fallbackIndex + 1}`;
  return {
    id,
    label: column?.label || column?.title || id,
    track: column?.track || "",
  };
}

function normalizeColumnOrder(value = []) {
  return Array.from(
    new Set(
      safeArray(value)
        .map((item) =>
          typeof item === "string" ? item : item?.id || item?.value || item?.parallelGroup || "",
        )
        .map((item) => String(item).trim())
        .filter(Boolean),
    ),
  );
}

function sortColumnsByOrder(columns = [], columnOrder = []) {
  const orderedIds = normalizeColumnOrder(columnOrder);
  const columnMap = new Map(columns.map((column) => [column.id, column]));
  const ordered = orderedIds.map((id) => columnMap.get(id)).filter(Boolean);
  const orderedSet = new Set(ordered.map((column) => column.id));
  const rest = columns
    .filter((column) => !orderedSet.has(column.id))
    .sort((first, second) =>
      first.label.localeCompare(second.label, "ru", { numeric: true, sensitivity: "base" }),
    );

  return [...ordered, ...rest];
}

function moveListItem(items = [], fromIndex = 0, toIndex = 0) {
  const nextItems = [...items];
  const [item] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, item);
  return nextItems;
}

function getStableParallelColumns(events = [], columns = [], columnOrder = []) {
  const columnMap = new Map();

  columns.forEach((column, index) => {
    const normalized = normalizeColumnDefinition(column, index);
    columnMap.set(normalized.id, normalized);
  });

  normalizeColumnOrder(columnOrder).forEach((id) => {
    if (!columnMap.has(id)) {
      columnMap.set(id, { id, label: id, track: "" });
    }
  });

  events.forEach((event) => {
    const id = event.parallelGroup || "A";
    const existing = columnMap.get(id);
    columnMap.set(id, {
      id,
      label: existing?.label || id,
      track: existing?.track || event.track || "",
    });
  });

  const result = sortColumnsByOrder(Array.from(columnMap.values()), columnOrder);

  return result.length ? result : [{ id: "A", label: "A", track: "Общий поток" }];
}

function getNextFlowId(columns = []) {
  const usedIds = new Set(
    safeArray(columns)
      .map((column) => String(column?.id || column || "").trim())
      .filter(Boolean),
  );
  let maxIndex = 0;
  for (const id of usedIds) {
    const match = id.match(/^P(\d+)$/i);
    if (match) {
      maxIndex = Math.max(maxIndex, Number(match[1]) || 0);
    }
  }

  let candidate = `P${maxIndex + 1 || 1}`;
  while (usedIds.has(candidate)) {
    maxIndex += 1;
    candidate = `P${maxIndex + 1}`;
  }

  return candidate;
}

function isDuplicateFlowLabel(columns = [], label = "", excludeId = "") {
  const normalizedLabel = String(label || "")
    .trim()
    .toLowerCase();
  if (!normalizedLabel) {
    return false;
  }

  return safeArray(columns).some(
    (column) =>
      column.id !== excludeId &&
      String(column.label || column.id || "")
        .trim()
        .toLowerCase() === normalizedLabel,
  );
}

function normalizeInlineEditableFields(fields) {
  const fallback = ["title", "track", "speakerName", "location"];
  if (!Array.isArray(fields)) {
    return fallback;
  }

  const allowed = new Set(fallback);
  const result = fields.filter((field) => allowed.has(field));
  return result.length ? result : fallback;
}

function normalizeEventFormValue(event = {}, eventTypes = []) {
  const rawEvent = safeObject(event);
  return {
    title: rawEvent.title || "",
    start: rawEvent.start || "09:00",
    end: rawEvent.end || "10:00",
    type: rawEvent.type || safeArray(eventTypes)[0] || "",
    speakerId: rawEvent.speakerId || "",
    location: rawEvent.location || "",
    track: rawEvent.track || "",
    parallelGroup: rawEvent.parallelGroup || "A",
    status: rawEvent.status || "planned",
    tags: Array.isArray(rawEvent.tags) ? rawEvent.tags.join(", ") : rawEvent.tags || "",
    description: rawEvent.description || "",
    reflectionQuestions: normalizeReflectionQuestions(rawEvent.reflectionQuestions),
  };
}

function normalizeEventPayload(form, speakersCatalog = []) {
  const speakerName =
    safeArray(speakersCatalog).find((speaker) => speaker.id === form.speakerId)?.name || "";
  return {
    ...form,
    speakerName,
    tags: normalizeList(form.tags),
    reflectionQuestions: normalizeReflectionQuestions(form.reflectionQuestions).filter((question) =>
      question.text.trim(),
    ),
  };
}

export function ReflectionQuestionEditor({
  value = [],
  disabled = false,
  title = "Вопросы рефлексии",
  emptyLabel = "Вопросы не настроены",
  onChange,
}) {
  const questions = normalizeReflectionQuestions(value);

  function updateQuestion(questionId, patch) {
    onChange?.(
      questions.map((question) =>
        question.id === questionId ? { ...question, ...patch } : question,
      ),
    );
  }

  function addQuestion() {
    onChange?.([...questions, createReflectionQuestionDraft()]);
  }

  function removeQuestion(questionId) {
    onChange?.(questions.filter((question) => question.id !== questionId));
  }

  return (
    <div className="reflection-question-editor">
      <div className="panel-head is-compact">
        <div>
          <p className="eyebrow">{title}</p>
          <p className="subtle">{questions.length ? `${questions.length} вопросов` : emptyLabel}</p>
        </div>
        <button type="button" className="ghost-button" disabled={disabled} onClick={addQuestion}>
          Добавить вопрос
        </button>
      </div>

      {questions.length ? (
        <div className="reflection-question-list">
          {questions.map((question, index) => (
            <div key={question.id} className="reflection-question-row">
              <Field label={`Вопрос ${index + 1}`} wide>
                <textarea
                  rows={2}
                  value={question.text}
                  disabled={disabled}
                  placeholder="Что важно осмыслить участнику?"
                  onChange={(event) => updateQuestion(question.id, { text: event.target.value })}
                />
              </Field>
              <label className="toggle-line">
                <input
                  type="checkbox"
                  checked={question.required}
                  disabled={disabled}
                  onChange={(event) =>
                    updateQuestion(question.id, { required: event.target.checked })
                  }
                />
                Обязательный
              </label>
              <button
                type="button"
                className="ghost-button is-danger"
                disabled={disabled}
                onClick={() => removeQuestion(question.id)}
              >
                Удалить
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function createScheduleEventDraft({
  start,
  parallelGroup,
  track,
  eventTypes,
  defaultDurationMinutes,
}) {
  const startMinutes = parseTimeToMinutes(start) ?? 9 * 60;
  const safeEventTypes = safeArray(eventTypes);

  return {
    title: "",
    start,
    end: formatMinutesAsTime(startMinutes + defaultDurationMinutes),
    type: safeEventTypes[0] || "",
    speakerId: "",
    location: "",
    track: track || (parallelGroup === "A" ? "Общий поток" : `Поток ${parallelGroup}`),
    parallelGroup,
    status: "planned",
    tags: "",
    description: "",
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getSafeSlotMinutes(slotMinutes) {
  return Number.isFinite(Number(slotMinutes)) && Number(slotMinutes) > 0 ? Number(slotMinutes) : 15;
}

function getSafeRowHeight(rowHeight) {
  return Number.isFinite(Number(rowHeight)) && Number(rowHeight) >= 28 ? Number(rowHeight) : 48;
}

function getSafeSize(value, fallback) {
  return Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : fallback;
}

function rangesOverlap(firstStart, firstEnd, secondStart, secondEnd) {
  return firstStart < secondEnd && secondStart < firstEnd;
}

function validateScheduleCandidate(
  candidate,
  events = [],
  excludedEventId = null,
  minDurationMinutes = 15,
) {
  const start = parseTimeToMinutes(candidate?.start);
  const end = parseTimeToMinutes(candidate?.end);

  if (start === null || end === null) {
    return "Укажите время в формате ЧЧ:ММ.";
  }

  if (end <= start) {
    return "Окончание должно быть позже начала.";
  }

  if (end - start < minDurationMinutes) {
    return `Минимальная длительность: ${minDurationMinutes} мин.`;
  }

  const candidateGroup = candidate.parallelGroup || "A";
  const normalizedEvents = safeArray(events).map((event, index) =>
    normalizeScheduleEvent(event, index),
  );
  const conflict = normalizedEvents.find((event) => {
    if (event.id === excludedEventId || (event.parallelGroup || "A") !== candidateGroup) {
      return false;
    }

    return rangesOverlap(
      start,
      end,
      getEventStartMinutes(event),
      getEventEndMinutes(event, minDurationMinutes),
    );
  });

  if (conflict) {
    return `Конфликт с мероприятием "${conflict.title || "Без названия"}" в этом потоке.`;
  }

  return "";
}

function createEventTimePatch(event, start, end, parallelGroup) {
  return {
    ...event,
    start: formatMinutesAsTime(start),
    end: formatMinutesAsTime(end),
    parallelGroup,
  };
}

export function ProgramEventForm({
  value,
  eventTypes = [],
  speakersCatalog = [],
  statusOptions = DEFAULT_EVENT_STATUS_OPTIONS,
  parallelGroupOptions = [],
  allowNewParallelGroup = true,
  newParallelGroupLabel = "Новый поток",
  disabled = false,
  saving = false,
  onChange,
  onSubmit,
  submitLabel = "Сохранить мероприятие",
}) {
  const form = normalizeEventFormValue(value, eventTypes);
  const typeOptions = Array.from(new Set([...safeArray(eventTypes), form.type].filter(Boolean)));
  const normalizedStatusOptions = normalizeStatusOptions(statusOptions);
  const flowOptions = sortColumnsByOrder(
    safeArray(parallelGroupOptions).map((column, index) =>
      normalizeColumnDefinition(column, index),
    ),
    safeArray(parallelGroupOptions).map((column) =>
      typeof column === "string" ? column : column?.id || column?.value || column?.parallelGroup,
    ),
  );
  const currentFlowExists = flowOptions.some((option) => option.id === form.parallelGroup);
  const flowSelectValue = currentFlowExists ? form.parallelGroup : "__new__";

  function updateField(key, fieldValue) {
    onChange?.({ ...form, [key]: fieldValue });
  }

  async function handleSubmit(event) {
    event?.preventDefault();
    await onSubmit?.(normalizeEventPayload(form, speakersCatalog));
  }

  return (
    <form className="program-event-form" onSubmit={handleSubmit}>
      <div className="field-grid">
        <Field label="Название" wide>
          <input
            value={form.title}
            disabled={disabled || saving}
            placeholder="Новая лекция или мастер-класс"
            onChange={(eventTarget) => updateField("title", eventTarget.target.value)}
          />
        </Field>
        <Field label="Тип мероприятия">
          <select
            value={form.type}
            disabled={disabled || saving}
            onChange={(eventTarget) => updateField("type", eventTarget.target.value)}
          >
            {typeOptions.length ? null : <option value="">Тип не выбран</option>}
            {typeOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Спикер">
          <select
            value={form.speakerId}
            disabled={disabled || saving}
            onChange={(eventTarget) => updateField("speakerId", eventTarget.target.value)}
          >
            <option value="">Без спикера</option>
            {safeArray(speakersCatalog).map((speaker) => (
              <option key={speaker.id} value={speaker.id}>
                {speaker.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Начало">
          <input
            value={form.start}
            disabled={disabled || saving}
            placeholder="09:00"
            onChange={(eventTarget) => updateField("start", eventTarget.target.value)}
          />
        </Field>
        <Field label="Окончание">
          <input
            value={form.end}
            disabled={disabled || saving}
            placeholder="10:00"
            onChange={(eventTarget) => updateField("end", eventTarget.target.value)}
          />
        </Field>
        <Field label="Локация">
          <input
            value={form.location}
            disabled={disabled || saving}
            onChange={(eventTarget) => updateField("location", eventTarget.target.value)}
          />
        </Field>
        <Field label="Трек">
          <input
            value={form.track}
            disabled={disabled || saving}
            onChange={(eventTarget) => updateField("track", eventTarget.target.value)}
          />
        </Field>
        <Field label="Параллель">
          {flowOptions.length ? (
            <select
              value={flowSelectValue}
              disabled={disabled || saving}
              onChange={(eventTarget) => {
                if (eventTarget.target.value === "__new__") {
                  updateField(
                    "parallelGroup",
                    form.parallelGroup && !currentFlowExists ? form.parallelGroup : "",
                  );
                  return;
                }

                const nextOption = flowOptions.find(
                  (option) => option.id === eventTarget.target.value,
                );
                onChange?.({
                  ...form,
                  parallelGroup: eventTarget.target.value,
                  track: form.track || nextOption?.track || "",
                });
              }}
            >
              {flowOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
              {allowNewParallelGroup ? (
                <option value="__new__">{newParallelGroupLabel}</option>
              ) : null}
            </select>
          ) : null}
          {allowNewParallelGroup && (!flowOptions.length || flowSelectValue === "__new__") ? (
            <input
              value={form.parallelGroup}
              disabled={disabled || saving}
              placeholder="P2"
              onChange={(eventTarget) => updateField("parallelGroup", eventTarget.target.value)}
            />
          ) : null}
        </Field>
        <Field label="Статус">
          <select
            value={form.status}
            disabled={disabled || saving}
            onChange={(eventTarget) => updateField("status", eventTarget.target.value)}
          >
            {normalizedStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Теги" wide>
          <input
            value={form.tags}
            disabled={disabled || saving}
            placeholder="рефлексия, параллель, спикер"
            onChange={(eventTarget) => updateField("tags", eventTarget.target.value)}
          />
        </Field>
        <Field label="Описание" wide>
          <textarea
            rows={3}
            value={form.description}
            disabled={disabled || saving}
            onChange={(eventTarget) => updateField("description", eventTarget.target.value)}
          />
        </Field>
      </div>

      <ReflectionQuestionEditor
        value={form.reflectionQuestions}
        disabled={disabled || saving}
        title="Рефлексия мероприятия"
        emptyLabel="Если вопросов нет, участник увидит обычный комментарий"
        onChange={(reflectionQuestions) => updateField("reflectionQuestions", reflectionQuestions)}
      />

      {onSubmit ? (
        <div className="card-actions">
          <button type="submit" className="primary-button" disabled={disabled || saving}>
            {saving ? "Сохраняем..." : submitLabel}
          </button>
        </div>
      ) : null}
    </form>
  );
}

export function ProgramEventDialog({
  open = false,
  mode = "edit",
  event,
  initialValue,
  eventTypes = [],
  speakersCatalog = [],
  statusOptions = DEFAULT_EVENT_STATUS_OPTIONS,
  parallelGroupOptions = [],
  allowNewParallelGroup = true,
  newParallelGroupLabel = "Новый поток",
  disabled = false,
  saving = false,
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState(() =>
    normalizeEventFormValue(event || initialValue, eventTypes),
  );

  useEffect(() => {
    if (open) {
      setForm(normalizeEventFormValue(event || initialValue, eventTypes));
    }
  }, [event, eventTypes, initialValue, open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handleKeyDown(keyEvent) {
      if (keyEvent.key === "Escape" && !saving) {
        onClose?.();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open, saving]);

  if (!open) {
    return null;
  }

  async function handleSubmit(payload) {
    await onSubmit?.(payload);
  }

  const dialogTitle = mode === "create" ? "Новое мероприятие" : "Редактировать мероприятие";
  const submitLabel = mode === "create" ? "Добавить мероприятие" : "Сохранить мероприятие";

  return (
    <div
      className="program-dialog-backdrop"
      role="presentation"
      onMouseDown={(mouseEvent) => {
        if (mouseEvent.target === mouseEvent.currentTarget && !saving) {
          onClose?.();
        }
      }}
    >
      <section className="program-dialog" role="dialog" aria-modal="true" aria-label={dialogTitle}>
        <div className="program-dialog-head">
          <div>
            <p className="eyebrow">
              {mode === "create" ? "Добавление в программу" : "Настройка события"}
            </p>
            <h3>{dialogTitle}</h3>
            <p className="subtle">
              {form.start} - {form.end} · поток {form.parallelGroup || "A"}
            </p>
          </div>
          <button
            type="button"
            className="ghost-button"
            disabled={saving}
            onClick={() => onClose?.()}
          >
            Закрыть
          </button>
        </div>

        <ProgramEventForm
          value={form}
          eventTypes={eventTypes}
          speakersCatalog={speakersCatalog}
          statusOptions={statusOptions}
          parallelGroupOptions={parallelGroupOptions}
          allowNewParallelGroup={allowNewParallelGroup}
          newParallelGroupLabel={newParallelGroupLabel}
          disabled={disabled}
          saving={saving}
          onChange={setForm}
          onSubmit={handleSubmit}
          submitLabel={submitLabel}
        />
      </section>
    </div>
  );
}

export function ProgramScheduleInspector({
  mode = "empty",
  program,
  day,
  event,
  draftEvent,
  eventTypes = [],
  speakersCatalog = [],
  statusOptions = DEFAULT_EVENT_STATUS_OPTIONS,
  parallelGroupOptions = [],
  allowNewParallelGroup = true,
  newParallelGroupLabel = "Новый поток",
  title,
  emptyTitle = "Выберите слот или мероприятие",
  emptyDescription = "Клик по пустому месту создаст черновик здесь, а клик по карточке откроет редактирование без модального окна.",
  submitLabels = {},
  showProgramBadge = true,
  validateBeforeSubmit = true,
  disabled = false,
  saving = false,
  minDurationMinutes = 15,
  onSaveEvent,
  onCreateEvent,
  onCancel,
}) {
  const effectiveMode = draftEvent ? "create" : event ? "edit" : mode;
  const sourceValue = effectiveMode === "create" ? draftEvent : event;
  const [form, setForm] = useState(() => normalizeEventFormValue(sourceValue, eventTypes));
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    setForm(normalizeEventFormValue(sourceValue, eventTypes));
    setValidationError("");
  }, [eventTypes, sourceValue]);

  async function handleSubmit(payload) {
    const excludedEventId = effectiveMode === "edit" ? event?.id : null;
    if (validateBeforeSubmit) {
      const nextError = validateScheduleCandidate(
        payload,
        safeArray(day?.events),
        excludedEventId,
        minDurationMinutes,
      );

      if (nextError) {
        setValidationError(nextError);
        return;
      }
    }

    setValidationError("");

    if (effectiveMode === "create") {
      await onCreateEvent?.(payload);
      return;
    }

    if (effectiveMode === "edit" && event) {
      await onSaveEvent?.(event.id, payload);
    }
  }

  if (effectiveMode === "empty" || !sourceValue) {
    return (
      <article className="panel-card program-inspector-card">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Инспектор программы</p>
            <h3>{title || program?.title || "Программа не выбрана"}</h3>
            <p className="subtle">
              {day
                ? `${day.label}${day.dateLabel ? ` · ${day.dateLabel}` : ""}`
                : "Выберите день программы"}
            </p>
          </div>
          {showProgramBadge && program ? (
            <StatusPill tone={getProgramStatusTone(program.status)}>
              {getProgramStatusLabel(program.status)}
            </StatusPill>
          ) : null}
        </div>

        <div className="feedback-card program-inspector-empty">
          <h2>{emptyTitle}</h2>
          <p>{emptyDescription}</p>
        </div>
      </article>
    );
  }

  const inspectorTitle =
    title || (effectiveMode === "create" ? "Новое мероприятие" : "Редактирование мероприятия");
  const submitLabel =
    effectiveMode === "create"
      ? submitLabels.create || "Добавить мероприятие"
      : submitLabels.edit || "Сохранить мероприятие";

  return (
    <article className="panel-card program-inspector-card">
      <div className="panel-head">
        <div>
          <p className="eyebrow">
            {effectiveMode === "create" ? "Новый слот" : "Выбранное мероприятие"}
          </p>
          <h3>{inspectorTitle}</h3>
          <p className="subtle">
            {form.start} - {form.end} · поток {form.parallelGroup || "A"}
          </p>
        </div>
        <button
          type="button"
          className="ghost-button"
          disabled={saving}
          onClick={() => onCancel?.()}
        >
          Снять выбор
        </button>
      </div>

      {validationError ? (
        <AlertCard title="Не удалось сохранить" detail={validationError} tone="severity-high" />
      ) : null}

      <ProgramEventForm
        value={form}
        eventTypes={eventTypes}
        speakersCatalog={speakersCatalog}
        statusOptions={statusOptions}
        parallelGroupOptions={parallelGroupOptions}
        allowNewParallelGroup={allowNewParallelGroup}
        newParallelGroupLabel={newParallelGroupLabel}
        disabled={disabled}
        saving={saving}
        onChange={setForm}
        onSubmit={handleSubmit}
        submitLabel={submitLabel}
      />
    </article>
  );
}

export function ProgramDayTabs({
  days = [],
  currentDayId,
  disabled = false,
  compact = false,
  emptyTitle = "Дней пока нет",
  emptyDescription = "Добавьте день программы, чтобы собрать сетку мероприятий.",
  getDayLabel,
  onChange,
}) {
  const safeDays = safeArray(days);
  if (!safeDays.length) {
    return (
      <div
        className={
          compact
            ? "feedback-card program-empty-note is-compact"
            : "feedback-card program-empty-note"
        }
      >
        <h2>{emptyTitle}</h2>
        <p>{emptyDescription}</p>
      </div>
    );
  }

  return (
    <Tabs
      items={safeDays.map((day) => ({
        id: day.id,
        label: getDayLabel
          ? getDayLabel(day)
          : [day.label, day.dateLabel].filter(Boolean).join(" · "),
      }))}
      activeId={currentDayId}
      disabled={disabled}
      onChange={onChange}
      ariaLabel={compact ? "Дни" : "Дни программы"}
    />
  );
}

export function ProgramScheduleToolbar({
  programs = [],
  currentProgram,
  currentDay,
  slotMinutes = 15,
  title = "Конструктор программы",
  programLabel = "Программа",
  dayLabel = "День",
  createDayLabel = "+ День",
  deleteDayLabel = "Удалить день",
  emptyProgramOption = "Нет программ",
  compact = false,
  disabled = false,
  saving = false,
  publishLabel = "Опубликовать программу",
  draftLabel = "Вернуть в черновик",
  publishingLabel = "Сохраняем статус...",
  getProgramLabel,
  onSelectProgram,
  onSelectDay,
  onCreateDay,
  onDeleteDay,
  onPublishProgram,
  onDraftProgram,
}) {
  const safePrograms = safeArray(programs).map((program, index) =>
    normalizeComponentProgram(program, index),
  );
  const safeCurrentProgram = currentProgram ? normalizeComponentProgram(currentProgram) : null;
  const safeCurrentDay = safeObject(currentDay);
  const programStatus = safeCurrentProgram?.status || "draft";
  const isDraft = programStatus === "draft";
  const isPublished = programStatus === "published";
  const canPublish = Boolean(safeCurrentProgram && onPublishProgram && isDraft);
  const canDraft = Boolean(safeCurrentProgram && onDraftProgram && isPublished);
  const publicationNote = isPublished
    ? "Участники видят события этой программы в дневнике."
    : isDraft
      ? "Черновик скрыт от участников до публикации."
      : "Архивная программа скрыта от участников.";

  return (
    <article
      className={
        compact
          ? "panel-card program-schedule-toolbar is-compact"
          : "panel-card program-schedule-toolbar"
      }
    >
      <div className="panel-head">
        <div>
          <p className="eyebrow">Конструктор программы</p>
          <h3>{title || safeCurrentProgram?.title || "Программа не выбрана"}</h3>
          <p className="subtle">
            {safeCurrentProgram?.eventContext?.title || "Выберите программу"} · шаг сетки{" "}
            {slotMinutes} мин.
          </p>
        </div>
      </div>

      <div className="program-toolbar-controls">
        <Field label={programLabel}>
          {safePrograms.length > 1 ? (
            <select
              value={safeCurrentProgram?.id || ""}
              disabled={disabled || saving || !safePrograms.length}
              onChange={(eventTarget) => onSelectProgram?.(eventTarget.target.value)}
            >
              {safePrograms.length ? null : <option value="">{emptyProgramOption}</option>}
              {safePrograms.map((program) => (
                <option
                  key={program.id}
                  value={program.id}
                  label={getProgramLabel ? getProgramLabel(program) : undefined}
                >
                  {program.title} · {getProgramStatusLabel(program.status)}
                </option>
              ))}
            </select>
          ) : (
            <div className="program-single-summary">
              <strong>{safeCurrentProgram?.title || emptyProgramOption}</strong>
              {safeCurrentProgram ? (
                <span>{getProgramStatusLabel(safeCurrentProgram.status)}</span>
              ) : null}
            </div>
          )}
        </Field>

        <div className="program-day-tabs-field">
          <span>{dayLabel}</span>
          <ProgramDayTabs
            days={safeCurrentProgram?.days || []}
            currentDayId={safeCurrentDay?.id}
            disabled={disabled || saving}
            compact={compact}
            onChange={onSelectDay}
          />
          {(onCreateDay || onDeleteDay) && safeCurrentProgram ? (
            <div className="program-day-actions">
              {onCreateDay ? (
                <button
                  type="button"
                  className="ghost-button"
                  disabled={disabled || saving}
                  onClick={() => onCreateDay?.()}
                >
                  {createDayLabel}
                </button>
              ) : null}
              {onDeleteDay && safeCurrentDay?.id ? (
                <button
                  type="button"
                  className="ghost-button is-danger"
                  disabled={disabled || saving}
                  onClick={() => onDeleteDay?.(safeCurrentDay.id)}
                >
                  {deleteDayLabel}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="program-publication-actions">
          <span>Публикация</span>
          <div className="program-publication-row">
            {safeCurrentProgram ? (
              <StatusPill tone={getProgramStatusTone(programStatus)}>
                {getProgramStatusLabel(programStatus)}
              </StatusPill>
            ) : null}
            {canPublish ? (
              <button
                type="button"
                className="primary-button"
                disabled={disabled || saving}
                onClick={() => onPublishProgram?.()}
              >
                {saving ? publishingLabel : publishLabel}
              </button>
            ) : null}
            {canDraft ? (
              <button
                type="button"
                className="ghost-button"
                disabled={disabled || saving}
                onClick={() => onDraftProgram?.()}
              >
                {saving ? publishingLabel : draftLabel}
              </button>
            ) : null}
          </div>
          <p>
            {safeCurrentProgram
              ? publicationNote
              : "Выберите программу, чтобы управлять публикацией."}
          </p>
        </div>
      </div>
    </article>
  );
}

export function ProgramScheduleTable({
  program,
  day,
  slotMinutes = 15,
  defaultDurationMinutes = 60,
  rowHeight = 48,
  minDurationMinutes,
  columnMinWidth = 220,
  timeColumnWidth = 86,
  showAddButtons = true,
  allowDrag = true,
  allowResize = true,
  showTimeRail = true,
  emptyState,
  conflictMessage,
  timeStart,
  timeEnd,
  columns,
  flows,
  columnOrder,
  allowColumnReorder = false,
  allowCreateFlow = true,
  clearSelectionOnEmptyClick = true,
  createOnEmptyClickWhenIdle = true,
  inlineEditableFields,
  calendarMaxHeight = "min(72vh, 760px)",
  calendarMinHeight = 320,
  stickyHeader = true,
  selectedEventId,
  draftEvent,
  disabled = false,
  saving = false,
  eventTypes = [],
  speakersCatalog = [],
  renderEvent,
  onCreateEvent,
  onUpdateEvent,
  onSelectEvent,
  onSelectEmptySlot,
  onClearSelection,
  onReorderColumns,
  onCreateFlow,
  onRenameFlow,
  onUpdateFlows,
  onActivateEvent,
}) {
  const gridRef = useRef(null);
  const headerColumnsRef = useRef(null);
  const [calendarError, setCalendarError] = useState("");
  const [interaction, setInteraction] = useState(null);
  const [interactionPreview, setInteractionPreview] = useState(null);
  const [columnInteraction, setColumnInteraction] = useState(null);
  const [columnPreviewOrder, setColumnPreviewOrder] = useState(null);
  const [draftFlow, setDraftFlow] = useState(null);
  const [editingFlow, setEditingFlow] = useState(null);
  const [inlineEdit, setInlineEdit] = useState(null);
  const events = useMemo(
    () =>
      safeArray(day?.events)
        .map((event, index) => normalizeScheduleEvent(event, index, day?.id || "day"))
        .sort(
          (first, second) =>
            getEventStartMinutes(first) - getEventStartMinutes(second) ||
            (first.parallelGroup || "").localeCompare(second.parallelGroup || "", "ru", {
              numeric: true,
            }),
        ),
    [day],
  );
  const scheduleColumns = useMemo(() => {
    const sourceColumns = safeArray(flows !== undefined ? flows : columns);
    const columnsWithDraft =
      draftFlow &&
      !sourceColumns.some((column) => normalizeColumnDefinition(column).id === draftFlow.id)
        ? [...sourceColumns, draftFlow]
        : sourceColumns;
    return getStableParallelColumns(events, columnsWithDraft, columnPreviewOrder || columnOrder);
  }, [columnOrder, columnPreviewOrder, columns, draftFlow, events, flows]);
  const editableFields = useMemo(
    () => normalizeInlineEditableFields(inlineEditableFields),
    [inlineEditableFields],
  );
  const safeSlotMinutes = getSafeSlotMinutes(slotMinutes);
  const safeRowHeight = getSafeRowHeight(rowHeight);
  const safeMinDuration = getSafeSlotMinutes(minDurationMinutes || safeSlotMinutes);
  const safeColumnMinWidth = Math.max(140, getSafeSize(columnMinWidth, 220));
  const safeTimeColumnWidth = Math.max(56, getSafeSize(timeColumnWidth, 86));
  const columnCount = Math.max(scheduleColumns.length, 1);
  const columnWidth = 100 / columnCount;
  const gridMinWidth = columnCount * safeColumnMinWidth;
  const createFlowColumnWidth = allowCreateFlow
    ? Math.max(150, Math.min(safeColumnMinWidth, 190))
    : 0;
  const scheduleAreaMinWidth = gridMinWidth + createFlowColumnWidth;
  const calendarMinWidth = scheduleAreaMinWidth + (showTimeRail ? safeTimeColumnWidth : 0);
  const calendarGridTemplateColumns = showTimeRail
    ? `${safeTimeColumnWidth}px minmax(${scheduleAreaMinWidth}px, 1fr)`
    : `minmax(${scheduleAreaMinWidth}px, 1fr)`;

  useEffect(() => {
    setDraftFlow(null);
    setEditingFlow(null);
    setInlineEdit(null);
  }, [day?.id]);

  const range = useMemo(() => {
    const explicitStart = parseTimeToMinutes(timeStart);
    const explicitEnd = parseTimeToMinutes(timeEnd);

    if (explicitStart !== null && explicitEnd !== null && explicitEnd > explicitStart) {
      return { start: explicitStart, end: explicitEnd };
    }

    if (!events.length) {
      return { start: 9 * 60, end: 18 * 60 };
    }

    const starts = events.map(getEventStartMinutes);
    const ends = events.map((event) => getEventEndMinutes(event, defaultDurationMinutes));
    const minStart = Math.min(...starts);
    const maxEnd = Math.max(...ends);

    return {
      start: Math.max(0, floorToStep(minStart - safeSlotMinutes, safeSlotMinutes)),
      end: Math.min(24 * 60, ceilToStep(maxEnd + safeSlotMinutes, safeSlotMinutes)),
    };
  }, [defaultDurationMinutes, events, safeSlotMinutes, timeEnd, timeStart]);

  const slots = useMemo(() => {
    const result = [];
    for (let minutes = range.start; minutes < range.end; minutes += safeSlotMinutes) {
      result.push({ minutes, label: formatMinutesAsTime(minutes) });
    }
    return result;
  }, [range.end, range.start, safeSlotMinutes]);

  const gridHeight = Math.max(slots.length * safeRowHeight, safeRowHeight);

  function getColumnIndex(parallelGroup) {
    const index = scheduleColumns.findIndex((column) => column.id === (parallelGroup || "A"));
    return index >= 0 ? index : 0;
  }

  function getDraftFromPoint(pointerEvent) {
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) {
      return null;
    }

    const relativeX = clamp(pointerEvent.clientX - rect.left, 0, Math.max(rect.width - 1, 0));
    const relativeY = clamp(pointerEvent.clientY - rect.top, 0, Math.max(rect.height - 1, 0));
    const columnIndex = clamp(
      Math.floor(relativeX / (rect.width / columnCount)),
      0,
      columnCount - 1,
    );
    const slotIndex = clamp(Math.floor(relativeY / safeRowHeight), 0, slots.length - 1);
    const start = range.start + slotIndex * safeSlotMinutes;
    const column = scheduleColumns[columnIndex] || scheduleColumns[0] || { id: "A", track: "" };

    return createScheduleEventDraft({
      start: formatMinutesAsTime(start),
      parallelGroup: column.id,
      track: column.track,
      eventTypes,
      defaultDurationMinutes,
    });
  }

  function handleGridClick(pointerEvent) {
    if (!day || disabled || saving || pointerEvent.target.closest?.(".schedule-calendar-event")) {
      return;
    }

    if (clearSelectionOnEmptyClick && (selectedEventId || draftEvent)) {
      setCalendarError("");
      onClearSelection?.();
      return;
    }

    if (!createOnEmptyClickWhenIdle) {
      return;
    }

    const draft = getDraftFromPoint(pointerEvent);
    if (draft) {
      setCalendarError("");
      if (onSelectEmptySlot) {
        onSelectEmptySlot(day.id, draft);
        return;
      }

      onCreateEvent?.(day.id, draft);
    }
  }

  function getPreviewFromPointer(clientX, clientY, currentInteraction) {
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) {
      return null;
    }

    const deltaSlots = Math.round((clientY - currentInteraction.startY) / safeRowHeight);
    const deltaMinutes = deltaSlots * safeSlotMinutes;
    const originalDuration = currentInteraction.originalEnd - currentInteraction.originalStart;
    let nextStart = currentInteraction.originalStart;
    let nextEnd = currentInteraction.originalEnd;
    let nextColumnIndex = currentInteraction.originalColumnIndex;

    if (currentInteraction.mode === "drag") {
      const nextColumnDelta = Math.round(
        (clientX - currentInteraction.startX) / (rect.width / columnCount),
      );
      nextColumnIndex = clamp(
        currentInteraction.originalColumnIndex + nextColumnDelta,
        0,
        columnCount - 1,
      );
      nextStart = clamp(
        currentInteraction.originalStart + deltaMinutes,
        range.start,
        range.end - originalDuration,
      );
      nextEnd = nextStart + originalDuration;
    }

    if (currentInteraction.mode === "resize-start") {
      nextStart = clamp(
        currentInteraction.originalStart + deltaMinutes,
        range.start,
        currentInteraction.originalEnd - safeMinDuration,
      );
    }

    if (currentInteraction.mode === "resize-end") {
      nextEnd = clamp(
        currentInteraction.originalEnd + deltaMinutes,
        currentInteraction.originalStart + safeMinDuration,
        range.end,
      );
    }

    const column = scheduleColumns[nextColumnIndex] || scheduleColumns[0];
    return {
      eventId: currentInteraction.event.id,
      start: nextStart,
      end: nextEnd,
      parallelGroup: column.id,
    };
  }

  function startInteraction(pointerEvent, event, mode = "drag") {
    if (disabled || saving || !day?.id) {
      return;
    }

    if ((mode === "drag" && !allowDrag) || (mode !== "drag" && !allowResize)) {
      if (mode === "drag") {
        pointerEvent.stopPropagation();
        onSelectEvent?.(day.id, event.id);
        onActivateEvent?.(day.id, event.id);
      }
      return;
    }

    pointerEvent.preventDefault();
    pointerEvent.stopPropagation();
    setCalendarError("");
    onSelectEvent?.(day.id, event.id);

    setInteraction({
      mode,
      event,
      startX: pointerEvent.clientX,
      startY: pointerEvent.clientY,
      originalStart: getEventStartMinutes(event),
      originalEnd: getEventEndMinutes(event, defaultDurationMinutes),
      originalColumnIndex: getColumnIndex(event.parallelGroup),
    });
  }

  useEffect(() => {
    if (!selectedEventId && !draftEvent) {
      return undefined;
    }

    function handleKeyDown(keyEvent) {
      if (keyEvent.key === "Escape" && !saving) {
        onClearSelection?.();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [draftEvent, onClearSelection, saving, selectedEventId]);

  useEffect(() => {
    if (!interaction) {
      return undefined;
    }

    let latestPreview = null;
    let moved = false;

    function handlePointerMove(pointerEvent) {
      const distanceX = Math.abs(pointerEvent.clientX - interaction.startX);
      const distanceY = Math.abs(pointerEvent.clientY - interaction.startY);
      if (distanceX > 3 || distanceY > 3) {
        moved = true;
      }

      latestPreview = getPreviewFromPointer(
        pointerEvent.clientX,
        pointerEvent.clientY,
        interaction,
      );
      setInteractionPreview(latestPreview);
    }

    async function handlePointerUp(pointerEvent) {
      const nextPreview =
        latestPreview ||
        getPreviewFromPointer(pointerEvent.clientX, pointerEvent.clientY, interaction);

      setInteraction(null);
      setInteractionPreview(null);

      if (!moved || !nextPreview) {
        onSelectEvent?.(day.id, interaction.event.id);
        onActivateEvent?.(day.id, interaction.event.id);
        return;
      }

      const candidate = createEventTimePatch(
        interaction.event,
        nextPreview.start,
        nextPreview.end,
        nextPreview.parallelGroup,
      );
      const nextError = validateScheduleCandidate(
        candidate,
        events,
        interaction.event.id,
        safeMinDuration,
      );

      if (nextError) {
        setCalendarError(conflictMessage || nextError);
        return;
      }

      setCalendarError("");
      await onUpdateEvent?.(
        day.id,
        interaction.event.id,
        {
          start: candidate.start,
          end: candidate.end,
          parallelGroup: candidate.parallelGroup,
        },
        {
          type: "update-event",
          before: {
            start: formatMinutesAsTime(interaction.originalStart),
            end: formatMinutesAsTime(interaction.originalEnd),
            parallelGroup: interaction.event.parallelGroup || "A",
          },
          after: {
            start: candidate.start,
            end: candidate.end,
            parallelGroup: candidate.parallelGroup,
          },
        },
      );
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [
    columnCount,
    day,
    defaultDurationMinutes,
    events,
    interaction,
    onActivateEvent,
    onSelectEvent,
    onUpdateEvent,
    conflictMessage,
    range.end,
    range.start,
    safeMinDuration,
    safeRowHeight,
    safeSlotMinutes,
    scheduleColumns,
  ]);

  function startColumnReorder(pointerEvent, column, columnIndex) {
    if (!allowColumnReorder || disabled || saving || !day?.id || scheduleColumns.length <= 1) {
      return;
    }

    pointerEvent.preventDefault();
    pointerEvent.stopPropagation();
    setCalendarError("");
    setColumnInteraction({
      columnId: column.id,
      startX: pointerEvent.clientX,
      startIndex: columnIndex,
      originalOrder: scheduleColumns.map((item) => item.id),
    });
    setColumnPreviewOrder(scheduleColumns.map((item) => item.id));
  }

  useEffect(() => {
    if (!columnInteraction) {
      return undefined;
    }

    let moved = false;

    function getColumnIndexFromPointer(clientX) {
      const rect = headerColumnsRef.current?.getBoundingClientRect();
      if (!rect) {
        return columnInteraction.startIndex;
      }

      const relativeX = clamp(clientX - rect.left, 0, Math.max(rect.width - 1, 0));
      const nextIndex = Math.floor(relativeX / Math.max(rect.width / columnCount, 1));
      return clamp(nextIndex, 0, columnCount - 1);
    }

    function getNextOrder(clientX) {
      return moveListItem(
        columnInteraction.originalOrder,
        columnInteraction.startIndex,
        getColumnIndexFromPointer(clientX),
      );
    }

    function handlePointerMove(pointerEvent) {
      if (Math.abs(pointerEvent.clientX - columnInteraction.startX) > 4) {
        moved = true;
      }
      setColumnPreviewOrder(getNextOrder(pointerEvent.clientX));
    }

    async function handlePointerUp(pointerEvent) {
      const nextOrder = getNextOrder(pointerEvent.clientX);
      const changed = nextOrder.join("|") !== columnInteraction.originalOrder.join("|");

      setColumnInteraction(null);
      setColumnPreviewOrder(null);

      if (!moved || !changed) {
        return;
      }

      try {
        await onReorderColumns?.(day.id, nextOrder);
      } catch (error) {
        setCalendarError(error?.message || "Не удалось сохранить порядок потоков.");
      }
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      setColumnPreviewOrder(null);
    };
  }, [columnCount, columnInteraction, day, onReorderColumns]);

  function startCreateFlow(clickEvent) {
    clickEvent?.preventDefault();
    clickEvent?.stopPropagation();
    if (!allowCreateFlow || disabled || saving || !day?.id) {
      return;
    }

    const nextFlowId = getNextFlowId(scheduleColumns);
    const nextDraftFlow = { id: nextFlowId, label: nextFlowId, track: "" };
    setCalendarError("");
    setDraftFlow(nextDraftFlow);
    setEditingFlow({ mode: "create", flowId: nextFlowId, label: "", track: "" });
  }

  function startFlowRename(pointerEvent, column) {
    pointerEvent?.preventDefault();
    pointerEvent?.stopPropagation();
    if (disabled || saving || !day?.id) {
      return;
    }

    setCalendarError("");
    setEditingFlow({
      mode: "rename",
      flowId: column.id,
      label: column.label || column.id,
      track: column.track || "",
    });
  }

  function cancelFlowEdit() {
    if (editingFlow?.mode === "create") {
      setDraftFlow(null);
    }
    setEditingFlow(null);
    setCalendarError("");
  }

  function handleFlowEditorBlur(blurEvent) {
    if (blurEvent.currentTarget.contains(blurEvent.relatedTarget)) {
      return;
    }

    void commitFlowEdit();
  }

  function handleFlowEditorKeyDown(keyEvent) {
    if (keyEvent.key === "Enter") {
      keyEvent.preventDefault();
      void commitFlowEdit();
    }
    if (keyEvent.key === "Escape") {
      keyEvent.preventDefault();
      cancelFlowEdit();
    }
  }

  async function commitFlowEdit() {
    if (!editingFlow || disabled || saving || !day?.id) {
      return;
    }

    const label = String(editingFlow.label || "").trim();
    if (!label) {
      setCalendarError("Flow name is required.");
      return;
    }

    if (isDuplicateFlowLabel(scheduleColumns, label, editingFlow.flowId)) {
      setCalendarError("Flow names must be unique within the day.");
      return;
    }

    const nextFlow = {
      id: editingFlow.flowId,
      label,
      track: String(editingFlow.track || "").trim(),
    };

    try {
      if (editingFlow.mode === "create") {
        await onCreateFlow?.(day.id, nextFlow);
        if (!onCreateFlow && onUpdateFlows) {
          await onUpdateFlows(day.id, [...scheduleColumns, nextFlow]);
        }
        setDraftFlow(null);
      } else {
        await onRenameFlow?.(day.id, editingFlow.flowId, {
          label: nextFlow.label,
          track: nextFlow.track,
        });
        if (!onRenameFlow && onUpdateFlows) {
          await onUpdateFlows(
            day.id,
            scheduleColumns.map((column) =>
              column.id === nextFlow.id ? { ...column, ...nextFlow } : column,
            ),
          );
        }
      }
      setEditingFlow(null);
      setCalendarError("");
    } catch (error) {
      setCalendarError(error?.message || "Could not save flow.");
    }
  }

  function startInlineEdit(pointerEvent, event, field) {
    pointerEvent?.preventDefault();
    pointerEvent?.stopPropagation();
    if (disabled || saving || !editableFields.includes(field) || renderEvent) {
      return;
    }

    setInlineEdit({
      eventId: event.id,
      field,
      value: event[field] || "",
    });
  }

  function cancelInlineEdit() {
    setInlineEdit(null);
  }

  async function commitInlineEdit() {
    if (!inlineEdit || disabled || saving || !day?.id) {
      return;
    }

    const event = events.find((item) => item.id === inlineEdit.eventId);
    if (!event) {
      setInlineEdit(null);
      return;
    }

    const value = String(inlineEdit.value || "").trim();
    const field = inlineEdit.field;
    const previousValue = event[field] || "";
    const patch = { [field]: value };
    const before = { [field]: previousValue };
    const after = { [field]: value };

    if (field === "speakerName") {
      const matchedSpeaker = safeArray(speakersCatalog).find(
        (speaker) =>
          String(speaker.name || "")
            .trim()
            .toLowerCase() === value.toLowerCase(),
      );
      patch.speakerId = matchedSpeaker?.id || "";
      before.speakerId = event.speakerId || "";
      after.speakerId = matchedSpeaker?.id || "";
    }

    if (
      value === previousValue &&
      (field !== "speakerName" || patch.speakerId === (event.speakerId || ""))
    ) {
      setInlineEdit(null);
      return;
    }

    try {
      await onUpdateEvent?.(day.id, event.id, patch, {
        type: "inline-edit-event",
        before,
        after,
      });
      setInlineEdit(null);
      setCalendarError("");
    } catch (error) {
      setCalendarError(error?.message || "Could not save event text.");
    }
  }

  function renderInlineValue(event, field, children, className = "") {
    const isEditing = inlineEdit?.eventId === event.id && inlineEdit?.field === field;
    if (isEditing) {
      return (
        <input
          className={["schedule-inline-input", className].filter(Boolean).join(" ")}
          value={inlineEdit.value}
          autoFocus
          disabled={disabled || saving}
          onPointerDown={(pointerEvent) => pointerEvent.stopPropagation()}
          onClick={(clickEvent) => clickEvent.stopPropagation()}
          onChange={(changeEvent) =>
            setInlineEdit({ ...inlineEdit, value: changeEvent.target.value })
          }
          onBlur={() => void commitInlineEdit()}
          onKeyDown={(keyEvent) => {
            if (keyEvent.key === "Enter") {
              keyEvent.preventDefault();
              void commitInlineEdit();
            }
            if (keyEvent.key === "Escape") {
              keyEvent.preventDefault();
              cancelInlineEdit();
            }
          }}
        />
      );
    }

    return (
      <span
        className={["schedule-inline-value", className].filter(Boolean).join(" ")}
        onDoubleClick={(pointerEvent) => startInlineEdit(pointerEvent, event, field)}
      >
        {children}
      </span>
    );
  }

  function renderScheduleEmptyState(customState, fallbackTitle, fallbackDescription) {
    if (typeof customState === "function") {
      return customState({ program, day });
    }

    if (customState?.$$typeof) {
      return customState;
    }

    if (customState && typeof customState !== "string") {
      return (
        <article className="panel-card">
          <div className="feedback-card">
            <h2>{customState.title || fallbackTitle}</h2>
            <p>{customState.description || fallbackDescription}</p>
          </div>
        </article>
      );
    }

    return (
      <article className="panel-card">
        <div className="feedback-card">
          <h2>{fallbackTitle}</h2>
          <p>{customState || fallbackDescription}</p>
        </div>
      </article>
    );
  }

  if (!program && emptyState?.program) {
    return renderScheduleEmptyState(
      emptyState.program,
      "Программа не выбрана",
      "Создайте или выберите программу, чтобы открыть табличный конструктор.",
    );
  }

  if (!program) {
    return (
      <article className="panel-card">
        <div className="feedback-card">
          <h2>Программа не выбрана</h2>
          <p>Создайте или выберите программу, чтобы открыть табличный конструктор.</p>
        </div>
      </article>
    );
  }

  if (!day && emptyState?.day) {
    return renderScheduleEmptyState(
      emptyState.day,
      "День не выбран",
      "Добавьте день программы, и сетка времени появится здесь.",
    );
  }

  if (!day) {
    return (
      <article className="panel-card">
        <div className="feedback-card">
          <h2>День не выбран</h2>
          <p>Добавьте день программы, и сетка времени появится здесь.</p>
        </div>
      </article>
    );
  }

  function renderCalendarEvent(event) {
    const preview = interactionPreview?.eventId === event.id ? interactionPreview : null;
    const start = preview?.start ?? getEventStartMinutes(event);
    const end = preview?.end ?? getEventEndMinutes(event, defaultDurationMinutes);
    const parallelGroup = preview?.parallelGroup || event.parallelGroup || "A";
    const columnIndex = getColumnIndex(parallelGroup);
    const top = ((start - range.start) / safeSlotMinutes) * safeRowHeight + 4;
    const height = Math.max(
      ((end - start) / safeSlotMinutes) * safeRowHeight - 8,
      safeRowHeight - 8,
    );
    const isSelected = selectedEventId === event.id;
    const sizeClass =
      height <= 44
        ? "is-micro"
        : height <= 72
          ? "is-short"
          : height >= 160
            ? "is-tall"
            : "is-regular";
    const timeLabel = `${formatMinutesAsTime(start)} - ${formatMinutesAsTime(end)}`;
    const trackLabel = event.track || event.type || "Трек не указан";
    const metaLabel = `${event.speakerName || "Без спикера"} · ${event.location || "Без локации"}`;
    const eventLabel = `${timeLabel} · ${event.title || "Без названия"} · ${trackLabel} · ${metaLabel}`;

    return (
      <div
        key={event.id}
        className={[
          "schedule-calendar-event",
          `status-${event.status || "planned"}`,
          isSelected ? "is-selected" : "",
          preview ? "is-moving" : "",
          sizeClass,
          !allowDrag ? "is-static" : "",
          !allowResize ? "is-resize-disabled" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={{
          top: `${top}px`,
          height: `${height}px`,
          left: `calc(${columnIndex * columnWidth}% + 6px)`,
          width: `calc(${columnWidth}% - 12px)`,
        }}
        role="button"
        tabIndex={disabled || saving ? -1 : 0}
        title={eventLabel}
        aria-label={eventLabel}
        onPointerDown={(pointerEvent) => startInteraction(pointerEvent, event, "drag")}
        onDoubleClick={(mouseEvent) => {
          mouseEvent.preventDefault();
          mouseEvent.stopPropagation();
          onSelectEvent?.(day.id, event.id);
          onActivateEvent?.(day.id, event.id);
          startInlineEdit(mouseEvent, event, "title");
        }}
        onKeyDown={(keyEvent) => {
          if (keyEvent.key === "Enter" || keyEvent.key === " ") {
            keyEvent.preventDefault();
            onSelectEvent?.(day.id, event.id);
            onActivateEvent?.(day.id, event.id);
          }
        }}
      >
        <button
          type="button"
          className="schedule-resize-handle is-top"
          aria-label={`Изменить начало: ${event.title || "мероприятие"}`}
          disabled={disabled || saving}
          onPointerDown={(pointerEvent) => startInteraction(pointerEvent, event, "resize-start")}
        />
        {renderEvent ? (
          renderEvent({
            event,
            day,
            column: scheduleColumns[columnIndex],
            disabled,
            saving,
            allowDrag,
            allowResize,
            onOpen: () => onSelectEvent?.(day.id, event.id),
          })
        ) : (
          <div className="schedule-calendar-event-body">
            <div className="schedule-event-main">
              <span className="schedule-event-time">{timeLabel}</span>
              <strong>
                {renderInlineValue(event, "title", event.title || "Без названия", "is-title")}
              </strong>
            </div>
            <span className="schedule-event-track">
              {renderInlineValue(event, "track", trackLabel, "is-track")}
            </span>
            <small className="schedule-event-meta">
              {renderInlineValue(
                event,
                "speakerName",
                event.speakerName || "Без спикера",
                "is-speaker",
              )}
              <span aria-hidden="true"> · </span>
              {renderInlineValue(event, "location", event.location || "Без локации", "is-location")}
            </small>
          </div>
        )}
        <button
          type="button"
          className="schedule-resize-handle is-bottom"
          aria-label={`Изменить окончание: ${event.title || "мероприятие"}`}
          disabled={disabled || saving}
          onPointerDown={(pointerEvent) => startInteraction(pointerEvent, event, "resize-end")}
        />
      </div>
    );
  }

  return (
    <article className="panel-card program-schedule-card">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Табличный вид</p>
          <h3>{day.label}</h3>
          <p className="subtle">
            {day.dateLabel || "Дата не указана"} · {formatMinutesAsTime(range.start)} -{" "}
            {formatMinutesAsTime(range.end)}
          </p>
        </div>
        <div className="pill-grid">
          <SoftPill>{scheduleColumns.length} потоков</SoftPill>
          <SoftPill outline>{safeSlotMinutes} мин.</SoftPill>
        </div>
      </div>

      {calendarError ? (
        <AlertCard title="Конфликт расписания" detail={calendarError} tone="severity-high" />
      ) : null}

      <div
        className={[
          "schedule-calendar-wrap",
          stickyHeader ? "has-sticky-header" : "is-static-header",
        ]
          .filter(Boolean)
          .join(" ")}
        style={{
          maxHeight: calendarMaxHeight,
          minHeight:
            typeof calendarMinHeight === "number" ? `${calendarMinHeight}px` : calendarMinHeight,
        }}
      >
        <div
          className={
            showTimeRail
              ? "schedule-calendar-header"
              : "schedule-calendar-header is-without-time-rail"
          }
          style={{
            gridTemplateColumns: calendarGridTemplateColumns,
            minWidth: `${calendarMinWidth}px`,
          }}
        >
          <div className="schedule-time-heading">Время</div>
          <div
            className="schedule-calendar-workspace"
            style={{
              gridTemplateColumns: allowCreateFlow
                ? `minmax(${gridMinWidth}px, 1fr) ${createFlowColumnWidth}px`
                : `minmax(${gridMinWidth}px, 1fr)`,
            }}
          >
            <div
              ref={headerColumnsRef}
              className="schedule-calendar-columns"
              style={{
                gridTemplateColumns: `repeat(${columnCount}, minmax(${safeColumnMinWidth}px, 1fr))`,
              }}
            >
              {scheduleColumns.map((column, index) => (
                <div
                  key={column.id}
                  className={[
                    "schedule-flow-heading",
                    columnInteraction?.columnId === column.id ? "is-reordering" : "",
                    allowColumnReorder && scheduleColumns.length > 1 ? "is-reorderable" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <button
                    type="button"
                    className="schedule-flow-drag-handle"
                    aria-label={`Изменить порядок потока ${column.label}`}
                    disabled={
                      !allowColumnReorder || disabled || saving || scheduleColumns.length <= 1
                    }
                    onPointerDown={(pointerEvent) =>
                      startColumnReorder(pointerEvent, column, index)
                    }
                  >
                    ⋮⋮
                  </button>
                  {editingFlow?.flowId === column.id ? (
                    <div
                      className="schedule-flow-editor"
                      onPointerDown={(pointerEvent) => pointerEvent.stopPropagation()}
                      onClick={(clickEvent) => clickEvent.stopPropagation()}
                      onBlur={handleFlowEditorBlur}
                      onKeyDown={handleFlowEditorKeyDown}
                    >
                      <input
                        className="schedule-flow-title-input"
                        value={editingFlow.label}
                        autoFocus
                        disabled={disabled || saving}
                        placeholder={column.id}
                        onChange={(changeEvent) =>
                          setEditingFlow({ ...editingFlow, label: changeEvent.target.value })
                        }
                      />
                      <input
                        className="schedule-flow-title-input is-subtitle"
                        value={editingFlow.track}
                        disabled={disabled || saving}
                        placeholder="Подзаголовок потока"
                        onChange={(changeEvent) =>
                          setEditingFlow({ ...editingFlow, track: changeEvent.target.value })
                        }
                      />
                    </div>
                  ) : (
                    <span
                      className="schedule-flow-title"
                      onDoubleClick={(event) => startFlowRename(event, column)}
                    >
                      {column.label}
                    </span>
                  )}
                  {editingFlow?.flowId === column.id ? null : (
                    <small
                      className={
                        column.track ? "schedule-flow-subtitle" : "schedule-flow-subtitle is-empty"
                      }
                      onDoubleClick={(event) => startFlowRename(event, column)}
                    >
                      {column.track || "Подзаголовок потока"}
                    </small>
                  )}
                </div>
              ))}
            </div>
            {allowCreateFlow ? (
              <button
                type="button"
                className="schedule-flow-create-ghost"
                disabled={disabled || saving}
                onClick={startCreateFlow}
              >
                + Поток
              </button>
            ) : null}
          </div>
        </div>

        <div
          className={
            showTimeRail ? "schedule-calendar-body" : "schedule-calendar-body is-without-time-rail"
          }
          style={{
            gridTemplateColumns: calendarGridTemplateColumns,
            minWidth: `${calendarMinWidth}px`,
          }}
        >
          <div className="schedule-time-rail" style={{ height: `${gridHeight}px` }}>
            {slots.map((slot, index) => (
              <div
                key={slot.label}
                className="schedule-time-cell"
                style={{ top: `${index * safeRowHeight}px`, height: `${safeRowHeight}px` }}
              >
                {slot.label}
              </div>
            ))}
          </div>

          <div
            className="schedule-calendar-workspace"
            style={{
              gridTemplateColumns: allowCreateFlow
                ? `minmax(${gridMinWidth}px, 1fr) ${createFlowColumnWidth}px`
                : `minmax(${gridMinWidth}px, 1fr)`,
            }}
          >
            <div
              ref={gridRef}
              className={[
                "schedule-calendar-grid",
                disabled || saving ? "is-readonly" : "",
                !showAddButtons ? "is-add-hidden" : "",
                columnInteraction ? "is-reordering-columns" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{
                height: `${gridHeight}px`,
                minWidth: `${gridMinWidth}px`,
                backgroundSize: `100% ${safeRowHeight}px`,
              }}
              onClick={handleGridClick}
              onDoubleClick={() => onClearSelection?.()}
            >
              {scheduleColumns.map((column, index) => (
                <div
                  key={column.id}
                  className="schedule-calendar-column"
                  style={{
                    left: `${index * columnWidth}%`,
                    width: `${columnWidth}%`,
                  }}
                >
                  <button
                    type="button"
                    className="schedule-column-add"
                    disabled={disabled || saving}
                    aria-label={`Добавить мероприятие в поток ${column.label}`}
                    onClick={(clickEvent) => {
                      clickEvent.stopPropagation();
                      const draft = createScheduleEventDraft({
                        start: formatMinutesAsTime(range.start),
                        parallelGroup: column.id,
                        track: column.track,
                        eventTypes,
                        defaultDurationMinutes,
                      });
                      if (onSelectEmptySlot) {
                        onSelectEmptySlot(day.id, draft);
                        return;
                      }

                      onCreateEvent?.(day.id, draft);
                    }}
                  >
                    +
                  </button>
                </div>
              ))}

              {draftEvent ? (
                <div
                  className="schedule-draft-marker"
                  style={{
                    top: `${((getEventStartMinutes(draftEvent) - range.start) / safeSlotMinutes) * safeRowHeight + 4}px`,
                    height: `${Math.max(
                      ((getEventEndMinutes(draftEvent, defaultDurationMinutes) -
                        getEventStartMinutes(draftEvent)) /
                        safeSlotMinutes) *
                        safeRowHeight -
                        8,
                      safeRowHeight - 8,
                    )}px`,
                    left: `calc(${getColumnIndex(draftEvent.parallelGroup) * columnWidth}% + 6px)`,
                    width: `calc(${columnWidth}% - 12px)`,
                  }}
                >
                  Черновик
                </div>
              ) : null}

              {events.map(renderCalendarEvent)}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

export function ProgramSelector({
  programs = [],
  currentProgram,
  currentDay,
  activeEventId,
  saving = false,
  onSelectProgram,
  onSelectDay,
  onActivateEvent,
}) {
  const safePrograms = safeArray(programs).map((program, index) =>
    normalizeComponentProgram(program, index),
  );
  const safeCurrentProgram = currentProgram ? normalizeComponentProgram(currentProgram) : null;
  const safeCurrentDay = currentDay ? safeObject(currentDay) : null;
  const safeDays = safeArray(safeCurrentProgram?.days);
  const safeEvents = safeArray(safeCurrentDay?.events).map((event, index) =>
    normalizeScheduleEvent(event, index, safeCurrentDay?.id || "day"),
  );

  if (!safePrograms.length) {
    return (
      <article className="panel-card">
        <div className="feedback-card">
          <h2>Программ пока нет</h2>
          <p>Создайте первую программу под конкретное событие, чтобы добавить мероприятия.</p>
        </div>
      </article>
    );
  }

  return (
    <article className="panel-card">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Каталог программ</p>
          <h3>Каждая программа относится к отдельному событию</h3>
        </div>
      </div>

      {safePrograms.length > 1 ? (
        <Tabs
          items={safePrograms.map((program) => ({
            id: program.id,
            label: `${program.title} · ${getProgramStatusLabel(program.status)}`,
          }))}
          activeId={safeCurrentProgram?.id}
          disabled={saving}
          onChange={onSelectProgram}
        />
      ) : null}

      {safeCurrentProgram ? (
        <>
          <div className="program-context-card">
            <div className="panel-head">
              <div>
                <strong>
                  {safeCurrentProgram.eventContext?.title || safeCurrentProgram.title}
                </strong>
                <p>
                  {safeCurrentProgram.eventContext?.eventType || "Событие"} ·{" "}
                  {safeCurrentProgram.eventContext?.venue || "Локация не указана"}
                </p>
              </div>
              <StatusPill tone={getProgramStatusTone(safeCurrentProgram.status)}>
                {getProgramStatusLabel(safeCurrentProgram.status)}
              </StatusPill>
            </div>
            <p>
              {safeCurrentProgram.eventContext?.startDate || "Дата не указана"} -{" "}
              {safeCurrentProgram.eventContext?.endDate || "Дата не указана"}
            </p>
          </div>

          <Tabs
            items={safeDays.map((day) => ({
              id: day.id,
              label: `${day.label} · ${day.dateLabel}`,
            }))}
            activeId={safeCurrentDay?.id}
            onChange={onSelectDay}
          />
        </>
      ) : null}

      {safeCurrentDay ? (
        <EventTimeline
          events={safeEvents}
          activeEventId={activeEventId}
          onActivate={(eventId) =>
            safeCurrentProgram?.id && safeCurrentDay?.id
              ? onActivateEvent?.(safeCurrentProgram.id, safeCurrentDay.id, eventId)
              : null
          }
        />
      ) : null}
    </article>
  );
}

export function EventTimeline({ events = [], activeEventId, onActivate }) {
  const safeEvents = safeArray(events).map((event, index) => normalizeScheduleEvent(event, index));

  if (!safeEvents.length) {
    return (
      <div className="feedback-card">
        <h2>В этот день нет мероприятий</h2>
        <p>Добавьте мероприятие или параллельный слот в программу дня.</p>
      </div>
    );
  }

  return (
    <div className="timeline-list">
      {safeEvents.map((event) => (
        <button
          key={event.id}
          type="button"
          className={activeEventId === event.id ? "timeline-item is-active" : "timeline-item"}
          onClick={() => onActivate?.(event.id)}
        >
          <strong>{event.title}</strong>
          <span>
            {event.type} · {event.start} - {event.end}
          </span>
          <span>
            {event.speakerName || "Без спикера"} · поток {event.parallelGroup}
          </span>
        </button>
      ))}
    </div>
  );
}

function createProgramMetaForm(program = EMPTY_PROGRAM) {
  const safeProgram = normalizeComponentProgram(program);
  return {
    title: safeProgram.title || "",
    description: safeProgram.description || "",
    status: safeProgram.status || "draft",
    eventContext: {
      title: safeProgram.eventContext?.title || "",
      eventType: safeProgram.eventContext?.eventType || "Форумное событие",
      venue: safeProgram.eventContext?.venue || "",
      startDate: safeProgram.eventContext?.startDate || "",
      endDate: safeProgram.eventContext?.endDate || "",
      participantCount: safeProgram.eventContext?.participantCount || "",
      description: safeProgram.eventContext?.description || "",
    },
  };
}

export function ProgramMetaEditor({
  program = EMPTY_PROGRAM,
  saving = false,
  publishLabel = "Опубликовать программу",
  publishSavingLabel = "Публикуем...",
  publishedLabel = "Программа опубликована",
  onSave,
  onPublish,
}) {
  const safeProgram = useMemo(() => normalizeComponentProgram(program), [program]);
  const [form, setForm] = useState(() => ({
    title: safeProgram.title || "",
    description: safeProgram.description || "",
    status: safeProgram.status || "draft",
    eventContext: {
      title: safeProgram.eventContext?.title || "",
      eventType: safeProgram.eventContext?.eventType || "Форумное событие",
      venue: safeProgram.eventContext?.venue || "",
      startDate: safeProgram.eventContext?.startDate || "",
      endDate: safeProgram.eventContext?.endDate || "",
      participantCount: safeProgram.eventContext?.participantCount || "",
      description: safeProgram.eventContext?.description || "",
    },
  }));

  useEffect(() => {
    setForm({
      title: safeProgram.title || "",
      description: safeProgram.description || "",
      status: safeProgram.status || "draft",
      eventContext: {
        title: safeProgram.eventContext?.title || "",
        eventType: safeProgram.eventContext?.eventType || "Форумное событие",
        venue: safeProgram.eventContext?.venue || "",
        startDate: safeProgram.eventContext?.startDate || "",
        endDate: safeProgram.eventContext?.endDate || "",
        participantCount: safeProgram.eventContext?.participantCount || "",
        description: safeProgram.eventContext?.description || "",
      },
    });
  }, [safeProgram]);

  function updateEventContext(key, value) {
    setForm((previous) => ({
      ...previous,
      eventContext: { ...previous.eventContext, [key]: value },
    }));
  }

  const isPublished = safeProgram.status === "published";
  const showPublishAction = Boolean(onPublish) || isPublished;

  return (
    <article className="panel-card">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Событие программы</p>
          <h3>{safeProgram.eventContext?.title || safeProgram.title || "Новая программа"}</h3>
          <p className="subtle">
            {safeProgram.eventContext?.eventType || "Форумное событие"} ·{" "}
            {safeProgram.eventContext?.venue || "Локация не указана"}
          </p>
        </div>
        <div className="pill-grid">
          <StatusPill tone={getProgramStatusTone(safeProgram.status)}>
            {getProgramStatusLabel(safeProgram.status)}
          </StatusPill>
          <SoftPill>{safeProgram.days?.length || 0} дней</SoftPill>
        </div>
      </div>

      <div className="field-grid">
        <Field label="Название программы" wide>
          <input
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
          />
        </Field>
        <Field label="Событие" wide>
          <input
            value={form.eventContext.title}
            onChange={(event) => updateEventContext("title", event.target.value)}
          />
        </Field>
        <Field label="Тип события">
          <input
            value={form.eventContext.eventType}
            onChange={(event) => updateEventContext("eventType", event.target.value)}
          />
        </Field>
        <Field label="Площадка">
          <input
            value={form.eventContext.venue}
            onChange={(event) => updateEventContext("venue", event.target.value)}
          />
        </Field>
        <Field label="Дата начала">
          <input
            value={form.eventContext.startDate}
            placeholder="2026-04-24"
            onChange={(event) => updateEventContext("startDate", event.target.value)}
          />
        </Field>
        <Field label="Дата окончания">
          <input
            value={form.eventContext.endDate}
            placeholder="2026-04-26"
            onChange={(event) => updateEventContext("endDate", event.target.value)}
          />
        </Field>
        <Field label="Участников">
          <input
            value={form.eventContext.participantCount}
            onChange={(event) => updateEventContext("participantCount", event.target.value)}
          />
        </Field>
        <Field label="Статус программы">
          <select
            value={form.status}
            onChange={(event) => setForm({ ...form, status: event.target.value })}
          >
            <option value="draft">Черновик</option>
            <option value="published">Опубликована</option>
            <option value="archived">Архив</option>
          </select>
        </Field>
        <Field label="Описание программы" wide>
          <textarea
            rows={3}
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
          />
        </Field>
        <Field label="Описание события" wide>
          <textarea
            rows={3}
            value={form.eventContext.description}
            onChange={(event) => updateEventContext("description", event.target.value)}
          />
        </Field>
      </div>

      <div className="card-actions">
        <button
          type="button"
          className="primary-button"
          disabled={saving}
          onClick={() => void onSave?.(form)}
        >
          Сохранить программу
        </button>
        {showPublishAction ? (
          <button
            type="button"
            className={isPublished ? "ghost-button is-active" : "ghost-button"}
            disabled={saving || isPublished || !onPublish}
            onClick={() => void onPublish?.()}
          >
            {saving && !isPublished
              ? publishSavingLabel
              : isPublished
                ? publishedLabel
                : publishLabel}
          </button>
        ) : null}
      </div>
    </article>
  );
}

export function ProgramCreateCard({ saving = false, onCreate }) {
  const [form, setForm] = useState(createProgramDraft());

  function updateEventContext(key, value) {
    setForm((previous) => ({
      ...previous,
      eventContext: { ...previous.eventContext, [key]: value },
    }));
  }

  async function handleCreate() {
    const nextWorkspace = await onCreate?.(form);
    if (nextWorkspace) {
      setForm(createProgramDraft());
    }
  }

  return (
    <article className="panel-card">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Новая программа</p>
          <h3>Создать программу под отдельное событие</h3>
        </div>
      </div>

      <div className="field-grid">
        <Field label="Название программы" wide>
          <input
            value={form.title}
            placeholder="Например, Основная программа форума"
            onChange={(event) => setForm({ ...form, title: event.target.value })}
          />
        </Field>
        <Field label="Событие" wide>
          <input
            value={form.eventContext.title}
            placeholder="Например, Форум Истоки 2026"
            onChange={(event) => updateEventContext("title", event.target.value)}
          />
        </Field>
        <Field label="Тип события">
          <input
            value={form.eventContext.eventType}
            onChange={(event) => updateEventContext("eventType", event.target.value)}
          />
        </Field>
        <Field label="Площадка">
          <input
            value={form.eventContext.venue}
            onChange={(event) => updateEventContext("venue", event.target.value)}
          />
        </Field>
      </div>

      <button
        type="button"
        className="primary-button"
        disabled={saving}
        onClick={() => void handleCreate()}
      >
        Создать программу
      </button>
    </article>
  );
}

export function ProgramDayComposer({
  program,
  currentDay,
  saving = false,
  onCreate,
  onUpdate,
  onDelete,
}) {
  const [createForm, setCreateForm] = useState(
    () => createProgramDayFormModel(createProgramDayDraft(program)).form,
  );
  const [isCreateDateLabelAuto, setIsCreateDateLabelAuto] = useState(
    () => createProgramDayFormModel(createProgramDayDraft(program)).isAutoDateLabel,
  );
  const [editForm, setEditForm] = useState(() => createProgramDayFormModel(currentDay).form);
  const [isEditDateLabelAuto, setIsEditDateLabelAuto] = useState(
    () => createProgramDayFormModel(currentDay).isAutoDateLabel,
  );

  useEffect(() => {
    const nextModel = createProgramDayFormModel(createProgramDayDraft(program));
    setCreateForm(nextModel.form);
    setIsCreateDateLabelAuto(nextModel.isAutoDateLabel);
  }, [program]);

  useEffect(() => {
    const nextModel = createProgramDayFormModel(currentDay);
    setEditForm(nextModel.form);
    setIsEditDateLabelAuto(nextModel.isAutoDateLabel);
  }, [currentDay]);

  async function handleCreate() {
    const nextWorkspace = await onCreate?.(createForm);
    if (nextWorkspace) {
      const nextProgram =
        nextWorkspace?.programWorkspace?.programs?.find((item) => item.id === program?.id) ||
        program;
      const nextModel = createProgramDayFormModel(createProgramDayDraft(nextProgram));
      setCreateForm(nextModel.form);
      setIsCreateDateLabelAuto(nextModel.isAutoDateLabel);
    }
  }

  function handleEditDateValueChange(nextDateValue) {
    setEditForm((previous) =>
      applyProgramDayDateValue(previous, nextDateValue, isEditDateLabelAuto),
    );
  }

  function handleCreateDateValueChange(nextDateValue) {
    setCreateForm((previous) =>
      applyProgramDayDateValue(previous, nextDateValue, isCreateDateLabelAuto),
    );
  }

  function handleEditDateLabelChange(nextDateLabel) {
    const trimmedLabel = nextDateLabel.trim();
    const nextIsAuto = !trimmedLabel;
    setIsEditDateLabelAuto(nextIsAuto);
    setEditForm((previous) => ({
      ...previous,
      dateLabel: nextIsAuto ? formatProgramDayDateLabel(previous.dateValue) : nextDateLabel,
    }));
  }

  function handleCreateDateLabelChange(nextDateLabel) {
    const trimmedLabel = nextDateLabel.trim();
    const nextIsAuto = !trimmedLabel;
    setIsCreateDateLabelAuto(nextIsAuto);
    setCreateForm((previous) => ({
      ...previous,
      dateLabel: nextIsAuto ? formatProgramDayDateLabel(previous.dateValue) : nextDateLabel,
    }));
  }

  return (
    <article className="panel-card">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Дни программы</p>
          <h3>Создание и редактирование дней</h3>
        </div>
        <SoftPill>{program?.days?.length || 0} дней</SoftPill>
      </div>

      {currentDay ? (
        <>
          <p className="subtle">Редактировать выбранный день</p>
          <div className="field-grid">
            <Field label="Название дня">
              <input
                value={editForm.label}
                disabled={saving}
                onChange={(event) => setEditForm({ ...editForm, label: event.target.value })}
              />
            </Field>
            <Field label="Подпись даты">
              <input
                value={editForm.dateLabel}
                disabled={saving}
                onChange={(event) => handleEditDateLabelChange(event.target.value)}
              />
            </Field>
            <Field label="Дата">
              <input
                type="date"
                value={editForm.dateValue || ""}
                disabled={saving}
                onChange={(event) => handleEditDateValueChange(event.target.value)}
              />
            </Field>
          </div>
          <div className="card-actions">
            <button
              type="button"
              className="ghost-button"
              disabled={saving}
              onClick={() => void onUpdate?.(currentDay.id, editForm)}
            >
              Сохранить день
            </button>
            {onDelete ? (
              <button
                type="button"
                className="ghost-button is-danger"
                disabled={saving}
                onClick={() => void onDelete?.(currentDay.id)}
              >
                Удалить день
              </button>
            ) : null}
          </div>
        </>
      ) : null}

      <div className="field-grid">
        <Field label="Новый день">
          <input
            value={createForm.label}
            disabled={saving}
            onChange={(event) => setCreateForm({ ...createForm, label: event.target.value })}
          />
        </Field>
        <Field label="Подпись даты">
          <input
            value={createForm.dateLabel}
            disabled={saving}
            onChange={(event) => handleCreateDateLabelChange(event.target.value)}
          />
        </Field>
        <Field label="Дата">
          <input
            type="date"
            value={createForm.dateValue}
            disabled={saving}
            onChange={(event) => handleCreateDateValueChange(event.target.value)}
          />
        </Field>
      </div>
      <button
        type="button"
        className="primary-button"
        disabled={saving}
        onClick={() => void handleCreate()}
      >
        Добавить день
      </button>
    </article>
  );
}

export function EventEditorCard({
  event = EMPTY_EVENT,
  eventTypes = [],
  speakersCatalog = [],
  isActive = false,
  saving = false,
  onSave,
  onActivate,
}) {
  const safeEvent = useMemo(() => normalizeScheduleEvent(event), [event]);
  const [form, setForm] = useState(() => ({
    title: safeEvent.title || "",
    start: safeEvent.start || "",
    end: safeEvent.end || "",
    type: safeEvent.type || "",
    speakerId: safeEvent.speakerId || "",
    location: safeEvent.location || "",
    track: safeEvent.track || "",
    parallelGroup: safeEvent.parallelGroup || "",
    status: safeEvent.status || "planned",
    tags: normalizeList(safeEvent.tags).join(", "),
    description: safeEvent.description || "",
  }));

  useEffect(() => {
    setForm({
      title: safeEvent.title || "",
      start: safeEvent.start || "",
      end: safeEvent.end || "",
      type: safeEvent.type || "",
      speakerId: safeEvent.speakerId || "",
      location: safeEvent.location || "",
      track: safeEvent.track || "",
      parallelGroup: safeEvent.parallelGroup || "",
      status: safeEvent.status || "planned",
      tags: normalizeList(safeEvent.tags).join(", "),
      description: safeEvent.description || "",
    });
  }, [safeEvent]);

  function updateField(key, value) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  function handleSave() {
    const speakerName =
      safeArray(speakersCatalog).find((speaker) => speaker.id === form.speakerId)?.name || "";
    return onSave?.({ ...form, speakerName, tags: normalizeList(form.tags) });
  }

  return (
    <article className="panel-card organizer-event-editor">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Мероприятие</p>
          <h3>{safeEvent.title}</h3>
          <p className="subtle">
            {safeEvent.start} - {safeEvent.end} · {safeEvent.type} · поток {safeEvent.parallelGroup}
          </p>
        </div>

        <div className="pill-grid">
          <StatusPill tone={getEventStatusTone(safeEvent.status)}>
            {getEventStatusLabel(safeEvent.status)}
          </StatusPill>
          {isActive ? <SoftPill>Текущее</SoftPill> : null}
        </div>
      </div>

      <div className="field-grid">
        <Field label="Название" wide>
          <input
            value={form.title}
            onChange={(eventTarget) => updateField("title", eventTarget.target.value)}
          />
        </Field>
        <Field label="Тип мероприятия">
          <select
            value={form.type}
            onChange={(eventTarget) => updateField("type", eventTarget.target.value)}
          >
            {safeArray(eventTypes).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Спикер">
          <select
            value={form.speakerId}
            onChange={(eventTarget) => updateField("speakerId", eventTarget.target.value)}
          >
            <option value="">Без спикера</option>
            {safeArray(speakersCatalog).map((speaker) => (
              <option key={speaker.id} value={speaker.id}>
                {speaker.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Начало">
          <input
            value={form.start}
            onChange={(eventTarget) => updateField("start", eventTarget.target.value)}
          />
        </Field>
        <Field label="Окончание">
          <input
            value={form.end}
            onChange={(eventTarget) => updateField("end", eventTarget.target.value)}
          />
        </Field>
        <Field label="Локация">
          <input
            value={form.location}
            onChange={(eventTarget) => updateField("location", eventTarget.target.value)}
          />
        </Field>
        <Field label="Трек">
          <input
            value={form.track}
            onChange={(eventTarget) => updateField("track", eventTarget.target.value)}
          />
        </Field>
        <Field label="Параллель">
          <input
            value={form.parallelGroup}
            onChange={(eventTarget) => updateField("parallelGroup", eventTarget.target.value)}
          />
        </Field>
        <Field label="Теги" wide>
          <input
            value={form.tags}
            onChange={(eventTarget) => updateField("tags", eventTarget.target.value)}
          />
        </Field>
        <Field label="Описание" wide>
          <textarea
            rows={3}
            value={form.description}
            onChange={(eventTarget) => updateField("description", eventTarget.target.value)}
          />
        </Field>
      </div>

      <div className="card-actions">
        <button
          type="button"
          className="primary-button"
          disabled={saving}
          onClick={() => void handleSave()}
        >
          Сохранить мероприятие
        </button>
        <button
          type="button"
          className={isActive ? "ghost-button is-active" : "ghost-button"}
          disabled={saving}
          onClick={() => void onActivate()}
        >
          Сделать текущим
        </button>
      </div>
    </article>
  );
}

export function ParallelEventComposer({
  day,
  speakersCatalog = [],
  eventTypes = [],
  saving = false,
  onSubmit,
}) {
  const [form, setForm] = useState(() =>
    createParallelEventDraft(day, speakersCatalog, eventTypes),
  );

  useEffect(() => {
    setForm(createParallelEventDraft(day, speakersCatalog, eventTypes));
  }, [day, speakersCatalog, eventTypes]);

  function updateField(key, value) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  async function handleSubmit() {
    const speakerName =
      safeArray(speakersCatalog).find((speaker) => speaker.id === form.speakerId)?.name || "";
    await onSubmit?.({ ...form, speakerName, tags: normalizeList(form.tags) });
    setForm(createParallelEventDraft(day, speakersCatalog, eventTypes));
  }

  return (
    <article className="panel-card">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Новое мероприятие</p>
          <h3>Добавить слот в программу</h3>
        </div>
        <SoftPill>{day?.label || "День не выбран"}</SoftPill>
      </div>

      <div className="field-grid">
        <Field label="Название" wide>
          <input
            value={form.title}
            placeholder="Новая лекция или мастер-класс"
            onChange={(eventTarget) => updateField("title", eventTarget.target.value)}
          />
        </Field>
        <Field label="Тип мероприятия">
          <select
            value={form.type}
            onChange={(eventTarget) => updateField("type", eventTarget.target.value)}
          >
            {safeArray(eventTypes).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Спикер">
          <select
            value={form.speakerId}
            onChange={(eventTarget) => updateField("speakerId", eventTarget.target.value)}
          >
            <option value="">Без спикера</option>
            {safeArray(speakersCatalog).map((speaker) => (
              <option key={speaker.id} value={speaker.id}>
                {speaker.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Начало">
          <input
            value={form.start}
            onChange={(eventTarget) => updateField("start", eventTarget.target.value)}
          />
        </Field>
        <Field label="Окончание">
          <input
            value={form.end}
            onChange={(eventTarget) => updateField("end", eventTarget.target.value)}
          />
        </Field>
        <Field label="Локация">
          <input
            value={form.location}
            onChange={(eventTarget) => updateField("location", eventTarget.target.value)}
          />
        </Field>
        <Field label="Трек">
          <input
            value={form.track}
            onChange={(eventTarget) => updateField("track", eventTarget.target.value)}
          />
        </Field>
        <Field label="Параллель">
          <input
            value={form.parallelGroup}
            onChange={(eventTarget) => updateField("parallelGroup", eventTarget.target.value)}
          />
        </Field>
        <Field label="Теги" wide>
          <input
            value={form.tags}
            onChange={(eventTarget) => updateField("tags", eventTarget.target.value)}
          />
        </Field>
        <Field label="Описание" wide>
          <textarea
            rows={3}
            value={form.description}
            onChange={(eventTarget) => updateField("description", eventTarget.target.value)}
          />
        </Field>
      </div>

      <button
        type="button"
        className="primary-button"
        disabled={saving}
        onClick={() => void handleSubmit()}
      >
        Добавить мероприятие
      </button>
    </article>
  );
}

const ORGANIZER_DATA_STATE_COPY = {
  unpublished: {
    title: "Программа еще не опубликована",
    description: "Сводные графики появятся после публикации программы и первых ответов участников.",
  },
  published_empty: {
    title: "В опубликованной программе пока нет событий",
    description:
      "Сначала нужен календарь событий, потом аналитика сможет собрать рабочую картину по заезду.",
  },
  no_members: {
    title: "В заезде пока нет участников",
    description: "Назначьте участников в группы, чтобы увидеть сравнение групп и сигналы внимания.",
  },
  no_responses: {
    title: "Ответов участников пока нет",
    description:
      "Графики останутся честно пустыми, пока в дневниках и рефлексии не появятся первые записи.",
  },
};

const ORGANIZER_STATE_SEGMENTS = [
  { id: "low", label: "Низкий ресурс", color: "#6e98d8" },
  { id: "mid", label: "Баланс", color: "#7dae42" },
  { id: "high", label: "Напряжение", color: "#d97757" },
];

function formatMetricNumber(value, digits = 1) {
  if (!Number.isFinite(Number(value))) {
    return "—";
  }

  return Number(value).toFixed(digits).replace(".", ",");
}

function buildGroupDraftMap(groups = []) {
  return safeArray(groups).reduce((accumulator, group) => {
    accumulator[group.id] = {
      name: group.name || "",
      description: group.description || "",
      curatorId: group.curatorId || "",
    };
    return accumulator;
  }, {});
}

function buildGroupTrendSeries(groupPulse = [], eventPulse = []) {
  const safeEvents = safeArray(eventPulse);
  return safeArray(groupPulse).map((group, index) => ({
    id: group.id,
    label: group.name,
    color: chartPalette[index % chartPalette.length],
    data: safeEvents.map((event, eventIndex) => ({
      id: `${group.id}:${event.id}`,
      label: `${eventIndex + 1}`,
      value: Number.isFinite(Number(group.trajectory?.[eventIndex]))
        ? Number(group.trajectory[eventIndex])
        : 0,
      meta: {
        flag: Number.isFinite(Number(group.trajectory?.[eventIndex])) ? "" : "·",
      },
    })),
  }));
}

function buildGroupDistributionRows(groupPulse = []) {
  return safeArray(groupPulse).map((group) => {
    const distribution = safeArray(group.stateDistribution);
    const low = distribution
      .filter((segment) => Number(segment.level) <= 2)
      .reduce((sum, segment) => sum + Number(segment.count || 0), 0);
    const mid = distribution
      .filter((segment) => Number(segment.level) === 3)
      .reduce((sum, segment) => sum + Number(segment.count || 0), 0);
    const high = distribution
      .filter((segment) => Number(segment.level) >= 4)
      .reduce((sum, segment) => sum + Number(segment.count || 0), 0);
    const total = low + mid + high;

    return {
      id: group.id,
      label: group.name,
      total,
      segments: ORGANIZER_STATE_SEGMENTS.map((segment) => ({
        ...segment,
        value: segment.id === "low" ? low : segment.id === "mid" ? mid : high,
      })).filter((segment) => segment.value > 0),
    };
  });
}

function buildOrganizerEventDeltaRows(eventPulse = []) {
  return safeArray(eventPulse)
    .filter((event) => Number.isFinite(Number(event.deltaFromPrevious)))
    .map((event, index) => ({
      id: event.id,
      label: `${index + 1}`,
      value: Number(event.deltaFromPrevious),
      color: Number(event.deltaFromPrevious) >= 0 ? "#7dae42" : "#d97757",
      meta: {
        title: event.title,
      },
    }));
}

function buildOrganizerScatterData(participantScatter = [], groups = []) {
  const colorByGroupId = safeArray(groups).reduce((accumulator, group, index) => {
    accumulator[group.id] = chartPalette[index % chartPalette.length];
    return accumulator;
  }, {});

  return safeArray(participantScatter)
    .filter((participant) => Number.isFinite(Number(participant.avgActivation)))
    .map((participant) => ({
      ...participant,
      x: Number(participant.avgActivation),
      y: Number.isFinite(Number(participant.amplitude)) ? Number(participant.amplitude) : 0,
      shortLabel: participant.shortLabel || participant.label?.slice(0, 2)?.toUpperCase() || "У",
      color: colorByGroupId[participant.groupId] || chartPalette[0],
      size: Math.max(8, Number(participant.completion || participant.size || 0)),
    }));
}

function buildRoster(items = [], selectedGroupId = "all", query = "") {
  const normalizedQuery = String(query || "")
    .trim()
    .toLowerCase();

  return safeArray(items).filter((participant) => {
    const matchesGroup = selectedGroupId === "all" || participant.groupId === selectedGroupId;
    const matchesQuery =
      !normalizedQuery ||
      String(participant.fullName || "")
        .toLowerCase()
        .includes(normalizedQuery) ||
      String(participant.groupLabel || "")
        .toLowerCase()
        .includes(normalizedQuery);

    return matchesGroup && matchesQuery;
  });
}

function getOrganizerDataStateCard(dataState) {
  return ORGANIZER_DATA_STATE_COPY[dataState] || null;
}

export function GroupsSummary({
  groups = [],
  alerts = [],
  audiencePool = [],
  curatorCandidates = [],
  dataState = "ready",
  eventPulse = [],
  groupPulse = [],
  participantScatter = [],
  operationalBrief = [],
  saving = false,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
  onAssignCurator,
  onAssignParticipants,
}) {
  const safeGroups = safeArray(groups);
  const safeAlerts = safeArray(alerts);
  const safeAudiencePool = safeArray(audiencePool);
  const safeCuratorCandidates = safeArray(curatorCandidates);
  const safeEventPulse = safeArray(eventPulse);
  const safeGroupPulse = safeArray(groupPulse);
  const safeOperationalBrief = safeArray(operationalBrief);
  const [createDraft, setCreateDraft] = useState({ name: "", description: "" });
  const [groupDrafts, setGroupDrafts] = useState(() => buildGroupDraftMap(safeGroups));
  const [rosterGroupId, setRosterGroupId] = useState("all");
  const [rosterQuery, setRosterQuery] = useState("");
  const [selectedParticipantIds, setSelectedParticipantIds] = useState([]);
  const [targetGroupId, setTargetGroupId] = useState(safeGroups[0]?.id || "");
  const dataStateCard = getOrganizerDataStateCard(dataState);

  useEffect(() => {
    setGroupDrafts((previous) => {
      const next = buildGroupDraftMap(safeGroups);
      Object.entries(previous || {}).forEach(([groupId, draft]) => {
        if (next[groupId]) {
          next[groupId] = { ...next[groupId], ...draft };
        }
      });
      return next;
    });
  }, [safeGroups]);

  useEffect(() => {
    if (!safeGroups.some((group) => group.id === targetGroupId)) {
      setTargetGroupId(safeGroups[0]?.id || "");
    }
  }, [safeGroups, targetGroupId]);

  const groupsWithProfiles = useMemo(
    () =>
      safeGroups.map((group) => {
        const groupParticipants = safeAudiencePool.filter(
          (participant) => participant.groupId === group.id,
        );
        return {
          ...group,
          topProfiles: Array.from(
            new Set(
              groupParticipants.map((participant) => participant.emotionalProfile).filter(Boolean),
            ),
          ).slice(0, 3),
          participantsList: groupParticipants.slice(0, 4),
        };
      }),
    [safeAudiencePool, safeGroups],
  );
  const trendSeries = useMemo(
    () => buildGroupTrendSeries(safeGroupPulse, safeEventPulse),
    [safeEventPulse, safeGroupPulse],
  );
  const distributionRows = useMemo(
    () => buildGroupDistributionRows(safeGroupPulse).filter((row) => row.total > 0),
    [safeGroupPulse],
  );
  const eventDeltaRows = useMemo(
    () => buildOrganizerEventDeltaRows(safeEventPulse),
    [safeEventPulse],
  );
  const scatterData = useMemo(
    () => buildOrganizerScatterData(participantScatter, safeGroups),
    [participantScatter, safeGroups],
  );
  const roster = useMemo(
    () => buildRoster(safeAudiencePool, rosterGroupId, rosterQuery),
    [rosterGroupId, rosterQuery, safeAudiencePool],
  );
  const attentionCards = safeOperationalBrief.length
    ? safeOperationalBrief
    : safeAlerts.map((alert) => ({
        id: alert.id,
        title: alert.title,
        evidence: alert.detail,
        severity: alert.severity,
      }));

  function updateGroupDraft(groupId, patch) {
    setGroupDrafts((previous) => ({
      ...previous,
      [groupId]: {
        ...(previous[groupId] || {}),
        ...patch,
      },
    }));
  }

  function toggleParticipantSelection(participantId) {
    setSelectedParticipantIds((previous) =>
      previous.includes(participantId)
        ? previous.filter((value) => value !== participantId)
        : [...previous, participantId],
    );
  }

  async function handleCreateGroup() {
    if (!createDraft.name.trim()) {
      return;
    }

    const nextWorkspace = await onCreateGroup?.(createDraft);
    if (nextWorkspace) {
      setCreateDraft({ name: "", description: "" });
    }
  }

  async function handleSaveGroup(groupId) {
    const draft = groupDrafts[groupId];
    if (!draft?.name?.trim()) {
      return;
    }

    await onUpdateGroup?.(groupId, {
      name: draft.name,
      description: draft.description,
    });
  }

  async function handleSaveCurator(groupId) {
    const draft = groupDrafts[groupId];
    await onAssignCurator?.(groupId, draft?.curatorId || "");
  }

  async function handleDelete(group) {
    const confirmed =
      typeof window === "undefined" ||
      window.confirm(
        `Удалить группу "${group.name}"? Это действие доступно только для пустой группы без куратора.`,
      );
    if (!confirmed) {
      return;
    }

    await onDeleteGroup?.(group.id);
  }

  async function handleMoveParticipants() {
    if (!targetGroupId || !selectedParticipantIds.length) {
      return;
    }

    const targetGroup = safeGroups.find((group) => group.id === targetGroupId);
    const confirmed =
      typeof window === "undefined" ||
      window.confirm(
        `Перенести ${selectedParticipantIds.length} участников в ${targetGroup?.name || "выбранную группу"}?\n\nИсторическая групповая аналитика пересчитается по новой группе.`,
      );
    if (!confirmed) {
      return;
    }

    const nextWorkspace = await onAssignParticipants?.(targetGroupId, selectedParticipantIds);
    if (nextWorkspace) {
      setSelectedParticipantIds([]);
    }
  }

  return (
    <div className="organizer-section-stack">
      {dataStateCard ? (
        <article className="panel-card organizer-state-card">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Состояние данных</p>
              <h3>{dataStateCard.title}</h3>
            </div>
          </div>
          <p className="subtle">{dataStateCard.description}</p>
        </article>
      ) : null}

      <article className="panel-card">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Операционный cockpit</p>
            <h3>Группы, риски и ритм заезда на реальных данных</h3>
          </div>
          <SoftPill>{safeGroups.length} групп</SoftPill>
        </div>

        <div className="organizer-analytics-grid">
          <MultiLineTrendChart
            title="Пульс групп по событиям"
            description="Каждая линия показывает, как меняется среднее состояние группы по ходу программы."
            series={trendSeries}
            labels={safeEventPulse.map((event, index) => `${index + 1}`)}
            emptyLabel="Недостаточно ответов для сравнения траекторий групп."
          />
          <EventImpactBarChart
            title="Резкие переходы программы"
            description="Сдвиг среднего состояния относительно предыдущего события с ответами."
            data={eventDeltaRows}
            emptyLabel="Пока нет переходов, которые можно посчитать по событиям."
          />
          <StackedDistributionChart
            title="Распределение состояний по группам"
            description="Чем шире сегмент, тем больше реальных ответов этой зоны внутри группы."
            rows={distributionRows}
            emptyLabel="Нет ответов для распределения по группам."
          />
          <RiskScatterChart
            title="Участники: среднее состояние, амплитуда и заполнение"
            description="Размер точки = заполнение, цвет = текущая группа."
            data={scatterData}
            emptyLabel="Пока нет участнических траекторий для scatter-графика."
          />
        </div>
      </article>

      <article className="panel-card">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Сигналы внимания</p>
            <h3>Что стоит обсудить с кураторами и оргкомандой первым делом</h3>
          </div>
        </div>

        <div className="alert-list">
          {attentionCards.length ? (
            attentionCards.map((item) => (
              <AlertCard
                key={item.id}
                title={item.title}
                detail={item.evidence || item.detail}
                tone={getSeverityTone(item.severity)}
              />
            ))
          ) : (
            <p className="subtle">Пока нет подтвержденных сигналов внимания.</p>
          )}
        </div>
      </article>

      <article className="panel-card">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Распределение по группам</p>
            <h3>Ручное и batch-распределение участников</h3>
          </div>
          <SoftPill outline>{selectedParticipantIds.length} выбрано</SoftPill>
        </div>

        <div className="field-grid">
          <Field label="Фильтр по текущей группе">
            <select
              value={rosterGroupId}
              onChange={(eventTarget) => setRosterGroupId(eventTarget.target.value)}
            >
              <option value="all">Все группы</option>
              {safeGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Поиск по участникам" wide>
            <input
              value={rosterQuery}
              placeholder="Например: Анна, группа 2"
              onChange={(eventTarget) => setRosterQuery(eventTarget.target.value)}
            />
          </Field>
          <Field label="Перенести в группу">
            <select
              value={targetGroupId}
              onChange={(eventTarget) => setTargetGroupId(eventTarget.target.value)}
            >
              <option value="">Выберите группу</option>
              {safeGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <p className="subtle organizer-policy-note">
          Перенос участника работает ретроактивно: историческая групповая аналитика пересчитывается
          по новой группе.
        </p>

        <div className="organizer-roster-list">
          {roster.map((participant) => {
            const checked = selectedParticipantIds.includes(participant.id);
            return (
              <label
                key={participant.id}
                className={checked ? "organizer-roster-row is-selected" : "organizer-roster-row"}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleParticipantSelection(participant.id)}
                />
                <div>
                  <strong>{participant.fullName}</strong>
                  <span>
                    {participant.groupLabel || "Без группы"} ·{" "}
                    {participant.progress?.completion ?? 0}% заполнения
                  </span>
                </div>
              </label>
            );
          })}
        </div>

        <div className="card-actions">
          <button
            type="button"
            className="primary-button"
            disabled={saving || !targetGroupId || !selectedParticipantIds.length}
            onClick={() => void handleMoveParticipants()}
          >
            Перенести выбранных
          </button>
        </div>
      </article>

      <article className="panel-card">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Новая группа</p>
            <h3>Создать рабочую группу для заезда</h3>
          </div>
        </div>

        <div className="field-grid">
          <Field label="Название группы">
            <input
              value={createDraft.name}
              placeholder="Например: Северный круг"
              onChange={(eventTarget) =>
                setCreateDraft((previous) => ({ ...previous, name: eventTarget.target.value }))
              }
            />
          </Field>
          <Field label="Фокус группы" wide>
            <textarea
              rows={3}
              value={createDraft.description}
              placeholder="Коротко: чем отличается группа и на что смотреть в динамике."
              onChange={(eventTarget) =>
                setCreateDraft((previous) => ({
                  ...previous,
                  description: eventTarget.target.value,
                }))
              }
            />
          </Field>
        </div>

        <div className="card-actions">
          <button
            type="button"
            className="primary-button"
            disabled={saving || !createDraft.name.trim()}
            onClick={() => void handleCreateGroup()}
          >
            Создать группу
          </button>
        </div>
      </article>
      <article className="panel-card">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Группы</p>
            <h3>Сводка по кураторам и состоянию группы</h3>
          </div>
        </div>

        <div className="group-compare-grid">
          {groupsWithProfiles.map((group) => (
            <div key={group.id} className="compare-card">
              <div className="compare-head">
                <div>
                  <strong>{group.name}</strong>
                  <p>{group.curator}</p>
                </div>
                <SoftPill>{group.completion}% заполнения</SoftPill>
              </div>

              <div className="compare-metrics">
                <MetricBadge label="Участников" value={group.participants} compact />
                <MetricBadge label="Средняя активация" value={group.avgActivation} compact />
                <MetricBadge label="Рисков" value={group.riskCases} compact />
              </div>

              <p className="lead-text">{group.focus}</p>

              <div className="tag-row">
                {group.topProfiles.map((profile) => (
                  <span key={profile} className="tag-chip">
                    {profile}
                  </span>
                ))}
              </div>

              <div className="field-grid">
                <Field label="Название группы">
                  <input
                    value={groupDrafts[group.id]?.name || group.name || ""}
                    onChange={(eventTarget) =>
                      updateGroupDraft(group.id, { name: eventTarget.target.value })
                    }
                  />
                </Field>
                <Field label="Куратор">
                  <select
                    value={groupDrafts[group.id]?.curatorId || ""}
                    onChange={(eventTarget) =>
                      updateGroupDraft(group.id, { curatorId: eventTarget.target.value })
                    }
                  >
                    <option value="">Не назначен</option>
                    {safeCuratorCandidates.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.fullName}
                        {candidate.assignedGroupId && candidate.assignedGroupId !== group.id
                          ? ` — сейчас ${candidate.assignedGroupName}`
                          : ""}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Описание / фокус" wide>
                  <textarea
                    rows={3}
                    value={groupDrafts[group.id]?.description || group.description || ""}
                    onChange={(eventTarget) =>
                      updateGroupDraft(group.id, { description: eventTarget.target.value })
                    }
                  />
                </Field>
              </div>

              {group.participantsList?.length ? (
                <div className="organizer-inline-roster">
                  {group.participantsList.map((participant) => (
                    <span key={participant.id} className="tag-chip">
                      {participant.fullName}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="card-actions">
                <button
                  type="button"
                  className="primary-button"
                  disabled={saving || !String(groupDrafts[group.id]?.name || "").trim()}
                  onClick={() => void handleSaveGroup(group.id)}
                >
                  Сохранить группу
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  disabled={saving}
                  onClick={() => void handleSaveCurator(group.id)}
                >
                  Назначить куратора
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  disabled={saving || group.participants > 0 || Boolean(group.curatorId)}
                  onClick={() => void handleDelete(group)}
                >
                  Удалить
                </button>
              </div>
            </div>
          ))}
        </div>
      </article>

      <article className="panel-card">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Сигналы внимания</p>
            <h3>Куда смотреть в первую очередь</h3>
          </div>
        </div>

        <div className="alert-list">
          {safeAlerts.map((alert) => (
            <AlertCard
              key={alert.id}
              title={alert.title}
              detail={alert.detail}
              tone={getSeverityTone(alert.severity)}
            />
          ))}
        </div>
      </article>
    </div>
  );
}

export function ParticipantSearchPanel({
  groups = [],
  participants = [],
  selectedGroupId = "all",
  query = "",
  selectedParticipantId,
  onGroupChange,
  onQueryChange,
  onSelectParticipant,
}) {
  const safeGroups = safeArray(groups);
  const safeParticipants = safeArray(participants);

  return (
    <article className="panel-card">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Фильтры</p>
          <h3>Поиск по участникам</h3>
        </div>
      </div>

      <div className="field-grid">
        <Field label="Группа">
          <select
            value={selectedGroupId}
            onChange={(eventTarget) => onGroupChange?.(eventTarget.target.value)}
          >
            <option value="all">Все группы</option>
            {safeGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Поиск по имени или профилю" wide>
          <input
            value={query}
            placeholder="Например: Анна, moratorium, ресурсный"
            onChange={(eventTarget) => onQueryChange?.(eventTarget.target.value)}
          />
        </Field>
      </div>

      <div className="participant-list">
        {safeParticipants.map((participant) => (
          <button
            key={participant.id}
            type="button"
            className={
              selectedParticipantId === participant.id
                ? "participant-row is-active"
                : "participant-row"
            }
            onClick={() => onSelectParticipant?.(participant.id)}
          >
            <strong>{participant.fullName}</strong>
            <span>
              {participant.groupLabel} · {participant.emotionalProfile}
            </span>
          </button>
        ))}
      </div>
    </article>
  );
}

export function ParticipantDetailsCard({
  participant,
  groups = [],
  saving = false,
  onAssignGroup,
}) {
  const safeGroups = safeArray(groups);
  const [draftGroupId, setDraftGroupId] = useState(participant?.groupId || "");

  useEffect(() => {
    setDraftGroupId(participant?.groupId || "");
  }, [participant?.groupId, participant?.id]);

  async function handleAssignGroup() {
    if (!participant?.id || !draftGroupId || draftGroupId === participant.groupId) {
      return;
    }

    const targetGroup = safeGroups.find((group) => group.id === draftGroupId);
    const confirmed =
      typeof window === "undefined" ||
      window.confirm(
        `Перенести ${participant.fullName} в ${targetGroup?.name || "новую группу"}?\n\nИсторическая групповая аналитика пересчитается по новой группе.`,
      );
    if (!confirmed) {
      return;
    }

    await onAssignGroup?.(draftGroupId, [participant.id]);
  }

  return (
    <article className="panel-card">
      {participant ? (
        <>
          <div className="panel-head">
            <div>
              <p className="eyebrow">Карточка участника</p>
              <h3>{participant.fullName}</h3>
              <p className="subtle">{participant.groupLabel}</p>
            </div>
            <SoftPill>
              {participant.age || "возраст не указан"} · {participant.gender || "пол не указан"}
            </SoftPill>
          </div>

          <div className="hero-stats">
            <MetricBadge
              label="Эмоциональный профиль"
              value={participant.emotionalProfile || "Не рассчитан"}
            />
            <MetricBadge
              label="Статус идентичности"
              value={participant.identityStatus || "Не пройден"}
            />
            <MetricBadge label="Заполнено" value={`${participant.progress?.completion ?? 0}%`} />
            <MetricBadge label="Средняя активация" value={participant.avgActivation || "0.0"} />
          </div>

          <div className="participant-detail-grid">
            <div className="theme-chip-card">
              <strong>Контекст участия</strong>
              <p>
                Участник относится к конкретной группе и связан с мероприятиями выбранной программы.
              </p>
            </div>
            <div className="theme-chip-card">
              <strong>Что смотреть дальше</strong>
              <p>
                Следующий шаг — связать карточку с реальными дневниковыми записями и посещёнными
                мероприятиями.
              </p>
            </div>
          </div>
        </>
      ) : (
        <div className="feedback-card">
          <h2>Участники не найдены</h2>
          <p>Смените фильтр группы или очистите поисковый запрос.</p>
        </div>
      )}
    </article>
  );
}
