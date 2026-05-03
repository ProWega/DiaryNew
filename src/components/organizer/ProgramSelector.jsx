import Tabs from "../ui/Tabs";
import { StatusPill } from "../ui/Pills";
import { getProgramStatusLabel, getProgramStatusTone } from "../../lib/organizerWorkspace";
import {
  normalizeComponentProgram,
  normalizeScheduleEvent,
  safeArray,
  safeObject,
} from "./_helpers";
import { EventTimeline } from "./EventTimeline";

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
