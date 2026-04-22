import { useEffect, useMemo, useState } from "react";
import {
  EventEditorCard,
  EventTimeline,
  GroupsSummary,
  ParallelEventComposer,
  ParticipantDetailsCard,
  ParticipantSearchPanel,
  ProgramDayComposer,
  ProgramDayTabs,
  ProgramCreateCard,
  ProgramEventDialog,
  ProgramEventForm,
  ProgramMetaEditor,
  ProgramScheduleInspector,
  ProgramScheduleTable,
  ProgramScheduleToolbar,
  ProgramSelector,
} from "./OrganizerComponents";
import { organizerWorkspaceFixture } from "../../stories/fixtures/organizerWorkspace";

export default {
  title: "Organizer/Components",
  argTypes: {
    slotMinutes: { control: { type: "number", min: 5, max: 60, step: 5 } },
    defaultDurationMinutes: { control: { type: "number", min: 15, max: 180, step: 15 } },
    rowHeight: { control: { type: "number", min: 28, max: 96, step: 4 } },
    columnMinWidth: { control: { type: "number", min: 140, max: 420, step: 10 } },
    timeColumnWidth: { control: { type: "number", min: 56, max: 160, step: 4 } },
    timeStart: { control: "text" },
    timeEnd: { control: "text" },
    showAddButtons: { control: "boolean" },
    allowDrag: { control: "boolean" },
    allowResize: { control: "boolean" },
    allowColumnReorder: { control: "boolean" },
    allowCreateFlow: { control: "boolean" },
    clearSelectionOnEmptyClick: { control: "boolean" },
    createOnEmptyClickWhenIdle: { control: "boolean" },
    calendarMaxHeight: { control: "text" },
    calendarMinHeight: { control: { type: "number", min: 160, max: 760, step: 20 } },
    stickyHeader: { control: "boolean" },
    inlineEditableFields: { control: "object" },
    showTimeRail: { control: "boolean" },
    compact: { control: "boolean" },
    flowCount: { control: { type: "number", min: 1, max: 6, step: 1 } },
    eventDensity: { control: "select", options: ["empty", "sparse", "normal", "dense"] },
    programStatus: { control: "radio", options: ["draft", "published", "archived"] },
    hasSpeakers: { control: "boolean" },
    useFixtureControls: { table: { disable: true } },
    disabled: { control: "boolean" },
    saving: { control: "boolean" },
    open: { control: "boolean" },
    viewMode: { control: "radio", options: ["cards", "table"] },
  },
};

const workspace = organizerWorkspaceFixture;
const program = workspace.programWorkspace.programs[0];
const day = program.days[1];
const event = day.events[0];
const eventTypes = workspace.programWorkspace.reference.eventTypes;
const speakersCatalog = workspace.programWorkspace.speakersCatalog;
const noopAsync = async (...args) => {
  console.log("submit", ...args);
  return workspace;
};

const denseDay = {
  ...day,
  events: [
    ...day.events,
    {
      id: "event-d2-workshop-b",
      title: "Мастерская B: фасилитация разговора",
      start: "14:00",
      end: "15:30",
      type: "Практикум",
      speakerId: "speaker-3",
      speakerName: "Ирина Богданова",
      location: "Аудитория 7",
      track: "Поток B",
      parallelGroup: "P2",
      status: "planned",
      tags: ["параллель", "фасилитация"],
      description: "Параллельная мастерская про устойчивые групповые разговоры.",
    },
    {
      id: "event-d2-reflection",
      title: "Короткая дневниковая сборка",
      start: "16:00",
      end: "16:30",
      type: "Рефлексия",
      speakerId: "",
      speakerName: "Команда кураторов",
      location: "Групповые комнаты",
      track: "Общий поток",
      parallelGroup: "A",
      status: "planned",
      tags: ["дневник", "сборка"],
      description: "Пауза для фиксации состояния после параллельных потоков.",
    },
  ],
};

const denseProgram = {
  ...program,
  days: program.days.map((item) => (item.id === denseDay.id ? denseDay : item)),
};

const emptyDay = {
  id: "day-empty",
  label: "День без событий",
  dateLabel: "27 апреля",
  dateValue: "2026-04-27",
  events: [],
};

const emptyDayProgram = {
  ...program,
  days: [emptyDay],
};
const draftProgram = {
  ...program,
  status: "draft",
};

const durationDay = {
  ...day,
  events: [
    {
      ...event,
      id: "event-15-min",
      title: "Пятнадцатиминутный слот",
      start: "09:00",
      end: "09:15",
      parallelGroup: "A",
      track: "Общий поток",
    },
    {
      ...event,
      id: "event-60-min",
      title: "Часовая лекция",
      start: "09:30",
      end: "10:30",
      parallelGroup: "A",
      track: "Общий поток",
    },
    {
      ...event,
      id: "event-90-min",
      title: "Практикум на полтора часа",
      start: "11:00",
      end: "12:30",
      parallelGroup: "P1",
      track: "Поток A",
    },
    {
      ...event,
      id: "event-180-min",
      title: "Длинная проектная сессия",
      start: "13:00",
      end: "16:00",
      parallelGroup: "P2",
      track: "Поток B",
    },
  ],
};

const conflictDay = {
  ...day,
  events: [
    {
      ...event,
      id: "event-conflict-a",
      title: "Событие в потоке A",
      start: "10:00",
      end: "11:00",
      parallelGroup: "A",
      track: "Общий поток",
    },
    {
      ...event,
      id: "event-conflict-b",
      title: "Конфликтный слот",
      start: "10:30",
      end: "11:15",
      parallelGroup: "A",
      track: "Общий поток",
    },
  ],
};

const microSlotDay = {
  ...day,
  id: "day-micro-slot",
  label: "День с коротким слотом",
  events: [
    {
      ...event,
      id: "event-micro-slot",
      title: "Короткая дневниковая сборка",
      start: "09:00",
      end: "09:15",
      parallelGroup: "A",
      track: "Общий поток",
    },
  ],
};

const shortSlotDay = {
  ...day,
  id: "day-short-slot",
  label: "День с получасовым слотом",
  events: [
    {
      ...event,
      id: "event-short-slot",
      title: "Получасовой чек-ин с длинным названием",
      start: "10:00",
      end: "10:30",
      parallelGroup: "A",
      track: "Общий поток",
    },
  ],
};

const tallSlotDay = {
  ...day,
  id: "day-tall-slot",
  label: "День с длинным слотом",
  events: [
    {
      ...event,
      id: "event-tall-slot",
      title: "Длинная проектная сессия",
      start: "13:00",
      end: "16:00",
      parallelGroup: "P1",
      track: "Поток B",
    },
  ],
};

const mixedHeightsDay = {
  ...day,
  id: "day-mixed-heights",
  label: "День с разной высотой",
  events: [
    microSlotDay.events[0],
    {
      ...shortSlotDay.events[0],
      id: "event-mixed-short",
      start: "09:30",
      end: "10:00",
      parallelGroup: "P1",
      track: "Поток A",
    },
    {
      ...event,
      id: "event-mixed-regular",
      title: "Обычная лекция",
      start: "10:30",
      end: "11:30",
      parallelGroup: "A",
      track: "Общий поток",
    },
    {
      ...tallSlotDay.events[0],
      id: "event-mixed-tall",
      start: "12:00",
      end: "15:00",
      parallelGroup: "P1",
    },
  ],
};

const malformedProgram = {
  ...program,
  id: "program-malformed-table",
  title: null,
  eventContext: null,
  days: [
    null,
    {
      id: "day-malformed-table",
      label: "Неполный день",
      dateLabel: "без даты",
      events: [
        null,
        {
          id: "event-malformed-table",
          title: null,
          start: "11:00",
          end: "12:00",
          parallelGroup: null,
          track: null,
          speakerName: null,
          location: null,
          status: null,
        },
      ],
    },
  ],
};

function buildFlowColumns(flowCount = 1) {
  const count = Math.max(1, Number(flowCount) || 1);
  return Array.from({ length: count }, (_, index) => {
    const id = index === 0 ? "A" : `P${index}`;
    return {
      id,
      label: id,
      track: index === 0 ? "Общий поток" : `Поток ${index}`,
    };
  });
}

function buildControlledCalendarFixture({
  flowCount = 2,
  eventDensity = "normal",
  programStatus = "published",
  hasSpeakers = true,
} = {}) {
  const columns = buildFlowColumns(flowCount);
  const densityMap = {
    empty: 0,
    sparse: 1,
    normal: 2,
    dense: 4,
  };
  const eventsPerColumn = densityMap[eventDensity] ?? densityMap.normal;
  const starts = ["09:00", "10:30", "12:00", "14:00"];
  const ends = ["10:00", "11:15", "13:30", "15:00"];
  const events = columns.flatMap((column, columnIndex) =>
    Array.from({ length: eventsPerColumn }, (_, eventIndex) => {
      const speaker = speakersCatalog[(columnIndex + eventIndex) % speakersCatalog.length] || {};
      return {
        ...event,
        id: `controls-${column.id}-${eventIndex}`,
        title: eventIndex === 2 ? "Длинный практикум" : `Слот ${column.label}-${eventIndex + 1}`,
        start: starts[eventIndex] || "16:00",
        end: ends[eventIndex] || "17:00",
        speakerId: hasSpeakers ? speaker.id || "" : "",
        speakerName: hasSpeakers ? speaker.name || "" : "",
        location: columnIndex === 0 ? "Большой зал" : `Аудитория ${columnIndex + 1}`,
        track: column.track,
        parallelGroup: column.id,
        status: eventIndex === 0 ? "active" : "planned",
      };
    }),
  );
  const controlledDay = {
    ...day,
    id: "day-controls",
    label: "День с controls",
    dateLabel: "24 апреля",
    flowOrder: columns.map((column) => column.id),
    events,
  };
  const controlledProgram = {
    ...program,
    status: programStatus,
    days: [controlledDay],
  };

  return {
    columns,
    day: controlledDay,
    program: controlledProgram,
    speakersCatalog: hasSpeakers ? speakersCatalog : [],
  };
}

function ProgramEventFormStory(args) {
  const [value, setValue] = useState(args.value);

  useEffect(() => {
    setValue(args.value);
  }, [args.value]);

  return (
    <ProgramEventForm
      {...args}
      value={value}
      onChange={setValue}
      onSubmit={(payload) => noopAsync(payload)}
    />
  );
}

function ProgramScheduleTableStory(args) {
  const fixture = useMemo(
    () => (args.useFixtureControls ? buildControlledCalendarFixture(args) : null),
    [args.eventDensity, args.flowCount, args.hasSpeakers, args.programStatus, args.useFixtureControls],
  );
  const scheduleProgram = fixture?.program || args.program;
  const scheduleDay = fixture?.day || args.day;
  const scheduleColumns = args.flows || args.columns || fixture?.columns;
  const scheduleSpeakers = fixture?.speakersCatalog || args.speakersCatalog;
  const [storyDay, setStoryDay] = useState(scheduleDay);
  const [storyFlows, setStoryFlows] = useState(scheduleColumns || []);
  const [selectedEventId, setSelectedEventId] = useState(args.selectedEventId || null);
  const [draftEvent, setDraftEvent] = useState(args.draftEvent || null);
  const [columnOrder, setColumnOrder] = useState(args.columnOrder || scheduleDay?.flowOrder || []);

  useEffect(() => {
    setStoryDay(scheduleDay);
    setStoryFlows(scheduleColumns || []);
    setSelectedEventId(args.selectedEventId || null);
    setDraftEvent(args.draftEvent || null);
    setColumnOrder(args.columnOrder || scheduleDay?.flowOrder || []);
  }, [args.columnOrder, args.day, args.draftEvent, args.selectedEventId, scheduleColumns, scheduleDay]);

  function updateStoryFlows(nextFlows) {
    setStoryFlows(nextFlows);
    setColumnOrder(nextFlows.map((flow) => flow.id));
    setStoryDay((previous) => ({
      ...previous,
      flows: nextFlows,
      flowOrder: nextFlows.map((flow) => flow.id),
    }));
  }

  return (
    <ProgramScheduleTable
      {...args}
      program={scheduleProgram}
      day={storyDay}
      columns={storyFlows}
      flows={storyFlows}
      columnOrder={columnOrder}
      speakersCatalog={scheduleSpeakers}
      selectedEventId={selectedEventId}
      draftEvent={draftEvent}
      onSelectEvent={(_dayId, eventId) => {
        setSelectedEventId(eventId);
        setDraftEvent(null);
        console.log("select", eventId);
      }}
      onSelectEmptySlot={(_dayId, draft) => {
        setSelectedEventId(null);
        setDraftEvent(draft);
        console.log("draft", draft);
      }}
      onClearSelection={() => {
        setSelectedEventId(null);
        setDraftEvent(null);
      }}
      onUpdateEvent={(dayId, eventId, payload) => {
        setStoryDay((previous) => ({
          ...previous,
          events: (previous?.events || []).map((event) =>
            event.id === eventId ? { ...event, ...payload } : event,
          ),
        }));
        return noopAsync("update", dayId, eventId, payload);
      }}
      onReorderColumns={(dayId, nextOrder) => {
        setColumnOrder(nextOrder);
        return noopAsync("reorder-columns", dayId, nextOrder);
      }}
      onCreateFlow={(dayId, flow) => {
        const nextFlows = [...storyFlows.filter((item) => item.id !== flow.id), flow];
        updateStoryFlows(nextFlows);
        return noopAsync("create-flow", dayId, flow);
      }}
      onRenameFlow={(dayId, flowId, patch) => {
        const nextFlows = storyFlows.map((flow) => (flow.id === flowId ? { ...flow, ...patch } : flow));
        updateStoryFlows(nextFlows);
        return noopAsync("rename-flow", dayId, flowId, patch);
      }}
      onUpdateFlows={(dayId, nextFlows) => {
        updateStoryFlows(nextFlows);
        return noopAsync("update-flows", dayId, nextFlows);
      }}
      onActivateEvent={(dayId, eventId) => console.log("activate", dayId, eventId)}
    />
  );
}

function ProgramScheduleInspectorStory(args) {
  return (
    <ProgramScheduleInspector
      {...args}
      onSaveEvent={(eventId, payload) => noopAsync("inspector-save", eventId, payload)}
      onCreateEvent={(payload) => noopAsync("inspector-create", payload)}
      onCancel={() => console.log("cancel")}
    />
  );
}

function ProgramScheduleTableMultiCreateStory(args) {
  const initialColumns = args.columns || [{ id: "A", label: "A", track: "Общий поток" }];
  const [storyDay, setStoryDay] = useState({ ...args.day, events: args.day?.events || [] });
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [draftEvent, setDraftEvent] = useState(null);
  const selectedEvent = (storyDay.events || []).find((event) => event.id === selectedEventId) || null;

  function createEvent(payload) {
    const nextEvent = {
      id: `event-created-${(storyDay.events || []).length + 1}`,
      title: payload.title || `Созданный слот ${(storyDay.events || []).length + 1}`,
      ...payload,
    };
    setStoryDay((previous) => ({
      ...previous,
      events: [...(previous.events || []), nextEvent],
    }));
    setDraftEvent(null);
    setSelectedEventId(nextEvent.id);
    return noopAsync("create-event", nextEvent);
  }

  function updateEvent(eventId, payload) {
    setStoryDay((previous) => ({
      ...previous,
      events: (previous.events || []).map((event) =>
        event.id === eventId ? { ...event, ...payload } : event,
      ),
    }));
    return noopAsync("update-event", eventId, payload);
  }

  return (
    <div className="organizer-table-mode-grid">
      <ProgramScheduleTable
        {...args}
        day={storyDay}
        columns={initialColumns}
        flows={initialColumns}
        selectedEventId={selectedEventId}
        draftEvent={draftEvent}
        onSelectEvent={(_dayId, eventId) => {
          setSelectedEventId(eventId);
          setDraftEvent(null);
        }}
        onSelectEmptySlot={(_dayId, draft) => {
          setSelectedEventId(null);
          setDraftEvent(draft);
        }}
        onClearSelection={() => {
          setSelectedEventId(null);
          setDraftEvent(null);
        }}
        onUpdateEvent={(_dayId, eventId, payload) => updateEvent(eventId, payload)}
      />
      <ProgramScheduleInspector
        mode={draftEvent ? "create" : selectedEvent ? "edit" : "empty"}
        program={args.program}
        day={storyDay}
        event={selectedEvent}
        draftEvent={draftEvent}
        eventTypes={args.eventTypes}
        speakersCatalog={args.speakersCatalog}
        parallelGroupOptions={initialColumns}
        minDurationMinutes={args.slotMinutes || 15}
        onCreateEvent={createEvent}
        onSaveEvent={updateEvent}
        onCancel={() => {
          setSelectedEventId(null);
          setDraftEvent(null);
        }}
      />
    </div>
  );
}

export const ProgramSelectorMultiple = {
  args: {
    programs: workspace.programWorkspace.programs,
    currentProgram: program,
    currentDay: day,
    activeEventId: workspace.programWorkspace.activeEventId,
    saving: false,
  },
  render: (args) => (
    <ProgramSelector
      {...args}
      onSelectProgram={(id) => console.log("program", id)}
      onSelectDay={(id) => console.log("day", id)}
      onActivateEvent={(programId, dayId, eventId) => console.log("activate", programId, dayId, eventId)}
    />
  ),
};

export const ProgramSelectorEmpty = {
  args: {
    programs: [],
    currentProgram: null,
    currentDay: null,
    activeEventId: null,
    saving: false,
  },
  render: (args) => (
    <ProgramSelector
      {...args}
      onSelectProgram={() => {}}
      onSelectDay={() => {}}
      onActivateEvent={() => {}}
    />
  ),
};

export const ProgramScheduleToolbarControls = {
  args: {
    programs: workspace.programWorkspace.programs,
    currentProgram: program,
    currentDay: day,
    viewMode: "table",
    slotMinutes: 15,
    title: "Конструктор программы",
    programLabel: "Программа",
    dayLabel: "День",
    compact: false,
    saving: false,
    disabled: false,
  },
  render: (args) => (
    <ProgramScheduleToolbar
      {...args}
      onViewModeChange={(mode) => console.log("viewMode", mode)}
      onSelectProgram={(id) => console.log("program", id)}
      onSelectDay={(id) => console.log("day", id)}
      onCreateDay={() => console.log("create-day")}
      onDeleteDay={(id) => console.log("delete-day", id)}
      onPublishProgram={() => console.log("publish-program")}
      onDraftProgram={() => console.log("draft-program")}
    />
  ),
};

export const ProgramScheduleToolbarDraft = {
  ...ProgramScheduleToolbarControls,
  args: {
    ...ProgramScheduleToolbarControls.args,
    currentProgram: draftProgram,
  },
};

export const ProgramScheduleToolbarPublished = {
  ...ProgramScheduleToolbarControls,
  args: {
    ...ProgramScheduleToolbarControls.args,
    currentProgram: program,
  },
};

export const ProgramScheduleToolbarSaving = {
  ...ProgramScheduleToolbarControls,
  args: {
    ...ProgramScheduleToolbarControls.args,
    currentProgram: draftProgram,
    saving: true,
  },
};

export const ProgramDayTabsControls = {
  args: {
    days: program.days,
    currentDayId: day.id,
    disabled: false,
    compact: false,
  },
  render: (args) => <ProgramDayTabs {...args} onChange={(id) => console.log("day", id)} />,
};

export const ProgramScheduleTableDefault = {
  args: {
    program,
    day,
    slotMinutes: 15,
    defaultDurationMinutes: 60,
    rowHeight: 48,
    columnMinWidth: 220,
    timeColumnWidth: 86,
    showAddButtons: true,
    allowDrag: true,
    allowResize: true,
    allowColumnReorder: true,
    allowCreateFlow: true,
    clearSelectionOnEmptyClick: true,
    createOnEmptyClickWhenIdle: true,
    calendarMaxHeight: "min(72vh, 760px)",
    calendarMinHeight: 320,
    stickyHeader: true,
    inlineEditableFields: ["title", "track", "speakerName", "location"],
    showTimeRail: true,
    flowCount: 2,
    eventDensity: "normal",
    programStatus: "published",
    hasSpeakers: true,
    useFixtureControls: true,
    eventTypes,
    speakersCatalog,
    parallelGroupOptions: [
      { id: "A", label: "A", track: "Общий поток" },
      { id: "P1", label: "P1", track: "Поток A" },
      { id: "P2", label: "P2", track: "Поток B" },
    ],
    allowNewParallelGroup: true,
    saving: false,
    disabled: false,
  },
  render: (args) => <ProgramScheduleTableStory {...args} />,
};

export const ProgramScheduleTableSeveralFlows = {
  ...ProgramScheduleTableDefault,
  args: {
    ...ProgramScheduleTableDefault.args,
    program: denseProgram,
    day: denseDay,
    useFixtureControls: false,
    columns: [
      { id: "A", label: "A", track: "Общий поток" },
      { id: "P1", label: "P1", track: "Поток A" },
      { id: "P2", label: "P2", track: "Поток B" },
    ],
  },
};

export const ProgramScheduleTableDurations = {
  ...ProgramScheduleTableDefault,
  args: {
    ...ProgramScheduleTableDefault.args,
    program: { ...program, days: [durationDay] },
    day: durationDay,
    useFixtureControls: false,
    columns: [
      { id: "A", label: "A", track: "Общий поток" },
      { id: "P1", label: "P1", track: "Поток A" },
      { id: "P2", label: "P2", track: "Поток B" },
    ],
    timeStart: "08:45",
    timeEnd: "16:30",
  },
};

export const ProgramScheduleTableMalformedData = {
  ...ProgramScheduleTableDefault,
  args: {
    ...ProgramScheduleTableDefault.args,
    program: malformedProgram,
    day: malformedProgram.days[1],
    useFixtureControls: false,
    columns: [null, "A"],
    timeStart: "10:00",
    timeEnd: "13:00",
  },
};

export const ProgramScheduleTableMicroSlot = {
  ...ProgramScheduleTableDefault,
  args: {
    ...ProgramScheduleTableDefault.args,
    program: { ...program, days: [microSlotDay] },
    day: microSlotDay,
    useFixtureControls: false,
    timeStart: "08:45",
    timeEnd: "09:45",
    rowHeight: 48,
  },
};

export const ProgramScheduleTableShortSlot = {
  ...ProgramScheduleTableDefault,
  args: {
    ...ProgramScheduleTableDefault.args,
    program: { ...program, days: [shortSlotDay] },
    day: shortSlotDay,
    useFixtureControls: false,
    timeStart: "09:45",
    timeEnd: "10:45",
    rowHeight: 48,
  },
};

export const ProgramScheduleTableTallSlot = {
  ...ProgramScheduleTableDefault,
  args: {
    ...ProgramScheduleTableDefault.args,
    program: { ...program, days: [tallSlotDay] },
    day: tallSlotDay,
    useFixtureControls: false,
    columns: ["A", "P1"],
    timeStart: "12:45",
    timeEnd: "16:15",
    rowHeight: 48,
  },
};

export const ProgramScheduleTableMixedHeights = {
  ...ProgramScheduleTableDefault,
  args: {
    ...ProgramScheduleTableDefault.args,
    program: { ...program, days: [mixedHeightsDay] },
    day: mixedHeightsDay,
    useFixtureControls: false,
    columns: ["A", "P1"],
    timeStart: "08:45",
    timeEnd: "15:15",
    rowHeight: 48,
  },
};

export const ProgramScheduleTableDense = {
  ...ProgramScheduleTableDefault,
  args: {
    ...ProgramScheduleTableDefault.args,
    program: denseProgram,
    useFixtureControls: false,
    day: {
      ...denseDay,
      events: [
        ...denseDay.events,
        {
          ...denseDay.events[0],
          id: "event-d2-mini-1",
          title: "Разбор кейсов",
          start: "11:45",
          end: "12:30",
          parallelGroup: "P1",
          track: "Поток A",
        },
        {
          ...denseDay.events[1],
          id: "event-d2-mini-2",
          title: "Тихая альтернатива",
          start: "11:45",
          end: "12:30",
          parallelGroup: "P2",
          track: "Поток B",
        },
      ],
    },
    slotMinutes: 15,
  },
};

export const ProgramScheduleTableConflict = {
  ...ProgramScheduleTableDefault,
  args: {
    ...ProgramScheduleTableDefault.args,
    program: { ...program, days: [conflictDay] },
    day: conflictDay,
    useFixtureControls: false,
    selectedEventId: "event-conflict-b",
  },
};

export const ProgramScheduleTableEmptyDay = {
  ...ProgramScheduleTableDefault,
  args: {
    ...ProgramScheduleTableDefault.args,
    program: emptyDayProgram,
    day: emptyDay,
    useFixtureControls: false,
    timeStart: "09:00",
    timeEnd: "18:00",
    columns: ["A", "P1"],
    draftEvent: {
      title: "",
      start: "11:00",
      end: "12:00",
      type: "Практикум",
      speakerId: "",
      location: "",
      track: "Поток A",
      parallelGroup: "P1",
      status: "planned",
      tags: "",
      description: "",
    },
  },
};

export const ProgramScheduleTableMultiCreateRegression = {
  ...ProgramScheduleTableDefault,
  args: {
    ...ProgramScheduleTableDefault.args,
    program: emptyDayProgram,
    day: { ...emptyDay, events: [] },
    useFixtureControls: false,
    timeStart: "09:00",
    timeEnd: "18:00",
    columns: [{ id: "A", label: "A", track: "Общий поток" }],
    draftEvent: null,
    selectedEventId: null,
  },
  render: (args) => <ProgramScheduleTableMultiCreateStory {...args} />,
};

export const ProgramScheduleTableIrregularTime = {
  ...ProgramScheduleTableDefault,
  args: {
    ...ProgramScheduleTableDefault.args,
    program,
    day: {
      ...day,
      id: "day-irregular-time",
      label: "День с некруглым временем",
      events: [
        {
          id: "event-irregular-1",
          title: "Некруглый слот",
          start: "16:10",
          end: "16:50",
          type: "Практикум",
          speakerId: "",
          speakerName: "",
          location: "Зал 2",
          track: "Общий поток",
          parallelGroup: "A",
          status: "planned",
          tags: [],
          description: "",
        },
      ],
    },
    useFixtureControls: false,
    timeStart: "15:45",
    timeEnd: "17:15",
    columns: [{ id: "A", label: "A", track: "Общий поток" }],
  },
};

export const ProgramScheduleTableCreateFlow = {
  ...ProgramScheduleTableDefault,
  args: {
    ...ProgramScheduleTableDefault.args,
    program: emptyDayProgram,
    day: emptyDay,
    useFixtureControls: false,
    columns: [{ id: "A", label: "A", track: "Общий поток" }],
    allowCreateFlow: true,
    timeStart: "09:00",
    timeEnd: "14:00",
  },
};

export const ProgramScheduleTableRenameFlow = {
  ...ProgramScheduleTableDefault,
  args: {
    ...ProgramScheduleTableDefault.args,
    program: denseProgram,
    day: denseDay,
    useFixtureControls: false,
    columns: [
      { id: "A", label: "Общий", track: "Все участники" },
      { id: "P1", label: "Мастерская A", track: "Поток A" },
      { id: "P2", label: "Мастерская B", track: "Поток B" },
    ],
    allowCreateFlow: true,
  },
};

export const ProgramScheduleTableInlineEditing = {
  ...ProgramScheduleTableDefault,
  args: {
    ...ProgramScheduleTableDefault.args,
    program: denseProgram,
    day: denseDay,
    useFixtureControls: false,
    columns: ["A", "P1", "P2"],
    inlineEditableFields: ["title", "track", "speakerName", "location"],
    selectedEventId: denseDay.events[0]?.id,
  },
};

export const ProgramScheduleTableConstrainedScroll = {
  ...ProgramScheduleTableDefault,
  args: {
    ...ProgramScheduleTableDefault.args,
    flowCount: 5,
    eventDensity: "dense",
    calendarMaxHeight: "360px",
    calendarMinHeight: 220,
    rowHeight: 52,
    stickyHeader: true,
  },
};

export const ProgramScheduleTableSaving = {
  ...ProgramScheduleTableDefault,
  args: {
    ...ProgramScheduleTableDefault.args,
    saving: true,
  },
};

export const ProgramScheduleInspectorEmpty = {
  args: {
    mode: "empty",
    program,
    day,
    eventTypes,
    speakersCatalog,
    saving: false,
    disabled: false,
    minDurationMinutes: 15,
    title: "",
    emptyTitle: "Выберите слот или мероприятие",
    emptyDescription: "Форма появится после выбора события или пустого слота.",
    showProgramBadge: true,
    validateBeforeSubmit: true,
  },
  render: (args) => <ProgramScheduleInspectorStory {...args} />,
};

export const ProgramScheduleInspectorCreate = {
  args: {
    ...ProgramScheduleInspectorEmpty.args,
    mode: "create",
    draftEvent: {
      title: "",
      start: "13:00",
      end: "14:00",
      type: "Практикум",
      speakerId: "",
      location: "Аудитория 3",
      track: "Поток A",
      parallelGroup: "P1",
      status: "planned",
      tags: "",
      description: "",
    },
  },
  render: (args) => <ProgramScheduleInspectorStory {...args} />,
};

export const ProgramScheduleInspectorEdit = {
  args: {
    ...ProgramScheduleInspectorEmpty.args,
    mode: "edit",
    event,
  },
  render: (args) => <ProgramScheduleInspectorStory {...args} />,
};

export const ProgramScheduleInspectorConflict = {
  args: {
    ...ProgramScheduleInspectorCreate.args,
    day: conflictDay,
    draftEvent: {
      ...ProgramScheduleInspectorCreate.args.draftEvent,
      start: "10:15",
      end: "10:45",
      parallelGroup: "A",
      track: "Общий поток",
    },
  },
  render: (args) => <ProgramScheduleInspectorStory {...args} />,
};

export const ProgramScheduleInspectorSaving = {
  args: {
    ...ProgramScheduleInspectorEdit.args,
    saving: true,
  },
  render: (args) => <ProgramScheduleInspectorStory {...args} />,
};

export const ProgramEventFormControls = {
  args: {
    value: event,
    eventTypes,
    speakersCatalog,
    parallelGroupOptions: ProgramScheduleInspectorEmpty.args.parallelGroupOptions,
    allowNewParallelGroup: true,
    saving: false,
    disabled: false,
    submitLabel: "Сохранить мероприятие",
  },
  render: (args) => <ProgramEventFormStory {...args} />,
};

export const ProgramEventDialogCreate = {
  args: {
    open: true,
    mode: "create",
    initialValue: {
      title: "",
      start: "13:00",
      end: "14:00",
      type: "Практикум",
      speakerId: "",
      location: "Аудитория 3",
      track: "Поток A",
      parallelGroup: "P1",
      status: "planned",
      tags: "",
      description: "",
    },
    eventTypes,
    speakersCatalog,
    saving: false,
    disabled: false,
  },
  render: (args) => (
    <ProgramEventDialog
      {...args}
      onClose={() => console.log("close")}
      onSubmit={(payload) => noopAsync("dialog-create", payload)}
    />
  ),
};

export const ProgramEventDialogEdit = {
  ...ProgramEventDialogCreate,
  args: {
    ...ProgramEventDialogCreate.args,
    mode: "edit",
    event,
  },
};

export const ProgramMetaEditorFilled = {
  args: {
    program,
    saving: false,
  },
  render: (args) => <ProgramMetaEditor {...args} onSave={noopAsync} onPublish={noopAsync} />,
};

export const ProgramMetaEditorDraftPublish = {
  args: {
    program: draftProgram,
    saving: false,
  },
  render: (args) => <ProgramMetaEditor {...args} onSave={noopAsync} onPublish={noopAsync} />,
};

export const ProgramMetaEditorPublished = {
  args: {
    program,
    saving: false,
  },
  render: (args) => <ProgramMetaEditor {...args} onSave={noopAsync} onPublish={noopAsync} />,
};

export const ProgramMetaEditorSaving = {
  args: {
    program: draftProgram,
    saving: true,
  },
  render: (args) => <ProgramMetaEditor {...args} onSave={noopAsync} onPublish={noopAsync} />,
};

export const ProgramCreate = {
  args: {
    saving: false,
  },
  render: (args) => <ProgramCreateCard {...args} onCreate={noopAsync} />,
};

export const ProgramDayComposerDefault = {
  args: {
    program,
    currentDay: day,
    saving: false,
  },
  render: (args) => (
    <ProgramDayComposer
      {...args}
      onCreate={noopAsync}
      onUpdate={(dayId, payload) => noopAsync({ dayId, ...payload })}
      onDelete={(dayId) => noopAsync("delete-day", dayId)}
    />
  ),
};

export const EventEditorWithSpeaker = {
  args: {
    event,
    eventTypes,
    speakersCatalog,
    isActive: true,
    saving: false,
  },
  render: (args) => (
    <EventEditorCard
      {...args}
      onSave={noopAsync}
      onActivate={() => console.log("activate")}
    />
  ),
};

export const EventEditorWithoutSpeaker = {
  args: {
    event: { ...event, speakerId: "", speakerName: "", status: "planned" },
    eventTypes,
    speakersCatalog,
    isActive: false,
    saving: false,
  },
  render: (args) => (
    <EventEditorCard
      {...args}
      onSave={noopAsync}
      onActivate={() => console.log("activate")}
    />
  ),
};

export const ParallelComposer = {
  args: {
    day,
    eventTypes,
    speakersCatalog,
    saving: false,
  },
  render: (args) => <ParallelEventComposer {...args} onSubmit={noopAsync} />,
};

export const Timeline = {
  args: {
    events: day.events,
    activeEventId: workspace.programWorkspace.activeEventId,
  },
  render: (args) => (
    <EventTimeline
      {...args}
      onActivate={(eventId) => console.log("activate", eventId)}
    />
  ),
};

export const GroupsSummaryDefault = {
  args: {
    groups: workspace.groupsSummary.groups,
    alerts: workspace.groupsSummary.alerts,
    audiencePool: workspace.audiencePool,
  },
  render: (args) => <GroupsSummary {...args} />,
};

export const GroupsSummaryNoRisks = {
  args: {
    groups: workspace.groupsSummary.groups.map((group) => ({ ...group, riskCases: 0, completion: 98 })),
    alerts: [],
    audiencePool: workspace.audiencePool,
  },
  render: (args) => <GroupsSummary {...args} />,
};

export const ParticipantSearch = {
  args: {
    groups: workspace.groupsSummary.groups,
    participants: workspace.audiencePool,
    selectedGroupId: "all",
    query: "",
    selectedParticipantId: workspace.audiencePool[0].id,
  },
  render: (args) => (
    <ParticipantSearchPanel
      {...args}
      onGroupChange={(id) => console.log("group", id)}
      onQueryChange={(query) => console.log("query", query)}
      onSelectParticipant={(id) => console.log("participant", id)}
    />
  ),
};

export const ParticipantSearchEmpty = {
  args: {
    groups: workspace.groupsSummary.groups,
    participants: [],
    selectedGroupId: "group-3",
    query: "нет совпадений",
    selectedParticipantId: null,
  },
  render: (args) => (
    <ParticipantSearchPanel
      groups={workspace.groupsSummary.groups}
      participants={[]}
      selectedGroupId="group-3"
      query="нет совпадений"
      selectedParticipantId={null}
      {...args}
      onGroupChange={() => {}}
      onQueryChange={() => {}}
      onSelectParticipant={() => {}}
    />
  ),
};

export const ParticipantDetailsFull = {
  args: {
    participant: workspace.audiencePool[1],
  },
  render: (args) => <ParticipantDetailsCard {...args} />,
};

export const ParticipantDetailsEmpty = {
  args: {
    participant: null,
  },
  render: (args) => <ParticipantDetailsCard {...args} />,
};
