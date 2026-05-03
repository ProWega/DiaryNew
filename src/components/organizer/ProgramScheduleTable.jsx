import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCard, SoftPill } from "../ui/Pills";
import {
  clamp,
  createEventTimePatch,
  createScheduleEventDraft,
  formatMinutesAsTime,
  parseTimeToMinutes,
  ceilToStep,
  floorToStep,
  getEventEndMinutes,
  getEventStartMinutes,
  getNextFlowId,
  getSafeRowHeight,
  getSafeSize,
  getSafeSlotMinutes,
  getStableParallelColumns,
  isDuplicateFlowLabel,
  moveListItem,
  normalizeColumnDefinition,
  normalizeInlineEditableFields,
  normalizeScheduleEvent,
  safeArray,
  validateScheduleCandidate,
} from "./_helpers";

export function ProgramScheduleTable({
  program,
  day,
  slotMinutes = 15,
  defaultDurationMinutes = 60,
  rowHeight = 48,
  minDurationMinutes,
  columnMinWidth = 220,
  timeColumnWidth = 86,
  showAddButtons = true,
  allowDrag = true,
  allowResize = true,
  showTimeRail = true,
  emptyState,
  conflictMessage,
  timeStart,
  timeEnd,
  columns,
  flows,
  columnOrder,
  allowColumnReorder = false,
  allowCreateFlow = true,
  clearSelectionOnEmptyClick = true,
  createOnEmptyClickWhenIdle = true,
  inlineEditableFields,
  calendarMaxHeight = "min(72vh, 760px)",
  calendarMinHeight = 320,
  stickyHeader = true,
  selectedEventId,
  draftEvent,
  disabled = false,
  saving = false,
  eventTypes = [],
  speakersCatalog = [],
  renderEvent,
  onCreateEvent,
  onUpdateEvent,
  onSelectEvent,
  onSelectEmptySlot,
  onClearSelection,
  onReorderColumns,
  onCreateFlow,
  onRenameFlow,
  onUpdateFlows,
  onActivateEvent,
}) {
  const gridRef = useRef(null);
  const headerColumnsRef = useRef(null);
  const [calendarError, setCalendarError] = useState("");
  const [interaction, setInteraction] = useState(null);
  const [interactionPreview, setInteractionPreview] = useState(null);
  const [columnInteraction, setColumnInteraction] = useState(null);
  const [columnPreviewOrder, setColumnPreviewOrder] = useState(null);
  const [draftFlow, setDraftFlow] = useState(null);
  const [editingFlow, setEditingFlow] = useState(null);
  const [inlineEdit, setInlineEdit] = useState(null);
  const events = useMemo(
    () =>
      safeArray(day?.events)
        .map((event, index) => normalizeScheduleEvent(event, index, day?.id || "day"))
        .sort(
          (first, second) =>
            getEventStartMinutes(first) - getEventStartMinutes(second) ||
            (first.parallelGroup || "").localeCompare(second.parallelGroup || "", "ru", {
              numeric: true,
            }),
        ),
    [day],
  );
  const scheduleColumns = useMemo(() => {
    const sourceColumns = safeArray(flows !== undefined ? flows : columns);
    const columnsWithDraft =
      draftFlow &&
      !sourceColumns.some((column) => normalizeColumnDefinition(column).id === draftFlow.id)
        ? [...sourceColumns, draftFlow]
        : sourceColumns;
    return getStableParallelColumns(events, columnsWithDraft, columnPreviewOrder || columnOrder);
  }, [columnOrder, columnPreviewOrder, columns, draftFlow, events, flows]);
  const editableFields = useMemo(
    () => normalizeInlineEditableFields(inlineEditableFields),
    [inlineEditableFields],
  );
  const safeSlotMinutes = getSafeSlotMinutes(slotMinutes);
  const safeRowHeight = getSafeRowHeight(rowHeight);
  const safeMinDuration = getSafeSlotMinutes(minDurationMinutes || safeSlotMinutes);
  const safeColumnMinWidth = Math.max(140, getSafeSize(columnMinWidth, 220));
  const safeTimeColumnWidth = Math.max(56, getSafeSize(timeColumnWidth, 86));
  const columnCount = Math.max(scheduleColumns.length, 1);
  const columnWidth = 100 / columnCount;
  const gridMinWidth = columnCount * safeColumnMinWidth;
  const createFlowColumnWidth = allowCreateFlow
    ? Math.max(150, Math.min(safeColumnMinWidth, 190))
    : 0;
  const scheduleAreaMinWidth = gridMinWidth + createFlowColumnWidth;
  const calendarMinWidth = scheduleAreaMinWidth + (showTimeRail ? safeTimeColumnWidth : 0);
  const calendarGridTemplateColumns = showTimeRail
    ? `${safeTimeColumnWidth}px minmax(${scheduleAreaMinWidth}px, 1fr)`
    : `minmax(${scheduleAreaMinWidth}px, 1fr)`;

  useEffect(() => {
    setDraftFlow(null);
    setEditingFlow(null);
    setInlineEdit(null);
  }, [day?.id]);

  const range = useMemo(() => {
    const explicitStart = parseTimeToMinutes(timeStart);
    const explicitEnd = parseTimeToMinutes(timeEnd);

    if (explicitStart !== null && explicitEnd !== null && explicitEnd > explicitStart) {
      return { start: explicitStart, end: explicitEnd };
    }

    if (!events.length) {
      return { start: 9 * 60, end: 18 * 60 };
    }

    const starts = events.map(getEventStartMinutes);
    const ends = events.map((event) => getEventEndMinutes(event, defaultDurationMinutes));
    const minStart = Math.min(...starts);
    const maxEnd = Math.max(...ends);

    return {
      start: Math.max(0, floorToStep(minStart - safeSlotMinutes, safeSlotMinutes)),
      end: Math.min(24 * 60, ceilToStep(maxEnd + safeSlotMinutes, safeSlotMinutes)),
    };
  }, [defaultDurationMinutes, events, safeSlotMinutes, timeEnd, timeStart]);

  const slots = useMemo(() => {
    const result = [];
    for (let minutes = range.start; minutes < range.end; minutes += safeSlotMinutes) {
      result.push({ minutes, label: formatMinutesAsTime(minutes) });
    }
    return result;
  }, [range.end, range.start, safeSlotMinutes]);

  const gridHeight = Math.max(slots.length * safeRowHeight, safeRowHeight);

  function getColumnIndex(parallelGroup) {
    const index = scheduleColumns.findIndex((column) => column.id === (parallelGroup || "A"));
    return index >= 0 ? index : 0;
  }

  function getDraftFromPoint(pointerEvent) {
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) {
      return null;
    }

    const relativeX = clamp(pointerEvent.clientX - rect.left, 0, Math.max(rect.width - 1, 0));
    const relativeY = clamp(pointerEvent.clientY - rect.top, 0, Math.max(rect.height - 1, 0));
    const columnIndex = clamp(
      Math.floor(relativeX / (rect.width / columnCount)),
      0,
      columnCount - 1,
    );
    const slotIndex = clamp(Math.floor(relativeY / safeRowHeight), 0, slots.length - 1);
    const start = range.start + slotIndex * safeSlotMinutes;
    const column = scheduleColumns[columnIndex] || scheduleColumns[0] || { id: "A", track: "" };

    return createScheduleEventDraft({
      start: formatMinutesAsTime(start),
      parallelGroup: column.id,
      track: column.track,
      eventTypes,
      defaultDurationMinutes,
    });
  }

  function handleGridClick(pointerEvent) {
    if (!day || disabled || saving || pointerEvent.target.closest?.(".schedule-calendar-event")) {
      return;
    }

    if (clearSelectionOnEmptyClick && (selectedEventId || draftEvent)) {
      setCalendarError("");
      onClearSelection?.();
      return;
    }

    if (!createOnEmptyClickWhenIdle) {
      return;
    }

    const draft = getDraftFromPoint(pointerEvent);
    if (draft) {
      setCalendarError("");
      if (onSelectEmptySlot) {
        onSelectEmptySlot(day.id, draft);
        return;
      }

      onCreateEvent?.(day.id, draft);
    }
  }

  function getPreviewFromPointer(clientX, clientY, currentInteraction) {
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) {
      return null;
    }

    const deltaSlots = Math.round((clientY - currentInteraction.startY) / safeRowHeight);
    const deltaMinutes = deltaSlots * safeSlotMinutes;
    const originalDuration = currentInteraction.originalEnd - currentInteraction.originalStart;
    let nextStart = currentInteraction.originalStart;
    let nextEnd = currentInteraction.originalEnd;
    let nextColumnIndex = currentInteraction.originalColumnIndex;

    if (currentInteraction.mode === "drag") {
      const nextColumnDelta = Math.round(
        (clientX - currentInteraction.startX) / (rect.width / columnCount),
      );
      nextColumnIndex = clamp(
        currentInteraction.originalColumnIndex + nextColumnDelta,
        0,
        columnCount - 1,
      );
      nextStart = clamp(
        currentInteraction.originalStart + deltaMinutes,
        range.start,
        range.end - originalDuration,
      );
      nextEnd = nextStart + originalDuration;
    }

    if (currentInteraction.mode === "resize-start") {
      nextStart = clamp(
        currentInteraction.originalStart + deltaMinutes,
        range.start,
        currentInteraction.originalEnd - safeMinDuration,
      );
    }

    if (currentInteraction.mode === "resize-end") {
      nextEnd = clamp(
        currentInteraction.originalEnd + deltaMinutes,
        currentInteraction.originalStart + safeMinDuration,
        range.end,
      );
    }

    const column = scheduleColumns[nextColumnIndex] || scheduleColumns[0];
    return {
      eventId: currentInteraction.event.id,
      start: nextStart,
      end: nextEnd,
      parallelGroup: column.id,
    };
  }

  function startInteraction(pointerEvent, event, mode = "drag") {
    if (disabled || saving || !day?.id) {
      return;
    }

    if ((mode === "drag" && !allowDrag) || (mode !== "drag" && !allowResize)) {
      if (mode === "drag") {
        pointerEvent.stopPropagation();
        onSelectEvent?.(day.id, event.id);
        onActivateEvent?.(day.id, event.id);
      }
      return;
    }

    pointerEvent.preventDefault();
    pointerEvent.stopPropagation();
    setCalendarError("");
    onSelectEvent?.(day.id, event.id);

    setInteraction({
      mode,
      event,
      startX: pointerEvent.clientX,
      startY: pointerEvent.clientY,
      originalStart: getEventStartMinutes(event),
      originalEnd: getEventEndMinutes(event, defaultDurationMinutes),
      originalColumnIndex: getColumnIndex(event.parallelGroup),
    });
  }

  useEffect(() => {
    if (!selectedEventId && !draftEvent) {
      return undefined;
    }

    function handleKeyDown(keyEvent) {
      if (keyEvent.key === "Escape" && !saving) {
        onClearSelection?.();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [draftEvent, onClearSelection, saving, selectedEventId]);

  useEffect(() => {
    if (!interaction) {
      return undefined;
    }

    let latestPreview = null;
    let moved = false;

    function handlePointerMove(pointerEvent) {
      const distanceX = Math.abs(pointerEvent.clientX - interaction.startX);
      const distanceY = Math.abs(pointerEvent.clientY - interaction.startY);
      if (distanceX > 3 || distanceY > 3) {
        moved = true;
      }

      latestPreview = getPreviewFromPointer(
        pointerEvent.clientX,
        pointerEvent.clientY,
        interaction,
      );
      setInteractionPreview(latestPreview);
    }

    async function handlePointerUp(pointerEvent) {
      const nextPreview =
        latestPreview ||
        getPreviewFromPointer(pointerEvent.clientX, pointerEvent.clientY, interaction);

      setInteraction(null);
      setInteractionPreview(null);

      if (!moved || !nextPreview) {
        onSelectEvent?.(day.id, interaction.event.id);
        onActivateEvent?.(day.id, interaction.event.id);
        return;
      }

      const candidate = createEventTimePatch(
        interaction.event,
        nextPreview.start,
        nextPreview.end,
        nextPreview.parallelGroup,
      );
      const nextError = validateScheduleCandidate(
        candidate,
        events,
        interaction.event.id,
        safeMinDuration,
      );

      if (nextError) {
        setCalendarError(conflictMessage || nextError);
        return;
      }

      setCalendarError("");
      await onUpdateEvent?.(
        day.id,
        interaction.event.id,
        {
          start: candidate.start,
          end: candidate.end,
          parallelGroup: candidate.parallelGroup,
        },
        {
          type: "update-event",
          before: {
            start: formatMinutesAsTime(interaction.originalStart),
            end: formatMinutesAsTime(interaction.originalEnd),
            parallelGroup: interaction.event.parallelGroup || "A",
          },
          after: {
            start: candidate.start,
            end: candidate.end,
            parallelGroup: candidate.parallelGroup,
          },
        },
      );
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [
    columnCount,
    day,
    defaultDurationMinutes,
    events,
    interaction,
    onActivateEvent,
    onSelectEvent,
    onUpdateEvent,
    conflictMessage,
    range.end,
    range.start,
    safeMinDuration,
    safeRowHeight,
    safeSlotMinutes,
    scheduleColumns,
  ]);

  function startColumnReorder(pointerEvent, column, columnIndex) {
    if (!allowColumnReorder || disabled || saving || !day?.id || scheduleColumns.length <= 1) {
      return;
    }

    pointerEvent.preventDefault();
    pointerEvent.stopPropagation();
    setCalendarError("");
    setColumnInteraction({
      columnId: column.id,
      startX: pointerEvent.clientX,
      startIndex: columnIndex,
      originalOrder: scheduleColumns.map((item) => item.id),
    });
    setColumnPreviewOrder(scheduleColumns.map((item) => item.id));
  }

  useEffect(() => {
    if (!columnInteraction) {
      return undefined;
    }

    let moved = false;

    function getColumnIndexFromPointer(clientX) {
      const rect = headerColumnsRef.current?.getBoundingClientRect();
      if (!rect) {
        return columnInteraction.startIndex;
      }

      const relativeX = clamp(clientX - rect.left, 0, Math.max(rect.width - 1, 0));
      const nextIndex = Math.floor(relativeX / Math.max(rect.width / columnCount, 1));
      return clamp(nextIndex, 0, columnCount - 1);
    }

    function getNextOrder(clientX) {
      return moveListItem(
        columnInteraction.originalOrder,
        columnInteraction.startIndex,
        getColumnIndexFromPointer(clientX),
      );
    }

    function handlePointerMove(pointerEvent) {
      if (Math.abs(pointerEvent.clientX - columnInteraction.startX) > 4) {
        moved = true;
      }
      setColumnPreviewOrder(getNextOrder(pointerEvent.clientX));
    }

    async function handlePointerUp(pointerEvent) {
      const nextOrder = getNextOrder(pointerEvent.clientX);
      const changed = nextOrder.join("|") !== columnInteraction.originalOrder.join("|");

      setColumnInteraction(null);
      setColumnPreviewOrder(null);

      if (!moved || !changed) {
        return;
      }

      try {
        await onReorderColumns?.(day.id, nextOrder);
      } catch (error) {
        setCalendarError(error?.message || "Не удалось сохранить порядок потоков.");
      }
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      setColumnPreviewOrder(null);
    };
  }, [columnCount, columnInteraction, day, onReorderColumns]);

  function startCreateFlow(clickEvent) {
    clickEvent?.preventDefault();
    clickEvent?.stopPropagation();
    if (!allowCreateFlow || disabled || saving || !day?.id) {
      return;
    }

    const nextFlowId = getNextFlowId(scheduleColumns);
    const nextDraftFlow = { id: nextFlowId, label: nextFlowId, track: "" };
    setCalendarError("");
    setDraftFlow(nextDraftFlow);
    setEditingFlow({ mode: "create", flowId: nextFlowId, label: "", track: "" });
  }

  function startFlowRename(pointerEvent, column) {
    pointerEvent?.preventDefault();
    pointerEvent?.stopPropagation();
    if (disabled || saving || !day?.id) {
      return;
    }

    setCalendarError("");
    setEditingFlow({
      mode: "rename",
      flowId: column.id,
      label: column.label || column.id,
      track: column.track || "",
    });
  }

  function cancelFlowEdit() {
    if (editingFlow?.mode === "create") {
      setDraftFlow(null);
    }
    setEditingFlow(null);
    setCalendarError("");
  }

  function handleFlowEditorBlur(blurEvent) {
    if (blurEvent.currentTarget.contains(blurEvent.relatedTarget)) {
      return;
    }

    void commitFlowEdit();
  }

  function handleFlowEditorKeyDown(keyEvent) {
    if (keyEvent.key === "Enter") {
      keyEvent.preventDefault();
      void commitFlowEdit();
    }
    if (keyEvent.key === "Escape") {
      keyEvent.preventDefault();
      cancelFlowEdit();
    }
  }

  async function commitFlowEdit() {
    if (!editingFlow || disabled || saving || !day?.id) {
      return;
    }

    const label = String(editingFlow.label || "").trim();
    if (!label) {
      setCalendarError("Flow name is required.");
      return;
    }

    if (isDuplicateFlowLabel(scheduleColumns, label, editingFlow.flowId)) {
      setCalendarError("Flow names must be unique within the day.");
      return;
    }

    const nextFlow = {
      id: editingFlow.flowId,
      label,
      track: String(editingFlow.track || "").trim(),
    };

    try {
      if (editingFlow.mode === "create") {
        await onCreateFlow?.(day.id, nextFlow);
        if (!onCreateFlow && onUpdateFlows) {
          await onUpdateFlows(day.id, [...scheduleColumns, nextFlow]);
        }
        setDraftFlow(null);
      } else {
        await onRenameFlow?.(day.id, editingFlow.flowId, {
          label: nextFlow.label,
          track: nextFlow.track,
        });
        if (!onRenameFlow && onUpdateFlows) {
          await onUpdateFlows(
            day.id,
            scheduleColumns.map((column) =>
              column.id === nextFlow.id ? { ...column, ...nextFlow } : column,
            ),
          );
        }
      }
      setEditingFlow(null);
      setCalendarError("");
    } catch (error) {
      setCalendarError(error?.message || "Could not save flow.");
    }
  }

  function startInlineEdit(pointerEvent, event, field) {
    pointerEvent?.preventDefault();
    pointerEvent?.stopPropagation();
    if (disabled || saving || !editableFields.includes(field) || renderEvent) {
      return;
    }

    setInlineEdit({
      eventId: event.id,
      field,
      value: event[field] || "",
    });
  }

  function cancelInlineEdit() {
    setInlineEdit(null);
  }

  async function commitInlineEdit() {
    if (!inlineEdit || disabled || saving || !day?.id) {
      return;
    }

    const event = events.find((item) => item.id === inlineEdit.eventId);
    if (!event) {
      setInlineEdit(null);
      return;
    }

    const value = String(inlineEdit.value || "").trim();
    const field = inlineEdit.field;
    const previousValue = event[field] || "";
    const patch = { [field]: value };
    const before = { [field]: previousValue };
    const after = { [field]: value };

    if (field === "speakerName") {
      const matchedSpeaker = safeArray(speakersCatalog).find(
        (speaker) =>
          String(speaker.name || "")
            .trim()
            .toLowerCase() === value.toLowerCase(),
      );
      patch.speakerId = matchedSpeaker?.id || "";
      before.speakerId = event.speakerId || "";
      after.speakerId = matchedSpeaker?.id || "";
    }

    if (
      value === previousValue &&
      (field !== "speakerName" || patch.speakerId === (event.speakerId || ""))
    ) {
      setInlineEdit(null);
      return;
    }

    try {
      await onUpdateEvent?.(day.id, event.id, patch, {
        type: "inline-edit-event",
        before,
        after,
      });
      setInlineEdit(null);
      setCalendarError("");
    } catch (error) {
      setCalendarError(error?.message || "Could not save event text.");
    }
  }

  function renderInlineValue(event, field, children, className = "") {
    const isEditing = inlineEdit?.eventId === event.id && inlineEdit?.field === field;
    if (isEditing) {
      return (
        <input
          className={["schedule-inline-input", className].filter(Boolean).join(" ")}
          value={inlineEdit.value}
          autoFocus
          disabled={disabled || saving}
          onPointerDown={(pointerEvent) => pointerEvent.stopPropagation()}
          onClick={(clickEvent) => clickEvent.stopPropagation()}
          onChange={(changeEvent) =>
            setInlineEdit({ ...inlineEdit, value: changeEvent.target.value })
          }
          onBlur={() => void commitInlineEdit()}
          onKeyDown={(keyEvent) => {
            if (keyEvent.key === "Enter") {
              keyEvent.preventDefault();
              void commitInlineEdit();
            }
            if (keyEvent.key === "Escape") {
              keyEvent.preventDefault();
              cancelInlineEdit();
            }
          }}
        />
      );
    }

    return (
      <span
        className={["schedule-inline-value", className].filter(Boolean).join(" ")}
        onDoubleClick={(pointerEvent) => startInlineEdit(pointerEvent, event, field)}
      >
        {children}
      </span>
    );
  }

  function renderScheduleEmptyState(customState, fallbackTitle, fallbackDescription) {
    if (typeof customState === "function") {
      return customState({ program, day });
    }

    if (customState?.$$typeof) {
      return customState;
    }

    if (customState && typeof customState !== "string") {
      return (
        <article className="panel-card">
          <div className="feedback-card">
            <h2>{customState.title || fallbackTitle}</h2>
            <p>{customState.description || fallbackDescription}</p>
          </div>
        </article>
      );
    }

    return (
      <article className="panel-card">
        <div className="feedback-card">
          <h2>{fallbackTitle}</h2>
          <p>{customState || fallbackDescription}</p>
        </div>
      </article>
    );
  }

  if (!program && emptyState?.program) {
    return renderScheduleEmptyState(
      emptyState.program,
      "Программа не выбрана",
      "Создайте или выберите программу, чтобы открыть табличный конструктор.",
    );
  }

  if (!program) {
    return (
      <article className="panel-card">
        <div className="feedback-card">
          <h2>Программа не выбрана</h2>
          <p>Создайте или выберите программу, чтобы открыть табличный конструктор.</p>
        </div>
      </article>
    );
  }

  if (!day && emptyState?.day) {
    return renderScheduleEmptyState(
      emptyState.day,
      "День не выбран",
      "Добавьте день программы, и сетка времени появится здесь.",
    );
  }

  if (!day) {
    return (
      <article className="panel-card">
        <div className="feedback-card">
          <h2>День не выбран</h2>
          <p>Добавьте день программы, и сетка времени появится здесь.</p>
        </div>
      </article>
    );
  }

  function renderCalendarEvent(event) {
    const preview = interactionPreview?.eventId === event.id ? interactionPreview : null;
    const start = preview?.start ?? getEventStartMinutes(event);
    const end = preview?.end ?? getEventEndMinutes(event, defaultDurationMinutes);
    const parallelGroup = preview?.parallelGroup || event.parallelGroup || "A";
    const columnIndex = getColumnIndex(parallelGroup);
    const top = ((start - range.start) / safeSlotMinutes) * safeRowHeight + 4;
    const height = Math.max(
      ((end - start) / safeSlotMinutes) * safeRowHeight - 8,
      safeRowHeight - 8,
    );
    const isSelected = selectedEventId === event.id;
    const sizeClass =
      height <= 44
        ? "is-micro"
        : height <= 72
          ? "is-short"
          : height >= 160
            ? "is-tall"
            : "is-regular";
    const timeLabel = `${formatMinutesAsTime(start)} - ${formatMinutesAsTime(end)}`;
    const trackLabel = event.track || event.type || "Трек не указан";
    const metaLabel = `${event.speakerName || "Без спикера"} · ${event.location || "Без локации"}`;
    const eventLabel = `${timeLabel} · ${event.title || "Без названия"} · ${trackLabel} · ${metaLabel}`;

    return (
      <div
        key={event.id}
        className={[
          "schedule-calendar-event",
          `status-${event.status || "planned"}`,
          isSelected ? "is-selected" : "",
          preview ? "is-moving" : "",
          sizeClass,
          !allowDrag ? "is-static" : "",
          !allowResize ? "is-resize-disabled" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={{
          top: `${top}px`,
          height: `${height}px`,
          left: `calc(${columnIndex * columnWidth}% + 6px)`,
          width: `calc(${columnWidth}% - 12px)`,
        }}
        role="button"
        tabIndex={disabled || saving ? -1 : 0}
        title={eventLabel}
        aria-label={eventLabel}
        onPointerDown={(pointerEvent) => startInteraction(pointerEvent, event, "drag")}
        onDoubleClick={(mouseEvent) => {
          mouseEvent.preventDefault();
          mouseEvent.stopPropagation();
          onSelectEvent?.(day.id, event.id);
          onActivateEvent?.(day.id, event.id);
          startInlineEdit(mouseEvent, event, "title");
        }}
        onKeyDown={(keyEvent) => {
          if (keyEvent.key === "Enter" || keyEvent.key === " ") {
            keyEvent.preventDefault();
            onSelectEvent?.(day.id, event.id);
            onActivateEvent?.(day.id, event.id);
          }
        }}
      >
        <button
          type="button"
          className="schedule-resize-handle is-top"
          aria-label={`Изменить начало: ${event.title || "мероприятие"}`}
          disabled={disabled || saving}
          onPointerDown={(pointerEvent) => startInteraction(pointerEvent, event, "resize-start")}
        />
        {renderEvent ? (
          renderEvent({
            event,
            day,
            column: scheduleColumns[columnIndex],
            disabled,
            saving,
            allowDrag,
            allowResize,
            onOpen: () => onSelectEvent?.(day.id, event.id),
          })
        ) : (
          <div className="schedule-calendar-event-body">
            <div className="schedule-event-main">
              <span className="schedule-event-time">{timeLabel}</span>
              <strong>
                {renderInlineValue(event, "title", event.title || "Без названия", "is-title")}
              </strong>
            </div>
            <span className="schedule-event-track">
              {renderInlineValue(event, "track", trackLabel, "is-track")}
            </span>
            <small className="schedule-event-meta">
              {renderInlineValue(
                event,
                "speakerName",
                event.speakerName || "Без спикера",
                "is-speaker",
              )}
              <span aria-hidden="true"> · </span>
              {renderInlineValue(event, "location", event.location || "Без локации", "is-location")}
            </small>
          </div>
        )}
        <button
          type="button"
          className="schedule-resize-handle is-bottom"
          aria-label={`Изменить окончание: ${event.title || "мероприятие"}`}
          disabled={disabled || saving}
          onPointerDown={(pointerEvent) => startInteraction(pointerEvent, event, "resize-end")}
        />
      </div>
    );
  }

  return (
    <article className="panel-card program-schedule-card">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Табличный вид</p>
          <h3>{day.label}</h3>
          <p className="subtle">
            {day.dateLabel || "Дата не указана"} · {formatMinutesAsTime(range.start)} -{" "}
            {formatMinutesAsTime(range.end)}
          </p>
        </div>
        <div className="pill-grid">
          <SoftPill>{scheduleColumns.length} потоков</SoftPill>
          <SoftPill outline>{safeSlotMinutes} мин.</SoftPill>
        </div>
      </div>

      {calendarError ? (
        <AlertCard title="Конфликт расписания" detail={calendarError} tone="severity-high" />
      ) : null}

      <div
        className={[
          "schedule-calendar-wrap",
          stickyHeader ? "has-sticky-header" : "is-static-header",
        ]
          .filter(Boolean)
          .join(" ")}
        style={{
          maxHeight: calendarMaxHeight,
          minHeight:
            typeof calendarMinHeight === "number" ? `${calendarMinHeight}px` : calendarMinHeight,
        }}
      >
        <div
          className={
            showTimeRail
              ? "schedule-calendar-header"
              : "schedule-calendar-header is-without-time-rail"
          }
          style={{
            gridTemplateColumns: calendarGridTemplateColumns,
            minWidth: `${calendarMinWidth}px`,
          }}
        >
          <div className="schedule-time-heading">Время</div>
          <div
            className="schedule-calendar-workspace"
            style={{
              gridTemplateColumns: allowCreateFlow
                ? `minmax(${gridMinWidth}px, 1fr) ${createFlowColumnWidth}px`
                : `minmax(${gridMinWidth}px, 1fr)`,
            }}
          >
            <div
              ref={headerColumnsRef}
              className="schedule-calendar-columns"
              style={{
                gridTemplateColumns: `repeat(${columnCount}, minmax(${safeColumnMinWidth}px, 1fr))`,
              }}
            >
              {scheduleColumns.map((column, index) => (
                <div
                  key={column.id}
                  className={[
                    "schedule-flow-heading",
                    columnInteraction?.columnId === column.id ? "is-reordering" : "",
                    allowColumnReorder && scheduleColumns.length > 1 ? "is-reorderable" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <button
                    type="button"
                    className="schedule-flow-drag-handle"
                    aria-label={`Изменить порядок потока ${column.label}`}
                    disabled={
                      !allowColumnReorder || disabled || saving || scheduleColumns.length <= 1
                    }
                    onPointerDown={(pointerEvent) =>
                      startColumnReorder(pointerEvent, column, index)
                    }
                  >
                    ⋮⋮
                  </button>
                  {editingFlow?.flowId === column.id ? (
                    <div
                      className="schedule-flow-editor"
                      onPointerDown={(pointerEvent) => pointerEvent.stopPropagation()}
                      onClick={(clickEvent) => clickEvent.stopPropagation()}
                      onBlur={handleFlowEditorBlur}
                      onKeyDown={handleFlowEditorKeyDown}
                    >
                      <input
                        className="schedule-flow-title-input"
                        value={editingFlow.label}
                        autoFocus
                        disabled={disabled || saving}
                        placeholder={column.id}
                        onChange={(changeEvent) =>
                          setEditingFlow({ ...editingFlow, label: changeEvent.target.value })
                        }
                      />
                      <input
                        className="schedule-flow-title-input is-subtitle"
                        value={editingFlow.track}
                        disabled={disabled || saving}
                        placeholder="Подзаголовок потока"
                        onChange={(changeEvent) =>
                          setEditingFlow({ ...editingFlow, track: changeEvent.target.value })
                        }
                      />
                    </div>
                  ) : (
                    <span
                      className="schedule-flow-title"
                      onDoubleClick={(event) => startFlowRename(event, column)}
                    >
                      {column.label}
                    </span>
                  )}
                  {editingFlow?.flowId === column.id ? null : (
                    <small
                      className={
                        column.track ? "schedule-flow-subtitle" : "schedule-flow-subtitle is-empty"
                      }
                      onDoubleClick={(event) => startFlowRename(event, column)}
                    >
                      {column.track || "Подзаголовок потока"}
                    </small>
                  )}
                </div>
              ))}
            </div>
            {allowCreateFlow ? (
              <button
                type="button"
                className="schedule-flow-create-ghost"
                disabled={disabled || saving}
                onClick={startCreateFlow}
              >
                + Поток
              </button>
            ) : null}
          </div>
        </div>

        <div
          className={
            showTimeRail ? "schedule-calendar-body" : "schedule-calendar-body is-without-time-rail"
          }
          style={{
            gridTemplateColumns: calendarGridTemplateColumns,
            minWidth: `${calendarMinWidth}px`,
          }}
        >
          <div className="schedule-time-rail" style={{ height: `${gridHeight}px` }}>
            {slots.map((slot, index) => (
              <div
                key={slot.label}
                className="schedule-time-cell"
                style={{ top: `${index * safeRowHeight}px`, height: `${safeRowHeight}px` }}
              >
                {slot.label}
              </div>
            ))}
          </div>

          <div
            className="schedule-calendar-workspace"
            style={{
              gridTemplateColumns: allowCreateFlow
                ? `minmax(${gridMinWidth}px, 1fr) ${createFlowColumnWidth}px`
                : `minmax(${gridMinWidth}px, 1fr)`,
            }}
          >
            <div
              ref={gridRef}
              className={[
                "schedule-calendar-grid",
                disabled || saving ? "is-readonly" : "",
                !showAddButtons ? "is-add-hidden" : "",
                columnInteraction ? "is-reordering-columns" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{
                height: `${gridHeight}px`,
                minWidth: `${gridMinWidth}px`,
                backgroundSize: `100% ${safeRowHeight}px`,
              }}
              onClick={handleGridClick}
              onDoubleClick={() => onClearSelection?.()}
            >
              {scheduleColumns.map((column, index) => (
                <div
                  key={column.id}
                  className="schedule-calendar-column"
                  style={{
                    left: `${index * columnWidth}%`,
                    width: `${columnWidth}%`,
                  }}
                >
                  <button
                    type="button"
                    className="schedule-column-add"
                    disabled={disabled || saving}
                    aria-label={`Добавить мероприятие в поток ${column.label}`}
                    onClick={(clickEvent) => {
                      clickEvent.stopPropagation();
                      const draft = createScheduleEventDraft({
                        start: formatMinutesAsTime(range.start),
                        parallelGroup: column.id,
                        track: column.track,
                        eventTypes,
                        defaultDurationMinutes,
                      });
                      if (onSelectEmptySlot) {
                        onSelectEmptySlot(day.id, draft);
                        return;
                      }

                      onCreateEvent?.(day.id, draft);
                    }}
                  >
                    +
                  </button>
                </div>
              ))}

              {draftEvent ? (
                <div
                  className="schedule-draft-marker"
                  style={{
                    top: `${((getEventStartMinutes(draftEvent) - range.start) / safeSlotMinutes) * safeRowHeight + 4}px`,
                    height: `${Math.max(
                      ((getEventEndMinutes(draftEvent, defaultDurationMinutes) -
                        getEventStartMinutes(draftEvent)) /
                        safeSlotMinutes) *
                        safeRowHeight -
                        8,
                      safeRowHeight - 8,
                    )}px`,
                    left: `calc(${getColumnIndex(draftEvent.parallelGroup) * columnWidth}% + 6px)`,
                    width: `calc(${columnWidth}% - 12px)`,
                  }}
                >
                  Черновик
                </div>
              ) : null}

              {events.map(renderCalendarEvent)}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
