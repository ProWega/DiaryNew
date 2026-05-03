export function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function normalizeFlowOrder(value) {
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

export function normalizeFlowMeta(value) {
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

export function getDayFlowColumns(day) {
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

export function getDayFlowEventCount(day, flowId) {
  return asArray(day?.events).filter((event) => (event.parallelGroup || "A") === flowId).length;
}

export function getProgramDayFromWorkspace(workspace, programId, dayId) {
  const programWorkspace = normalizeProgramWorkspace(workspace);
  const program =
    programWorkspace.programs.find((item) => item.id === programId) ||
    programWorkspace.programs[0] ||
    null;
  const day = asArray(program?.days).find((item) => item.id === dayId) || null;
  return { program, day };
}

export function getEventHistoryPatch(event) {
  return {
    start: event?.start || "09:00",
    end: event?.end || "10:00",
    parallelGroup: event?.parallelGroup || "A",
  };
}

export function getEventCreatePayload(event) {
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

export function isEditableKeyboardTarget(target) {
  const tagName = target?.tagName?.toLowerCase();
  return target?.isContentEditable || ["input", "textarea", "select"].includes(tagName);
}

export function normalizeProgramEvent(event, eventIndex, dayId) {
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

export function normalizeProgramWorkspace(workspace) {
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

export function normalizeOrganizerWorkspace(workspace) {
  const rawWorkspace = asObject(workspace);
  const programWorkspace = normalizeProgramWorkspace(workspace);
  const audiencePool = asArray(rawWorkspace.audiencePool);
  return {
    ...rawWorkspace,
    meta: asObject(rawWorkspace.meta),
    sessionSettings: {
      participantEventAccessMode:
        rawWorkspace.sessionSettings?.participantEventAccessMode === "from_start_time"
          ? "from_start_time"
          : "always",
    },
    sessionCatalog: asArray(rawWorkspace.sessionCatalog),
    registration: asObject(rawWorkspace.registration),
    summary: {
      activeEventLabel: rawWorkspace.summary?.activeEventLabel || "Нет текущего мероприятия",
      speakersCount: rawWorkspace.summary?.speakersCount ?? programWorkspace.speakersCatalog.length,
      ...asObject(rawWorkspace.summary),
      programsCount: programWorkspace.programs.length,
    },
    groupsSummary: {
      groups: asArray(rawWorkspace.groupsSummary?.groups),
      alerts: asArray(rawWorkspace.groupsSummary?.alerts),
    },
    sessionSummary: asObject(rawWorkspace.sessionSummary),
    speakerLectureSummary: asObject(rawWorkspace.speakerLectureSummary),
    curatorCandidates: asArray(rawWorkspace.curatorCandidates),
    dataState: rawWorkspace.dataState || "ready",
    eventPulse: asArray(rawWorkspace.eventPulse),
    groupPulse: asArray(rawWorkspace.groupPulse),
    participantScatter: asArray(rawWorkspace.participantScatter),
    operationalBrief: asArray(rawWorkspace.operationalBrief),
    audiencePool,
    programWorkspace,
  };
}
