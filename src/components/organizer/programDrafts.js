import { createProgramDayDraft as createAutoProgramDayDraft } from "../../lib/programDays";

export function createProgramDraft() {
  return {
    title: "",
    description: "",
    status: "draft",
    eventContext: {
      title: "",
      eventType: "Форумное событие",
      venue: "",
      startDate: "",
      endDate: "",
      participantCount: "",
      description: "",
    },
  };
}

export function createParallelEventDraft(day, speakerOptions = [], eventTypes = []) {
  const referenceEvent = day?.events?.[0];

  return {
    title: "",
    start: referenceEvent?.start || "16:00",
    end: referenceEvent?.end || "17:00",
    type: referenceEvent?.type || eventTypes[0] || "Лекция",
    speakerId: referenceEvent?.speakerId || speakerOptions[0]?.id || "",
    location: "",
    track: "Параллельный поток",
    parallelGroup: "P2",
    status: "planned",
    tags: "",
    description: "",
  };
}

export function createProgramDayDraft(program) {
  return createAutoProgramDayDraft(program);
}
