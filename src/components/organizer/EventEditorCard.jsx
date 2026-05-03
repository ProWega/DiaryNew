import { useEffect, useMemo, useState } from "react";
import Field from "../ui/Field";
import { StatusPill, SoftPill } from "../ui/Pills";
import { getEventStatusLabel, getEventStatusTone } from "../../lib/organizerWorkspace";
import { normalizeList } from "../../lib/organizerWorkspace";
import { EMPTY_EVENT, normalizeScheduleEvent, safeArray } from "./_helpers";

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
