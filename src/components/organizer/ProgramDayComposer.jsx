import { useEffect, useState } from "react";
import Field from "../ui/Field";
import { SoftPill } from "../ui/Pills";
import { formatProgramDayDateLabel } from "../../lib/programDays";
import { applyProgramDayDateValue, createProgramDayFormModel } from "./_helpers";
import { createProgramDayDraft } from "./programDrafts";

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
