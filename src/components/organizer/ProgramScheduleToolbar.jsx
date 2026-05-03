import Field from "../ui/Field";
import { StatusPill } from "../ui/Pills";
import { getProgramStatusLabel, getProgramStatusTone } from "../../lib/organizerWorkspace";
import { normalizeComponentProgram, safeArray, safeObject } from "./_helpers";
import { ProgramDayTabs } from "./ProgramDayTabs";

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
