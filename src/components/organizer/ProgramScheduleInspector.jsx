import { useEffect, useState } from "react";
import { AlertCard, StatusPill } from "../ui/Pills";
import { getProgramStatusLabel, getProgramStatusTone } from "../../lib/organizerWorkspace";
import {
  DEFAULT_EVENT_STATUS_OPTIONS,
  normalizeEventFormValue,
  safeArray,
  validateScheduleCandidate,
} from "./_helpers";
import { ProgramEventForm } from "./ProgramEventForm";
import EventConceptsPanel from "./EventConceptsPanel";

export function ProgramScheduleInspector({
  mode = "empty",
  program,
  day,
  event,
  draftEvent,
  sessionId,
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

      {effectiveMode === "edit" && sessionId && event?.id ? (
        <EventConceptsPanel sessionId={sessionId} eventId={event.id} disabled={disabled} />
      ) : null}
    </article>
  );
}
