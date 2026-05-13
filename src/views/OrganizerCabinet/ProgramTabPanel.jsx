import { AccessToggle } from "../../components/access/AccessComponents";
import { AlertCard } from "../../components/ui/Pills";
import {
  ProgramCreateCard,
  ProgramScheduleInspector,
  ProgramScheduleTable,
  ProgramScheduleToolbar,
  ReflectionQuestionEditor,
} from "../../components/organizer/index";
import ProgramTableErrorBoundary from "./ProgramTableErrorBoundary";

function ProgramTabPanel({
  programWorkspace,
  sessionId,
  currentProgram,
  currentDay,
  currentFlowColumns,
  scheduleSlotMinutes,
  defaultEventDurationMinutes,
  saving,
  dayReflectionQuestions,
  selectedScheduleEventId,
  scheduleDraftEvent,
  scheduleInspectorMode,
  selectedScheduleEvent,
  participantEventAccessMode,
  onSelectProgram,
  onSelectDay,
  onCreateDay,
  onDeleteDay,
  onPublishProgram,
  onDraftProgram,
  onParticipantEventAccessModeChange,
  onDayReflectionQuestionsChange,
  onDayReflectionSave,
  onSelectEvent,
  onSelectEmptySlot,
  onClearSelection,
  onReorderColumns,
  onCreateFlow,
  onRenameFlow,
  onUpdateFlows,
  onActivateEvent,
  onUpdateEvent,
  onSaveEvent,
  onCreateEvent,
  onCancelInspector,
  onCreateProgram,
}) {
  function renderTableFallback(error) {
    return (
      <article className="panel-card program-table-fallback">
        <AlertCard
          title="Табличный вид временно недоступен"
          detail={error?.message || "Не удалось отрисовать календарную сетку программы."}
          tone="severity-high"
        />
      </article>
    );
  }

  const eventTypes = programWorkspace.reference?.eventTypes || [];
  const speakersCatalog = programWorkspace.speakersCatalog || [];

  return (
    <div className="organizer-section-stack">
      <ProgramTableErrorBoundary
        resetKey={`${currentProgram?.id || "none"}:${currentDay?.id || "none"}`}
        fallback={renderTableFallback}
      >
        <ProgramScheduleToolbar
          programs={programWorkspace.programs}
          currentProgram={currentProgram}
          currentDay={currentDay}
          slotMinutes={scheduleSlotMinutes}
          saving={saving}
          onSelectProgram={onSelectProgram}
          onSelectDay={onSelectDay}
          onCreateDay={onCreateDay}
          onDeleteDay={onDeleteDay}
          onPublishProgram={onPublishProgram}
          onDraftProgram={onDraftProgram}
        />

        <article className="panel-card organizer-program-access-card">
          <div>
            <p className="eyebrow">Доступ участников</p>
            <h3>Доступны только прошедшие события</h3>
            <p className="subtle">
              Когда режим включён, участник может поставить состояние только после начала события по
              дате и времени программы. Будущие события останутся в списке с замком.
            </p>
          </div>
          <AccessToggle
            checked={participantEventAccessMode === "from_start_time"}
            disabled={saving}
            onLabel="Включено"
            offLabel="Выключено"
            onChange={(checked) => void onParticipantEventAccessModeChange(checked)}
          />
        </article>

        {currentDay ? (
          <article className="panel-card organizer-program-access-card">
            <div>
              <p className="eyebrow">Рефлексия дня</p>
              <h3>Вопросы для итогов выбранного дня</h3>
              <p className="subtle">
                Эти вопросы появятся в participant view в блоке «Итог дня». Если список пустой,
                используется стандартный набор.
              </p>
            </div>
            <div className="organizer-day-reflection-editor">
              <ReflectionQuestionEditor
                value={dayReflectionQuestions}
                disabled={saving}
                title={`${currentDay.label || "День"}${currentDay.dateLabel ? ` · ${currentDay.dateLabel}` : ""}`}
                emptyLabel="Будут показаны стандартные вопросы"
                onChange={onDayReflectionQuestionsChange}
              />
              <div className="card-actions">
                <button
                  type="button"
                  className="primary-button"
                  disabled={saving}
                  onClick={() => void onDayReflectionSave()}
                >
                  Сохранить вопросы дня
                </button>
              </div>
            </div>
          </article>
        ) : null}

        <div className="organizer-table-mode-grid">
          <ProgramScheduleTable
            program={currentProgram}
            day={currentDay}
            slotMinutes={scheduleSlotMinutes}
            defaultDurationMinutes={defaultEventDurationMinutes}
            minDurationMinutes={scheduleSlotMinutes}
            columns={currentFlowColumns}
            flows={currentFlowColumns}
            columnOrder={currentDay?.flowOrder}
            allowColumnReorder
            allowCreateFlow
            clearSelectionOnEmptyClick
            createOnEmptyClickWhenIdle
            selectedEventId={selectedScheduleEventId}
            draftEvent={scheduleDraftEvent}
            eventTypes={eventTypes}
            speakersCatalog={speakersCatalog}
            saving={saving}
            onSelectEvent={onSelectEvent}
            onSelectEmptySlot={onSelectEmptySlot}
            onClearSelection={onClearSelection}
            onReorderColumns={onReorderColumns}
            onCreateFlow={onCreateFlow}
            onRenameFlow={onRenameFlow}
            onUpdateFlows={onUpdateFlows}
            onActivateEvent={onActivateEvent}
            onUpdateEvent={onUpdateEvent}
          />

          <div className="organizer-table-side">
            {currentProgram ? (
              <ProgramScheduleInspector
                mode={scheduleInspectorMode}
                program={currentProgram}
                day={currentDay}
                event={selectedScheduleEvent}
                draftEvent={scheduleDraftEvent}
                sessionId={sessionId}
                eventTypes={eventTypes}
                speakersCatalog={speakersCatalog}
                parallelGroupOptions={currentFlowColumns}
                allowNewParallelGroup
                saving={saving}
                minDurationMinutes={scheduleSlotMinutes}
                onSaveEvent={onSaveEvent}
                onCreateEvent={onCreateEvent}
                onCancel={onCancelInspector}
              />
            ) : (
              <ProgramCreateCard saving={saving} onCreate={onCreateProgram} />
            )}
          </div>
        </div>
      </ProgramTableErrorBoundary>
    </div>
  );
}

export default ProgramTabPanel;
