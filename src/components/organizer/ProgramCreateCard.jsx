import { useState } from "react";
import Field from "../ui/Field";
import { createProgramDraft } from "./programDrafts";

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
