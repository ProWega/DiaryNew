import { useEffect, useState } from "react";
import Field from "../ui/Field";
import { SoftPill } from "../ui/Pills";
import { normalizeList } from "../../lib/organizerWorkspace";
import { safeArray } from "./_helpers";
import { createParallelEventDraft } from "./programDrafts";

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
