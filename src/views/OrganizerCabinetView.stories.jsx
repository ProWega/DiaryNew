import OrganizerCabinetView from "./OrganizerCabinetView";
import {
  emptyOrganizerWorkspaceFixture,
  organizerWorkspaceFixture,
} from "../stories/fixtures/organizerWorkspace";

export default {
  title: "Organizer/Page",
  component: OrganizerCabinetView,
  argTypes: {
    initialTab: {
      control: "radio",
      options: ["sessions", "program", "groups", "participants"],
    },
    scheduleSlotMinutes: { control: { type: "number", min: 5, max: 60, step: 5 } },
    defaultEventDurationMinutes: { control: { type: "number", min: 15, max: 180, step: 15 } },
    saving: { control: "boolean" },
  },
};

const calendarWorkspaceFixture = {
  ...organizerWorkspaceFixture,
  programWorkspace: {
    ...organizerWorkspaceFixture.programWorkspace,
    programs: organizerWorkspaceFixture.programWorkspace.programs.map((program) =>
      program.id === "program-core"
        ? {
            ...program,
            days: program.days.map((day) =>
              day.id === "day-2"
                ? {
                    ...day,
                    events: [
                      ...day.events,
                      {
                        id: "event-d2-long-project",
                        title: "Длинная проектная сессия",
                        start: "11:45",
                        end: "14:45",
                        type: "Практикум",
                        speakerId: "speaker-2",
                        speakerName: "Павел Демидов",
                        location: "Аудитория 5",
                        track: "Поток B",
                        parallelGroup: "P2",
                        status: "planned",
                        tags: ["проект", "длинный слот"],
                        description: "Проверка длинного события в календарной сетке.",
                      },
                      {
                        id: "event-d2-short-checkin",
                        title: "Короткий чек-ин",
                        start: "15:00",
                        end: "15:15",
                        type: "Рефлексия",
                        speakerId: "",
                        speakerName: "Команда кураторов",
                        location: "Групповые комнаты",
                        track: "Общий поток",
                        parallelGroup: "A",
                        status: "planned",
                        tags: ["чек-ин"],
                        description: "Пятнадцатиминутная проверка плотности сетки.",
                      },
                    ],
                  }
                : day,
            ),
          }
        : program,
    ),
  },
};

const malformedWorkspaceFixture = {
  ...organizerWorkspaceFixture,
  audiencePool: null,
  groupsSummary: {
    groups: null,
    alerts: null,
  },
  programWorkspace: {
    currentProgramId: "program-malformed",
    activeEventId: null,
    reference: null,
    speakersCatalog: null,
    programs: [
      {
        id: "program-malformed",
        title: "Неполная программа",
        status: "published",
        eventContext: null,
        days: [
          null,
          {
            id: "day-malformed",
            label: "День с неполными данными",
            events: [
              null,
              {
                id: "event-malformed",
                title: null,
                start: "09:00",
                end: "09:30",
                parallelGroup: null,
                track: null,
                speakerName: null,
                location: null,
              },
            ],
          },
        ],
      },
    ],
  },
};

const draftProgramWorkspaceFixture = {
  ...organizerWorkspaceFixture,
  summary: {
    ...organizerWorkspaceFixture.summary,
    activeEventLabel: "Программа ещё не опубликована",
  },
  groupsSummary: {
    ...organizerWorkspaceFixture.groupsSummary,
    groups: organizerWorkspaceFixture.groupsSummary.groups.map((group) => ({
      ...group,
      completion: 0,
      progress: { completion: 0 },
    })),
  },
  audiencePool: organizerWorkspaceFixture.audiencePool.map((participant) => ({
    ...participant,
    progress: { completion: 0 },
    avgActivation: "0.0",
  })),
  programWorkspace: {
    ...organizerWorkspaceFixture.programWorkspace,
    programs: organizerWorkspaceFixture.programWorkspace.programs.slice(0, 1).map((program) => ({
      ...program,
      status: "draft",
      days: program.days.map((day) => ({
        ...day,
        events: [],
      })),
    })),
  },
};

const partialProgressWorkspaceFixture = {
  ...organizerWorkspaceFixture,
  groupsSummary: {
    ...organizerWorkspaceFixture.groupsSummary,
    groups: organizerWorkspaceFixture.groupsSummary.groups.map((group, index) => ({
      ...group,
      completion: [35, 68, 12][index] ?? 40,
      progress: { completion: [35, 68, 12][index] ?? 40 },
    })),
  },
  sessionSummary: {
    ...organizerWorkspaceFixture.sessionSummary,
    progress: { completion: 47, answeredEvents: 28, totalEvents: 60, answeredReflections: 7, totalReflections: 12 },
  },
  audiencePool: organizerWorkspaceFixture.audiencePool.map((participant, index) => ({
    ...participant,
    progress: { completion: [25, 50, 75, 100][index] ?? 40 },
    avgActivation: ["2.8", "3.4", "4.1", "3.0"][index] ?? "3.2",
  })),
};

const actions = {
  onCreateProgram: async (payload) => {
    console.log("createProgram", payload);
    return organizerWorkspaceFixture;
  },
  onUpdateProgram: async (...args) => {
    console.log("updateProgram", args);
    return organizerWorkspaceFixture;
  },
  onPublishProgram: async (...args) => {
    console.log("publishProgram", args);
    return organizerWorkspaceFixture;
  },
  onDraftProgram: async (...args) => {
    console.log("draftProgram", args);
    return organizerWorkspaceFixture;
  },
  onSelectProgram: async (programId) => {
    console.log("selectProgram", programId);
    return organizerWorkspaceFixture;
  },
  onUpdateEvent: async (...args) => {
    console.log("updateEvent", args);
    return organizerWorkspaceFixture;
  },
  onAddParallelEvent: async (...args) => {
    console.log("addParallelEvent", args);
    return organizerWorkspaceFixture;
  },
  onDeleteEvent: async (...args) => {
    console.log("deleteEvent", args);
    return organizerWorkspaceFixture;
  },
  onActivateEvent: async (...args) => {
    console.log("activateEvent", args);
    return organizerWorkspaceFixture;
  },
  onCreateSession: async (...args) => {
    console.log("createSession", args);
    return organizerWorkspaceFixture.sessionCatalog?.[0] || { id: "session-new" };
  },
  onUpdateSession: async (...args) => {
    console.log("updateSession", args);
    return organizerWorkspaceFixture;
  },
  onCreateProgramDay: async (...args) => {
    console.log("createProgramDay", args);
    return organizerWorkspaceFixture;
  },
  onUpdateProgramDay: async (...args) => {
    console.log("updateProgramDay", args);
    return organizerWorkspaceFixture;
  },
  onDeleteProgramDay: async (...args) => {
    console.log("deleteProgramDay", args);
    return organizerWorkspaceFixture;
  },
  onUpdateProgramDayFlowOrder: async (...args) => {
    console.log("updateProgramDayFlowOrder", args);
    return organizerWorkspaceFixture;
  },
  onUpdateProgramDayFlows: async (...args) => {
    console.log("updateProgramDayFlows", args);
    return organizerWorkspaceFixture;
  },
  onSessionCreated: (...args) => console.log("sessionCreated", args),
};

function renderCabinet(args) {
  return <OrganizerCabinetView {...args} {...actions} />;
}

export const SessionsTab = {
  args: {
    workspace: organizerWorkspaceFixture,
    initialTab: "sessions",
    scheduleSlotMinutes: 15,
    defaultEventDurationMinutes: 60,
    saving: false,
  },
  render: renderCabinet,
};

export const ProgramTab = {
  args: {
    ...SessionsTab.args,
    initialTab: "program",
  },
  render: renderCabinet,
};

export const ProgramTableMode = {
  args: {
    ...ProgramTab.args,
  },
  render: renderCabinet,
};

export const ProgramTableDenseControls = {
  args: {
    ...ProgramTableMode.args,
    workspace: calendarWorkspaceFixture,
    scheduleSlotMinutes: 15,
    defaultEventDurationMinutes: 60,
  },
  render: renderCabinet,
};

export const GroupsTab = {
  args: {
    ...SessionsTab.args,
    initialTab: "groups",
  },
  render: renderCabinet,
};

export const ParticipantsTab = {
  args: {
    ...SessionsTab.args,
    initialTab: "participants",
  },
  render: renderCabinet,
};

export const SavingState = {
  args: {
    ...ProgramTableMode.args,
    saving: true,
  },
  render: renderCabinet,
};

export const MutationError = {
  args: {
    ...ProgramTab.args,
    mutationError: new Error("PostgreSQL временно недоступен"),
  },
  render: renderCabinet,
};

export const EmptyWorkspace = {
  args: {
    ...ProgramTableMode.args,
    workspace: emptyOrganizerWorkspaceFixture,
  },
  render: renderCabinet,
};

export const ProgramTableEmptyWorkspace = {
  args: {
    ...ProgramTableMode.args,
    workspace: emptyOrganizerWorkspaceFixture,
  },
  render: renderCabinet,
};

export const ProgramTableMalformedDataFallback = {
  args: {
    ...ProgramTableMode.args,
    workspace: malformedWorkspaceFixture,
  },
  render: renderCabinet,
};

export const NewSessionDraftProgram = {
  args: {
    ...ProgramTableMode.args,
    workspace: draftProgramWorkspaceFixture,
  },
  render: renderCabinet,
};

export const DraftProgramPublishAction = {
  args: {
    ...ProgramTab.args,
    workspace: draftProgramWorkspaceFixture,
  },
  render: renderCabinet,
};

export const PublishedProgramDraftAction = {
  args: {
    ...ProgramTab.args,
    workspace: organizerWorkspaceFixture,
  },
  render: renderCabinet,
};

export const DraftProgramPublishError = {
  args: {
    ...DraftProgramPublishAction.args,
    mutationError: new Error("Не удалось опубликовать программу"),
  },
  render: renderCabinet,
};

export const PublishedPartialProgress = {
  args: {
    ...GroupsTab.args,
    workspace: partialProgressWorkspaceFixture,
  },
  render: renderCabinet,
};

export const AnalyticsSnapshot = {
  args: {
    ...ParticipantsTab.args,
    workspace: partialProgressWorkspaceFixture,
  },
  render: renderCabinet,
};
