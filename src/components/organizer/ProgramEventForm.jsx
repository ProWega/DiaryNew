import { useEffect, useState } from "react";
import Field from "../ui/Field";
import {
  DEFAULT_EVENT_STATUS_OPTIONS,
  normalizeEventFormValue,
  normalizeEventPayload,
  normalizeStatusOptions,
  safeArray,
  sortColumnsByOrder,
  normalizeColumnDefinition,
} from "./_helpers";
import { ReflectionQuestionEditor } from "./ReflectionQuestionEditor";

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
