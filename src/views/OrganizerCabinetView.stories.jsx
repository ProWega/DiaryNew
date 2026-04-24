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

const groupsAnalytics = {
  dataState: "ready",
  curatorCandidates: [
    { id: "curator-1", fullName: "Марина Чернова", assignedGroupId: "group-1", assignedGroupName: "Группа 1" },
    { id: "curator-2", fullName: "Даниил Крылов", assignedGroupId: "group-2", assignedGroupName: "Группа 2" },
    { id: "curator-3", fullName: "Елена Лисицына", assignedGroupId: "group-3", assignedGroupName: "Группа 3" },
    { id: "curator-4", fullName: "Ольга Федорова", assignedGroupId: "", assignedGroupName: "" },
  ],
  eventPulse: [
    { id: "event-d1-start", title: "Утренний сбор", deltaFromPrevious: null, completion: 84, riskAnswersCount: 1 },
    { id: "event-d2-lecture", title: "Лекция", deltaFromPrevious: 1.1, completion: 92, riskAnswersCount: 2 },
    { id: "event-d2-workshop-a", title: "Практикум", deltaFromPrevious: -1.8, completion: 63, riskAnswersCount: 5 },
  ],
  groupPulse: [
    { id: "group-1", name: "Группа 1", trajectory: [3.2, 4.1, 2.7], stateDistribution: [{ level: 2, count: 2 }, { level: 3, count: 5 }, { level: 5, count: 3 }] },
    { id: "group-2", name: "Группа 2", trajectory: [3.0, 3.4, 2.2], stateDistribution: [{ level: 1, count: 2 }, { level: 3, count: 4 }, { level: 4, count: 3 }] },
    { id: "group-3", name: "Группа 3", trajectory: [3.4, 4.0, 3.6], stateDistribution: [{ level: 2, count: 1 }, { level: 3, count: 3 }, { level: 4, count: 4 }] },
  ],
  participantScatter: [
    { id: "participant-1", label: "Иван Попов", groupId: "group-1", avgActivation: 3.4, amplitude: 2.2, completion: 84, shortLabel: "ИП" },
    { id: "participant-2", label: "Анна Сергеева", groupId: "group-1", avgActivation: 3.8, amplitude: 1.6, completion: 92, shortLabel: "АС" },
    { id: "participant-3", label: "Егор Кузнецов", groupId: "group-2", avgActivation: 2.7, amplitude: 3.8, completion: 68, shortLabel: "ЕК" },
    { id: "participant-4", label: "Дарья Лисина", groupId: "group-3", avgActivation: 4.0, amplitude: 1.2, completion: 90, shortLabel: "ДЛ" },
  ],
  operationalBrief: [
    { id: "brief-1", severity: "high", title: "Практикум перегружает группу 2", evidence: "Низкое заполнение и 5 ответов в зоне риска по практикуму." },
    { id: "brief-2", severity: "medium", title: "Группа 3 без резервного куратора", evidence: "Если потребуется ротация, сейчас нет свободной замены." },
  ],
};

const groupsWorkspaceReady = {
  ...organizerWorkspaceFixture,
  ...groupsAnalytics,
  groupsSummary: {
    ...organizerWorkspaceFixture.groupsSummary,
    groups: organizerWorkspaceFixture.groupsSummary.groups.map((group, index) => ({
      ...group,
      curatorId: `curator-${index + 1}`,
      description: group.focus,
      openRiskSignalsCount: [1, 3, 0][index] ?? 0,
    })),
  },
  audiencePool: organizerWorkspaceFixture.audiencePool.map((participant, index) => ({
    ...participant,
    progress: { completion: [84, 92, 68, 90][index] ?? 75 },
    avgActivation: ["3.4", "3.8", "2.7", "4.0"][index] ?? "3.2",
  })),
};

const groupsWorkspaceNoCandidates = {
  ...groupsWorkspaceReady,
  curatorCandidates: [],
};

const groupsWorkspaceNoResponses = {
  ...groupsWorkspaceReady,
  dataState: "no_responses",
  eventPulse: [],
  groupPulse: groupsWorkspaceReady.groupPulse.map((group) => ({
    ...group,
    trajectory: [],
    stateDistribution: [],
  })),
  participantScatter: [],
  operationalBrief: [],
};

const groupsWorkspaceHighRisk = {
  ...groupsWorkspaceReady,
  operationalBrief: [
    { id: "brief-risk-1", severity: "high", title: "Группа 2 требует немедленного внимания", evidence: "Резкий провал после практикума и несколько открытых сигналов риска." },
    ...groupsWorkspaceReady.operationalBrief,
  ],
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
  onUpdateSessionSettings: async (...args) => {
    console.log("updateSessionSettings", args);
    return {
      ...organizerWorkspaceFixture,
      sessionSettings: {
        participantEventAccessMode: args[0]?.participantEventAccessMode || "always",
      },
    };
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
  onCreateGroup: async (...args) => {
    console.log("createGroup", args);
    return groupsWorkspaceReady;
  },
  onUpdateGroup: async (...args) => {
    console.log("updateGroup", args);
    return groupsWorkspaceReady;
  },
  onDeleteGroup: async (...args) => {
    console.log("deleteGroup", args);
    return groupsWorkspaceReady;
  },
  onAssignGroupCurator: async (...args) => {
    console.log("assignGroupCurator", args);
    return groupsWorkspaceReady;
  },
  onAssignGroupParticipants: async (...args) => {
    console.log("assignGroupParticipants", args);
    return groupsWorkspaceReady;
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

export const ProgramTabRestrictedAccess = {
  args: {
    ...ProgramTab.args,
    workspace: {
      ...organizerWorkspaceFixture,
      sessionSettings: {
        participantEventAccessMode: "from_start_time",
      },
    },
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
    workspace: groupsWorkspaceReady,
  },
  render: renderCabinet,
};

export const GroupsReady = {
  args: {
    ...GroupsTab.args,
  },
  render: renderCabinet,
};

export const GroupsNoCuratorCandidates = {
  args: {
    ...GroupsTab.args,
    workspace: groupsWorkspaceNoCandidates,
  },
  render: renderCabinet,
};

export const GroupsNoResponses = {
  args: {
    ...GroupsTab.args,
    workspace: groupsWorkspaceNoResponses,
  },
  render: renderCabinet,
};

export const GroupsHighRisk = {
  args: {
    ...GroupsTab.args,
    workspace: groupsWorkspaceHighRisk,
  },
  render: renderCabinet,
};

export const GroupsBatchMove = {
  args: {
    ...GroupsReady.args,
  },
  render: renderCabinet,
};

export const GroupsDeleteBlocked = {
  args: {
    ...GroupsReady.args,
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
