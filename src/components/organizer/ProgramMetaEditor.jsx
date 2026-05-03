import { useEffect, useMemo, useState } from "react";
import Field from "../ui/Field";
import { StatusPill, SoftPill } from "../ui/Pills";
import { getProgramStatusLabel, getProgramStatusTone } from "../../lib/organizerWorkspace";
import { EMPTY_PROGRAM, normalizeComponentProgram } from "./_helpers";

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
