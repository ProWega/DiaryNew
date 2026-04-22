import { Component, useEffect, useMemo, useState } from "react";
import MetricBadge from "../components/MetricBadge";
import Tabs from "../components/ui/Tabs";
import { AlertCard, SoftPill } from "../components/ui/Pills";
import {
  EventEditorCard,
  GroupsSummary,
  ParallelEventComposer,
  ParticipantDetailsCard,
  ParticipantSearchPanel,
  ProgramDayComposer,
  createProgramDayDraft,
  ProgramMetaEditor,
  ProgramScheduleInspector,
  ProgramScheduleTable,
  ProgramScheduleToolbar,
  ProgramSelector,
} from "../components/organizer/OrganizerComponents";
import { RegistrationAccessPanel } from "../components/access/AccessComponents";
import { SessionCatalog, SessionEditorForm } from "../components/admin/AdminComponents";
import { formatPublicationDate } from "../lib/organizerWorkspace";

const TAB_OPTIONS = [
  { id: "sessions", label: "Мои заезды" },
  { id: "program", label: "Программа" },
  { id: "registration", label: "Доступ к регистрации" },
  { id: "groups", label: "Группы" },
  { id: "participants", label: "Участники" },
];

const PROGRAM_VIEW_OPTIONS = [
  { id: "cards", label: "Текущий" },
  { id: "table", label: "Таблица" },
];

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeFlowOrder(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) =>
          typeof item === "string" ? item : item?.id || item?.value || item?.parallelGroup || "",
        )
        .map((item) => String(item || "").trim())
        .filter(Boolean),
    ),
  );
}

function normalizeFlowMeta(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([rawId, rawMeta]) => {
        const id = String(rawId || "").trim();
        if (!id) {
          return null;
        }
        const meta = asObject(rawMeta);
        return [
          id,
          {
            label: String(meta.label || meta.title || id).trim() || id,
            track: String(meta.track || "").trim(),
          },
        ];
      })
      .filter(Boolean),
  );
}

function getDayFlowColumns(day) {
  const columnMap = new Map();
  const flowMeta = normalizeFlowMeta(day?.flowMeta);

  for (const flow of asArray(day?.flows)) {
    const id = String(flow?.id || flow?.value || flow?.parallelGroup || "").trim();
    if (!id) {
      continue;
    }
    columnMap.set(id, {
      id,
      label: String(flow?.label || flowMeta[id]?.label || id).trim() || id,
      track: String(flow?.track || flowMeta[id]?.track || "").trim(),
    });
  }

  for (const flowId of normalizeFlowOrder(day?.flowOrder)) {
    const existing = columnMap.get(flowId);
    columnMap.set(flowId, {
      id: flowId,
      label: existing?.label || flowMeta[flowId]?.label || flowId,
      track: existing?.track || flowMeta[flowId]?.track || "",
    });
  }

  for (const event of asArray(day?.events)) {
    const id = event.parallelGroup || "A";
    const existing = columnMap.get(id);
    columnMap.set(id, {
      id,
      label: existing?.label || id,
      track: existing?.track || event.track || "",
    });
  }

  if (!columnMap.size) {
    columnMap.set("A", { id: "A", label: "A", track: "Общий поток" });
  }

  return Array.from(columnMap.values());
}

function getDayFlowEventCount(day, flowId) {
  return asArray(day?.events).filter((event) => (event.parallelGroup || "A") === flowId).length;
}

function getProgramDayFromWorkspace(workspace, programId, dayId) {
  const programWorkspace = normalizeProgramWorkspace(workspace);
  const program =
    programWorkspace.programs.find((item) => item.id === programId) ||
    programWorkspace.programs[0] ||
    null;
  const day = asArray(program?.days).find((item) => item.id === dayId) || null;
  return { program, day };
}

function getEventHistoryPatch(event) {
  return {
    start: event?.start || "09:00",
    end: event?.end || "10:00",
    parallelGroup: event?.parallelGroup || "A",
  };
}

function getEventCreatePayload(event) {
  return {
    title: event?.title || "",
    start: event?.start || "09:00",
    end: event?.end || "10:00",
    type: event?.type || "",
    speakerId: event?.speakerId || "",
    speakerName: event?.speakerName || "",
    location: event?.location || "",
    track: event?.track || "",
    parallelGroup: event?.parallelGroup || "A",
    status: event?.status || "planned",
    tags: asArray(event?.tags),
    description: event?.description || "",
  };
}

function isEditableKeyboardTarget(target) {
  const tagName = target?.tagName?.toLowerCase();
  return target?.isContentEditable || ["input", "textarea", "select"].includes(tagName);
}

function normalizeProgramEvent(event, eventIndex, dayId) {
  const rawEvent = asObject(event);
  const eventId = rawEvent.id || `${dayId || "day"}-event-${eventIndex}`;

  return {
    ...rawEvent,
    id: eventId,
    title: rawEvent.title || "Без названия",
    start: rawEvent.start || "09:00",
    end: rawEvent.end || "10:00",
    type: rawEvent.type || "",
    speakerId: rawEvent.speakerId || "",
    speakerName: rawEvent.speakerName || "",
    location: rawEvent.location || "",
    track: rawEvent.track || "",
    parallelGroup: rawEvent.parallelGroup || "A",
    status: rawEvent.status || "planned",
    tags: asArray(rawEvent.tags),
    description: rawEvent.description || "",
  };
}

function normalizeProgramWorkspace(workspace) {
  const rawWorkspace = asObject(workspace?.programWorkspace || workspace);
  const programs = asArray(rawWorkspace.programs).map((program, programIndex) => {
    const rawProgram = asObject(program);
    const programId = rawProgram.id || `program-${programIndex}`;
    const days = asArray(rawProgram.days).map((day, dayIndex) => {
      const rawDay = asObject(day);
      const dayId = rawDay.id || `day-${programId}-${dayIndex}`;
      const events = asArray(rawDay.events).map((event, eventIndex) =>
        normalizeProgramEvent(event, eventIndex, dayId),
      );
      const dayDraft = {
        ...rawDay,
        id: dayId,
        label: rawDay.label || `День ${dayIndex + 1}`,
        dateLabel: rawDay.dateLabel || "",
        dateValue: rawDay.dateValue || "",
        flowOrder: normalizeFlowOrder(rawDay.flowOrder),
        flowMeta: normalizeFlowMeta(rawDay.flowMeta),
        flows: asArray(rawDay.flows),
        events,
      };
      const flows = getDayFlowColumns(dayDraft);
      return {
        ...dayDraft,
        flowOrder: flows.map((flow) => flow.id),
        flows,
      };
    });
    const eventContext = asObject(rawProgram.eventContext);

    return {
      ...rawProgram,
      id: programId,
      title: rawProgram.title || "Без названия",
      description: rawProgram.description || "",
      status: rawProgram.status || "draft",
      eventContext: {
        ...eventContext,
        title: eventContext.title || rawProgram.title || "Событие",
        eventType: eventContext.eventType || "Событие",
        venue: eventContext.venue || "",
      },
      days,
    };
  });

  const canonicalProgram =
    programs.find((program) => program.id === rawWorkspace.currentProgramId) ||
    programs.find((program) => program.isCurrent || program.is_current) ||
    programs[0] ||
    null;
  const visiblePrograms = canonicalProgram ? [canonicalProgram] : [];
  const currentProgramId = canonicalProgram?.id || null;

  return {
    ...rawWorkspace,
    currentProgramId,
    activeEventId: rawWorkspace.activeEventId || null,
    reference: {
      ...(rawWorkspace.reference || {}),
      eventTypes: asArray(rawWorkspace.reference?.eventTypes),
    },
    speakersCatalog: asArray(rawWorkspace.speakersCatalog),
    programs: visiblePrograms,
  };
}

function normalizeOrganizerWorkspace(workspace) {
  const rawWorkspace = asObject(workspace);
  const programWorkspace = normalizeProgramWorkspace(workspace);
  const audiencePool = asArray(rawWorkspace.audiencePool);
  return {
    ...rawWorkspace,
    meta: asObject(rawWorkspace.meta),
    sessionCatalog: asArray(rawWorkspace.sessionCatalog),
    registration: asObject(rawWorkspace.registration),
    summary: {
      activeEventLabel: rawWorkspace.summary?.activeEventLabel || "Нет текущего мероприятия",
      programsCount: rawWorkspace.summary?.programsCount ?? programWorkspace.programs.length,
      speakersCount: rawWorkspace.summary?.speakersCount ?? programWorkspace.speakersCatalog.length,
      ...asObject(rawWorkspace.summary),
      programsCount: programWorkspace.programs.length,
    },
    groupsSummary: {
      groups: asArray(rawWorkspace.groupsSummary?.groups),
      alerts: asArray(rawWorkspace.groupsSummary?.alerts),
    },
    audiencePool,
    programWorkspace,
  };
}

class ProgramTableErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, resetKey: props.resetKey };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  static getDerivedStateFromProps(props, state) {
    if (props.resetKey !== state.resetKey) {
      return { error: null, resetKey: props.resetKey };
    }

    return null;
  }

  componentDidCatch(error) {
    console.error("[organizer-table-mode]", error);
  }

  render() {
    if (this.state.error) {
      return this.props.fallback(this.state.error);
    }

    return this.props.children;
  }
}

function OrganizerCabinetView({
  workspace,
  initialTab = "program",
  initialProgramViewMode = "cards",
  scheduleSlotMinutes = 15,
  defaultEventDurationMinutes = 60,
  saving = false,
  mutationError,
  onCreateSession = async () => null,
  onUpdateSession = async () => null,
  onUpdateRegistration = async () => null,
  onSessionCreated = () => {},
  onCreateProgram = async () => null,
  onUpdateProgram = async () => null,
  onSelectProgram = async () => null,
  onCreateProgramDay = async () => null,
  onUpdateProgramDay = async () => null,
  onDeleteProgramDay = async () => null,
  onUpdateProgramDayFlowOrder = async () => null,
  onUpdateProgramDayFlows = async () => null,
  onUpdateEvent = async () => null,
  onAddParallelEvent = async () => null,
  onDeleteEvent = async () => null,
  onActivateEvent = async () => null,
}) {
  const safeWorkspace = useMemo(() => normalizeOrganizerWorkspace(workspace), [workspace]);
  const programWorkspace = safeWorkspace.programWorkspace;
  const [activeTab, setActiveTab] = useState(initialTab);
  const [programViewMode, setProgramViewMode] = useState(initialProgramViewMode);
  const [sessionQuery, setSessionQuery] = useState("");
  const [sessionDraft, setSessionDraft] = useState(null);
  const [registrationDraft, setRegistrationDraft] = useState(safeWorkspace.registration || {});
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isCreatingSessionSaving, setIsCreatingSessionSaving] = useState(false);
  const [createSessionError, setCreateSessionError] = useState(null);
  const [selectedProgramId, setSelectedProgramId] = useState(programWorkspace.currentProgramId);
  const [selectedDayId, setSelectedDayId] = useState(null);
  const [selectedScheduleEventId, setSelectedScheduleEventId] = useState(null);
  const [scheduleDraftEvent, setScheduleDraftEvent] = useState(null);
  const [scheduleUndoStack, setScheduleUndoStack] = useState([]);
  const [scheduleRedoStack, setScheduleRedoStack] = useState([]);
  const [scheduleHistoryBusy, setScheduleHistoryBusy] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState("all");
  const [participantQuery, setParticipantQuery] = useState("");
  const [selectedParticipantId, setSelectedParticipantId] = useState(
    safeWorkspace.audiencePool[0]?.id || null,
  );

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    setProgramViewMode(initialProgramViewMode);
  }, [initialProgramViewMode]);

  useEffect(() => {
    const currentSession =
      safeWorkspace.sessionCatalog?.find((session) => session.id === safeWorkspace.sessionId) || {
        id: safeWorkspace.sessionId,
        name: safeWorkspace.sessionLabel,
        registrationStatus: safeWorkspace.registration?.status,
        registrationStartsAt: safeWorkspace.registration?.startsAt,
        registrationEndsAt: safeWorkspace.registration?.endsAt,
        registrationCapacity: safeWorkspace.registration?.capacity,
        registrationPolicy: safeWorkspace.registration?.policy,
        participantsCount: safeWorkspace.registration?.participantsCount,
      };
    if (!isCreatingSession) {
      setSessionDraft(currentSession);
    }
    setRegistrationDraft({
      ...currentSession,
      registrationStatus: safeWorkspace.registration?.status || currentSession.registrationStatus,
      registrationStartsAt: safeWorkspace.registration?.startsAt || currentSession.registrationStartsAt,
      registrationEndsAt: safeWorkspace.registration?.endsAt || currentSession.registrationEndsAt,
      registrationCapacity: safeWorkspace.registration?.capacity ?? currentSession.registrationCapacity,
      registrationPolicy: safeWorkspace.registration?.policy || currentSession.registrationPolicy || {},
    });
  }, [isCreatingSession, safeWorkspace]);

  useEffect(() => {
    const programs = programWorkspace.programs || [];
    const hasSelectedProgram = programs.some((program) => program.id === selectedProgramId);
    if (!hasSelectedProgram) {
      setSelectedProgramId(programWorkspace.currentProgramId || programs[0]?.id || null);
    }
  }, [programWorkspace.currentProgramId, programWorkspace.programs, selectedProgramId]);

  const currentProgram =
    programWorkspace.programs.find((program) => program.id === selectedProgramId) ||
    programWorkspace.programs[0] ||
    null;
  const eventTypes = programWorkspace.reference?.eventTypes || [];
  const speakersCatalog = programWorkspace.speakersCatalog || [];

  useEffect(() => {
    if (!currentProgram) {
      setSelectedDayId(null);
      return;
    }

    if (!selectedDayId || !asArray(currentProgram.days).some((day) => day.id === selectedDayId)) {
      setSelectedDayId(asArray(currentProgram.days)[0]?.id || null);
    }
  }, [currentProgram, selectedDayId]);

  const currentDay =
    asArray(currentProgram?.days).find((day) => day.id === selectedDayId) ||
    asArray(currentProgram?.days)[0] ||
    null;
  const currentFlowColumns = useMemo(() => getDayFlowColumns(currentDay), [currentDay]);

  const selectedScheduleEvent =
    asArray(currentDay?.events).find((event) => event.id === selectedScheduleEventId) || null;
  const scheduleInspectorMode = scheduleDraftEvent ? "create" : selectedScheduleEvent ? "edit" : "empty";

  useEffect(() => {
    setSelectedScheduleEventId(null);
    setScheduleDraftEvent(null);
  }, [currentProgram?.id, currentDay?.id]);

  useEffect(() => {
    setScheduleUndoStack([]);
    setScheduleRedoStack([]);
  }, [currentProgram?.id, currentDay?.id]);

  const participantList = useMemo(() => {
    const normalizedQuery = participantQuery.trim().toLowerCase();

    return safeWorkspace.audiencePool.filter((participant) => {
      const matchesGroup =
        selectedGroupId === "all" ? true : participant.groupId === selectedGroupId;
      const matchesQuery =
        !normalizedQuery ||
        String(participant.fullName || "").toLowerCase().includes(normalizedQuery) ||
        String(participant.emotionalProfile || "").toLowerCase().includes(normalizedQuery) ||
        String(participant.identityStatus || "").toLowerCase().includes(normalizedQuery);

      return matchesGroup && matchesQuery;
    });
  }, [participantQuery, safeWorkspace.audiencePool, selectedGroupId]);

  useEffect(() => {
    if (!participantList.some((participant) => participant.id === selectedParticipantId)) {
      setSelectedParticipantId(participantList[0]?.id || null);
    }
  }, [participantList, selectedParticipantId]);

  const selectedParticipant =
    participantList.find((participant) => participant.id === selectedParticipantId) ||
    participantList[0] ||
    null;

  async function handleCreateProgram(payload) {
    const nextWorkspace = await onCreateProgram(payload);
    if (!nextWorkspace) {
      return null;
    }

    const nextProgram = normalizeProgramWorkspace(nextWorkspace).programs[0];
    setSelectedProgramId(nextProgram?.id || null);
    setSelectedDayId(nextProgram?.days[0]?.id || null);
    return nextWorkspace;
  }

  async function handleCreateSession(payload) {
    setCreateSessionError(null);
    setIsCreatingSessionSaving(true);

    try {
      const session = await onCreateSession(payload);
      if (session) {
        setIsCreatingSession(false);
        setSessionDraft(session);
        onSessionCreated?.(session);
      }
      return session;
    } catch (error) {
      setCreateSessionError(error);
      return null;
    } finally {
      setIsCreatingSessionSaving(false);
    }
  }

  async function handleProgramSelect(programId) {
    setSelectedProgramId(programId);
    const nextWorkspace = await onSelectProgram(programId);
    if (!nextWorkspace) {
      return;
    }

    const nextProgram = normalizeProgramWorkspace(nextWorkspace).programs.find((item) => item.id === programId);
    setSelectedDayId(nextProgram?.days[0]?.id || null);
  }

  async function handleProgramDayCreate(payload = createProgramDayDraft(currentProgram)) {
    if (!currentProgram?.id) {
      return null;
    }

    const previousDayIds = new Set(asArray(currentProgram.days).map((day) => day.id));
    const nextWorkspace = await onCreateProgramDay(currentProgram.id, payload);
    if (!nextWorkspace) {
      return null;
    }

    const nextProgramWorkspace = normalizeProgramWorkspace(nextWorkspace);
    const nextProgram =
      nextProgramWorkspace.programs.find((program) => program.id === currentProgram.id) ||
      nextProgramWorkspace.programs[0];
    const createdDay =
      asArray(nextProgram?.days).find((day) => !previousDayIds.has(day.id)) ||
      asArray(nextProgram?.days).find(
        (day) =>
          day.label === payload.label &&
          day.dateLabel === payload.dateLabel &&
          day.dateValue === payload.dateValue,
      ) ||
      asArray(nextProgram?.days).at(-1) ||
      null;

    setSelectedDayId(createdDay?.id || null);
    setSelectedScheduleEventId(null);
    setScheduleDraftEvent(null);
    setScheduleUndoStack([]);
    setScheduleRedoStack([]);
    return nextWorkspace;
  }

  async function handleProgramDayDelete(dayId = currentDay?.id) {
    if (!currentProgram?.id || !dayId) {
      return null;
    }

    const dayToDelete = asArray(currentProgram.days).find((day) => day.id === dayId);
    const shouldDelete =
      typeof window === "undefined" ||
      window.confirm(`Удалить ${dayToDelete?.label || "день"} вместе со всеми мероприятиями?`);

    if (!shouldDelete) {
      return null;
    }

    const previousDays = asArray(currentProgram.days);
    const deletedIndex = Math.max(previousDays.findIndex((day) => day.id === dayId), 0);
    const nextWorkspace = await onDeleteProgramDay(currentProgram.id, dayId);
    if (!nextWorkspace) {
      return null;
    }

    const nextProgramWorkspace = normalizeProgramWorkspace(nextWorkspace);
    const nextProgram =
      nextProgramWorkspace.programs.find((program) => program.id === currentProgram.id) ||
      nextProgramWorkspace.programs[0];
    const nextDays = asArray(nextProgram?.days);
    const nextDay = nextDays[Math.min(deletedIndex, nextDays.length - 1)] || null;

    setSelectedDayId(nextDay?.id || null);
    setSelectedScheduleEventId(null);
    setScheduleDraftEvent(null);
    setScheduleUndoStack([]);
    setScheduleRedoStack([]);
    return nextWorkspace;
  }

  function switchToCardsMode() {
    setProgramViewMode("cards");
    setSelectedScheduleEventId(null);
    setScheduleDraftEvent(null);
  }

  function pushScheduleUndo(action) {
    setScheduleUndoStack((previous) => [...previous, action].slice(-50));
    setScheduleRedoStack([]);
  }

  async function handleScheduleUpdate(dayId, eventId, payload, historyMeta = {}) {
    if (!currentProgram?.id || !dayId || !eventId) {
      return null;
    }

    const nextWorkspace = await onUpdateEvent(currentProgram.id, dayId, eventId, payload);
    if (nextWorkspace && ["update-event", "inline-edit-event"].includes(historyMeta.type)) {
      pushScheduleUndo({
        type: historyMeta.type,
        programId: currentProgram.id,
        dayId,
        eventId,
        before: historyMeta.before,
        after: historyMeta.after || payload,
      });
    }

    return nextWorkspace;
  }

  async function handleScheduleCreate(payload) {
    if (!currentProgram?.id || !currentDay?.id) {
      return null;
    }

    const previousEventIds = new Set(asArray(currentDay.events).map((event) => event.id));
    const beforeFlows = getDayFlowColumns(currentDay);
    const createsNewFlow = Boolean(
      payload?.parallelGroup && !beforeFlows.some((flow) => flow.id === payload.parallelGroup),
    );
    const nextWorkspace = await onAddParallelEvent(currentProgram.id, currentDay.id, payload);
    if (!nextWorkspace) {
      return null;
    }

    const nextProgramWorkspace = normalizeProgramWorkspace(nextWorkspace);
    const nextProgram =
      nextProgramWorkspace.programs.find((program) => program.id === currentProgram.id) ||
      nextProgramWorkspace.programs[0];
    const nextDay =
      asArray(nextProgram?.days).find((day) => day.id === currentDay.id) ||
      asArray(nextProgram?.days)[0];
    const createdEvent =
      asArray(nextDay?.events).find((event) => !previousEventIds.has(event.id)) ||
      asArray(nextDay?.events).find(
        (event) =>
          event.start === payload.start &&
          event.end === payload.end &&
          event.parallelGroup === payload.parallelGroup &&
          event.title === payload.title,
      );

    setScheduleDraftEvent(null);
    setSelectedScheduleEventId(createdEvent?.id || null);
    if (createsNewFlow) {
      const afterFlows = getDayFlowColumns(nextDay);
      pushScheduleUndo({
        type: "create-flow",
        programId: currentProgram.id,
        dayId: currentDay.id,
        flowId: payload.parallelGroup,
        beforeFlows,
        afterFlows,
      });
    }
    if (createdEvent) {
      pushScheduleUndo({
        type: "create-event",
        programId: currentProgram.id,
        dayId: currentDay.id,
        event: createdEvent,
      });
    }
    return nextWorkspace;
  }

  async function persistProgramDayFlows(dayId, flows) {
    if (!currentProgram?.id || !dayId) {
      return null;
    }

    const safeFlows = asArray(flows).map((flow) => ({
      id: flow.id,
      label: flow.label || flow.id,
      track: flow.track || "",
    }));

    if (onUpdateProgramDayFlows) {
      return onUpdateProgramDayFlows(currentProgram.id, dayId, safeFlows);
    }

    return onUpdateProgramDayFlowOrder(currentProgram.id, dayId, safeFlows.map((flow) => flow.id));
  }

  async function handleFlowOrderChange(dayId, flowOrder) {
    const flowMap = new Map(currentFlowColumns.map((flow) => [flow.id, flow]));
    const nextFlows = normalizeFlowOrder(flowOrder).map(
      (flowId) => flowMap.get(flowId) || { id: flowId, label: flowId, track: "" },
    );

    return persistProgramDayFlows(dayId, nextFlows);
  }

  async function handleCreateFlow(dayId, flow) {
    if (!currentProgram?.id || !dayId || !flow?.id) {
      return null;
    }

    const beforeFlows = getDayFlowColumns(currentDay);
    const afterFlows = [
      ...beforeFlows.filter((item) => item.id !== flow.id),
      {
        id: flow.id,
        label: flow.label || flow.id,
        track: flow.track || "",
      },
    ];
    const nextWorkspace = await persistProgramDayFlows(dayId, afterFlows);
    if (nextWorkspace) {
      pushScheduleUndo({
        type: "create-flow",
        programId: currentProgram.id,
        dayId,
        flowId: flow.id,
        beforeFlows,
        afterFlows,
      });
    }

    return nextWorkspace;
  }

  async function handleRenameFlow(dayId, flowId, patch) {
    if (!currentProgram?.id || !dayId || !flowId) {
      return null;
    }

    const beforeFlows = getDayFlowColumns(currentDay);
    const afterFlows = beforeFlows.map((flow) =>
      flow.id === flowId
        ? {
            ...flow,
            label: patch?.label || flow.label || flow.id,
            track: patch?.track ?? flow.track ?? "",
          }
        : flow,
    );
    const nextWorkspace = await persistProgramDayFlows(dayId, afterFlows);
    if (nextWorkspace) {
      pushScheduleUndo({
        type: "rename-flow",
        programId: currentProgram.id,
        dayId,
        flowId,
        beforeFlows,
        afterFlows,
      });
    }

    return nextWorkspace;
  }

  function findCreatedEvent(nextWorkspace, programId, dayId, previousEventIds, payload) {
    const { day } = getProgramDayFromWorkspace(nextWorkspace, programId, dayId);
    const events = asArray(day?.events);
    return (
      events.find((event) => !previousEventIds.has(event.id)) ||
      events.find(
        (event) =>
          event.start === payload.start &&
          event.end === payload.end &&
          event.parallelGroup === payload.parallelGroup &&
          event.title === payload.title,
      ) ||
      null
    );
  }

  async function applyScheduleHistoryAction(action, direction) {
    if (!action) {
      return null;
    }

    if (["update-event", "inline-edit-event"].includes(action.type)) {
      const patch = direction === "undo" ? action.before : action.after;
      const nextWorkspace = await onUpdateEvent(action.programId, action.dayId, action.eventId, patch);
      if (!nextWorkspace) {
        return null;
      }

      setSelectedProgramId(action.programId);
      setSelectedDayId(action.dayId);
      setSelectedScheduleEventId(action.eventId);
      setScheduleDraftEvent(null);
      return action;
    }

    if (["create-flow", "rename-flow"].includes(action.type)) {
      const flows = direction === "undo" ? action.beforeFlows : action.afterFlows;
      if (action.type === "create-flow" && direction === "undo") {
        const { day } = getProgramDayFromWorkspace(safeWorkspace, action.programId, action.dayId);
        if (getDayFlowEventCount(day, action.flowId) > 0) {
          return null;
        }
      }

      const nextWorkspace = await onUpdateProgramDayFlows(action.programId, action.dayId, flows);
      if (!nextWorkspace) {
        return null;
      }

      setSelectedProgramId(action.programId);
      setSelectedDayId(action.dayId);
      setSelectedScheduleEventId(null);
      setScheduleDraftEvent(null);
      return action;
    }

    if (action.type === "create-event" && direction === "undo") {
      const eventId = action.event?.id;
      if (!eventId) {
        return null;
      }

      const nextWorkspace = await onDeleteEvent(action.programId, action.dayId, eventId);
      if (!nextWorkspace) {
        return null;
      }

      setSelectedProgramId(action.programId);
      setSelectedDayId(action.dayId);
      setSelectedScheduleEventId(null);
      setScheduleDraftEvent(null);
      return action;
    }

    if (action.type === "create-event" && direction === "redo") {
      const { day } = getProgramDayFromWorkspace(safeWorkspace, action.programId, action.dayId);
      const previousEventIds = new Set(asArray(day?.events).map((event) => event.id));
      const payload = getEventCreatePayload(action.event);
      const nextWorkspace = await onAddParallelEvent(action.programId, action.dayId, payload);
      if (!nextWorkspace) {
        return null;
      }

      const createdEvent = findCreatedEvent(
        nextWorkspace,
        action.programId,
        action.dayId,
        previousEventIds,
        payload,
      );
      if (!createdEvent) {
        return null;
      }

      setSelectedProgramId(action.programId);
      setSelectedDayId(action.dayId);
      setSelectedScheduleEventId(createdEvent.id);
      setScheduleDraftEvent(null);
      return {
        ...action,
        event: createdEvent,
      };
    }

    return null;
  }

  async function handleScheduleUndo() {
    if (scheduleHistoryBusy || !scheduleUndoStack.length) {
      return;
    }

    const action = scheduleUndoStack[scheduleUndoStack.length - 1];
    setScheduleHistoryBusy(true);
    try {
      const redoAction = await applyScheduleHistoryAction(action, "undo");
      if (redoAction) {
        setScheduleUndoStack((previous) => previous.slice(0, -1));
        setScheduleRedoStack((previous) => [...previous, redoAction].slice(-50));
      }
    } finally {
      setScheduleHistoryBusy(false);
    }
  }

  async function handleScheduleRedo() {
    if (scheduleHistoryBusy || !scheduleRedoStack.length) {
      return;
    }

    const action = scheduleRedoStack[scheduleRedoStack.length - 1];
    setScheduleHistoryBusy(true);
    try {
      const undoAction = await applyScheduleHistoryAction(action, "redo");
      if (undoAction) {
        setScheduleRedoStack((previous) => previous.slice(0, -1));
        setScheduleUndoStack((previous) => [...previous, undoAction].slice(-50));
      }
    } finally {
      setScheduleHistoryBusy(false);
    }
  }

  useEffect(() => {
    if (activeTab !== "program" || programViewMode !== "table") {
      return undefined;
    }

    function handleKeyDown(keyEvent) {
      if (!keyEvent.ctrlKey || keyEvent.altKey || keyEvent.metaKey || isEditableKeyboardTarget(keyEvent.target)) {
        return;
      }

      const key = keyEvent.key.toLowerCase();
      if (key === "z" && !keyEvent.shiftKey && scheduleDraftEvent) {
        keyEvent.preventDefault();
        setScheduleDraftEvent(null);
        setSelectedScheduleEventId(null);
        return;
      }

      if (key === "z" && !keyEvent.shiftKey && scheduleUndoStack.length) {
        keyEvent.preventDefault();
        void handleScheduleUndo();
      }

      if ((key === "y" || (key === "z" && keyEvent.shiftKey)) && scheduleRedoStack.length) {
        keyEvent.preventDefault();
        void handleScheduleRedo();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTab, programViewMode, scheduleDraftEvent, scheduleRedoStack, scheduleUndoStack, scheduleHistoryBusy]);

  function renderTableFallback(error) {
    return (
      <article className="panel-card program-table-fallback">
        <AlertCard
          title="Табличный вид временно недоступен"
          detail={error?.message || "Не удалось отрисовать календарную сетку программы."}
          tone="severity-high"
        />
        <button type="button" className="ghost-button" onClick={switchToCardsMode}>
          Открыть текущий вид
        </button>
      </article>
    );
  }

  return (
    <section className="role-view">
      <div className="hero-card">
        <div>
          <p className="eyebrow">Организатор</p>
          <h2>Программы событий, мероприятия, группы и участники</h2>
          <p className="subtle">
            Программа создаётся под отдельное событие. Внутри неё находятся мероприятия: лекции,
            мастер-классы, практикумы, экскурсии и другие форматы, включая параллельные потоки и
            привязку к конкретным спикерам.
          </p>
        </div>

        <div className="hero-stats">
          <MetricBadge label="Текущее мероприятие" value={safeWorkspace.summary.activeEventLabel} />
          <MetricBadge label="Программ" value={safeWorkspace.summary.programsCount} />
          <MetricBadge label="Спикеров" value={safeWorkspace.summary.speakersCount} />
          <MetricBadge label="Участников" value={safeWorkspace.audiencePool.length} />
        </div>
      </div>

      <div className="scope-strip organizer-toolbar">
        <Tabs items={TAB_OPTIONS} activeId={activeTab} onChange={setActiveTab} ariaLabel="Разделы организатора" />

        <div className="pill-grid">
          <SoftPill>Storage: {safeWorkspace.meta?.storageMode || "memory"}</SoftPill>
          <SoftPill outline>Обновлено: {formatPublicationDate(safeWorkspace.meta?.updatedAt)}</SoftPill>
        </div>
      </div>

      {mutationError ? (
        <AlertCard
          title="Не удалось сохранить изменения"
          detail={mutationError.message}
          tone="severity-high"
        />
      ) : null}

      {activeTab === "program" ? (
        <div className="organizer-section-stack">
          <div className="scope-strip program-view-strip">
            <Tabs
              items={PROGRAM_VIEW_OPTIONS}
              activeId={programViewMode}
              onChange={setProgramViewMode}
              disabled={saving}
              ariaLabel="Вид программы"
            />
            <div className="pill-grid">
              <SoftPill>{currentProgram?.title || "Программа не выбрана"}</SoftPill>
              <SoftPill outline>{currentDay?.label || "День не выбран"}</SoftPill>
            </div>
          </div>

          {programViewMode === "table" ? (
            <ProgramTableErrorBoundary
              resetKey={`${programViewMode}:${currentProgram?.id || "none"}:${currentDay?.id || "none"}`}
              fallback={renderTableFallback}
            >
              <ProgramScheduleToolbar
                programs={programWorkspace.programs}
                currentProgram={currentProgram}
                currentDay={currentDay}
                viewMode={programViewMode}
                viewModeItems={PROGRAM_VIEW_OPTIONS}
                slotMinutes={scheduleSlotMinutes}
                saving={saving}
                onViewModeChange={setProgramViewMode}
                onSelectProgram={(programId) => void handleProgramSelect(programId)}
                onSelectDay={setSelectedDayId}
                onCreateDay={() => void handleProgramDayCreate()}
                onDeleteDay={(dayId) => void handleProgramDayDelete(dayId)}
              />

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
                  onSelectEvent={(_dayId, eventId) => {
                    setSelectedScheduleEventId(eventId);
                    setScheduleDraftEvent(null);
                  }}
                  onSelectEmptySlot={(_dayId, draft) => {
                    setSelectedScheduleEventId(null);
                    setScheduleDraftEvent(draft);
                  }}
                  onClearSelection={() => {
                    setSelectedScheduleEventId(null);
                    setScheduleDraftEvent(null);
                  }}
                  onReorderColumns={handleFlowOrderChange}
                  onCreateFlow={handleCreateFlow}
                  onRenameFlow={handleRenameFlow}
                  onUpdateFlows={(dayId, flows) => persistProgramDayFlows(dayId, flows)}
                  onActivateEvent={(dayId, eventId) =>
                    currentProgram?.id ? void onActivateEvent(currentProgram.id, dayId, eventId) : null
                  }
                  onUpdateEvent={handleScheduleUpdate}
                />

                <div className="organizer-table-side">
                  <ProgramScheduleInspector
                    mode={scheduleInspectorMode}
                    program={currentProgram}
                    day={currentDay}
                    event={selectedScheduleEvent}
                    draftEvent={scheduleDraftEvent}
                    eventTypes={eventTypes}
                    speakersCatalog={speakersCatalog}
                    parallelGroupOptions={currentFlowColumns}
                    allowNewParallelGroup
                    saving={saving}
                    minDurationMinutes={scheduleSlotMinutes}
                    onSaveEvent={(eventId, payload) => handleScheduleUpdate(currentDay?.id, eventId, payload)}
                    onCreateEvent={handleScheduleCreate}
                    onCancel={() => {
                      setSelectedScheduleEventId(null);
                      setScheduleDraftEvent(null);
                    }}
                  />
                </div>
              </div>
            </ProgramTableErrorBoundary>
          ) : (
            <div className="organizer-focus-grid">
              <ProgramSelector
                programs={programWorkspace.programs}
                currentProgram={currentProgram}
                currentDay={currentDay}
                activeEventId={programWorkspace.activeEventId}
                saving={saving}
                onSelectProgram={(programId) => void handleProgramSelect(programId)}
                onSelectDay={setSelectedDayId}
                onActivateEvent={(programId, dayId, eventId) => void onActivateEvent(programId, dayId, eventId)}
              />

              <div className="organizer-event-stack">
                {currentProgram ? (
                  <ProgramMetaEditor
                    program={currentProgram}
                    saving={saving}
                    onSave={(payload) => onUpdateProgram(currentProgram.id, payload)}
                  />
                ) : null}

                {currentDay ? (
                  <>
                    <ProgramDayComposer
                      program={currentProgram}
                      currentDay={currentDay}
                      saving={saving}
                      onCreate={handleProgramDayCreate}
                      onUpdate={(dayId, payload) => onUpdateProgramDay(currentProgram.id, dayId, payload)}
                      onDelete={handleProgramDayDelete}
                    />
                    {asArray(currentDay.events).map((event) => (
                      <EventEditorCard
                        key={event.id}
                        event={event}
                        eventTypes={eventTypes}
                        speakersCatalog={speakersCatalog}
                        isActive={programWorkspace.activeEventId === event.id}
                        saving={saving}
                        onSave={(patch) => onUpdateEvent(currentProgram.id, currentDay.id, event.id, patch)}
                        onActivate={() => onActivateEvent(currentProgram.id, currentDay.id, event.id)}
                      />
                    ))}
                    <ParallelEventComposer
                      day={currentDay}
                      speakersCatalog={speakersCatalog}
                      eventTypes={eventTypes}
                      saving={saving}
                      onSubmit={(payload) => onAddParallelEvent(currentProgram.id, currentDay.id, payload)}
                    />
                  </>
                ) : null}
              </div>
            </div>
          )}
        </div>
      ) : null}

      {activeTab === "sessions" ? (
        <div className="organizer-focus-grid">
          <SessionCatalog
            sessions={safeWorkspace.sessionCatalog || []}
            selectedSessionId={safeWorkspace.sessionId}
            query={sessionQuery}
            onQueryChange={setSessionQuery}
            onSelectSession={(sessionId) => {
              const selected = safeWorkspace.sessionCatalog?.find((session) => session.id === sessionId);
              if (selected) {
                onSessionCreated?.(selected);
              }
            }}
          />
          <div className="organizer-section-stack">
            <button
              type="button"
              className="primary-button"
              disabled={saving || isCreatingSessionSaving}
              onClick={() => {
                setCreateSessionError(null);
                setIsCreatingSession(true);
                setSessionDraft({
                  name: "",
                  cycle: "",
                  dateLabel: "",
                  location: "",
                  startDate: "",
                  endDate: "",
                  description: "",
                  registrationStatus: "draft",
                  registrationPolicy: { mode: "public", note: "" },
                });
              }}
            >
              Создать заезд
            </button>
            {createSessionError ? (
              <AlertCard
                title="Не удалось создать заезд"
                detail={createSessionError.message || "Проверьте заполнение формы и доступ организатора."}
                tone="severity-high"
              />
            ) : null}
            {sessionDraft ? (
              <SessionEditorForm
                value={sessionDraft}
                mode={isCreatingSession ? "create" : "edit"}
                saving={saving || isCreatingSessionSaving}
                onChange={setSessionDraft}
                onSubmit={(payload) =>
                  isCreatingSession ? handleCreateSession(payload) : onUpdateSession(payload)
                }
                onCancel={() => {
                  setCreateSessionError(null);
                  setIsCreatingSession(false);
                }}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      {activeTab === "registration" ? (
        <RegistrationAccessPanel
          value={registrationDraft}
          saving={saving}
          onChange={setRegistrationDraft}
          onSubmit={onUpdateRegistration}
        />
      ) : null}

      {activeTab === "groups" ? (
        <GroupsSummary
          groups={safeWorkspace.groupsSummary.groups}
          alerts={safeWorkspace.groupsSummary.alerts}
          audiencePool={safeWorkspace.audiencePool}
        />
      ) : null}

      {activeTab === "participants" ? (
        <div className="organizer-focus-grid">
          <ParticipantSearchPanel
            groups={safeWorkspace.groupsSummary.groups}
            participants={participantList}
            selectedGroupId={selectedGroupId}
            query={participantQuery}
            selectedParticipantId={selectedParticipant?.id}
            onGroupChange={setSelectedGroupId}
            onQueryChange={setParticipantQuery}
            onSelectParticipant={setSelectedParticipantId}
          />
          <ParticipantDetailsCard participant={selectedParticipant} />
        </div>
      ) : null}
    </section>
  );
}

export default OrganizerCabinetView;
