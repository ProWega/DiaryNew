import { useEffect, useMemo, useState } from "react";
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
  ProgramCreateCard,
  ProgramMetaEditor,
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

function OrganizerCabinetView({
  workspace,
  initialTab = "program",
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
  onUpdateEvent = async () => null,
  onAddParallelEvent = async () => null,
  onActivateEvent = async () => null,
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [sessionQuery, setSessionQuery] = useState("");
  const [sessionDraft, setSessionDraft] = useState(null);
  const [registrationDraft, setRegistrationDraft] = useState(workspace.registration || {});
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [selectedProgramId, setSelectedProgramId] = useState(
    workspace.programWorkspace.currentProgramId,
  );
  const [selectedDayId, setSelectedDayId] = useState(null);
  const [selectedGroupId, setSelectedGroupId] = useState("all");
  const [participantQuery, setParticipantQuery] = useState("");
  const [selectedParticipantId, setSelectedParticipantId] = useState(
    workspace.audiencePool[0]?.id || null,
  );

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    const currentSession =
      workspace.sessionCatalog?.find((session) => session.id === workspace.sessionId) || {
        id: workspace.sessionId,
        name: workspace.sessionLabel,
        registrationStatus: workspace.registration?.status,
        registrationStartsAt: workspace.registration?.startsAt,
        registrationEndsAt: workspace.registration?.endsAt,
        registrationCapacity: workspace.registration?.capacity,
        registrationPolicy: workspace.registration?.policy,
        participantsCount: workspace.registration?.participantsCount,
      };
    setSessionDraft(currentSession);
    setRegistrationDraft({
      ...currentSession,
      registrationStatus: workspace.registration?.status || currentSession.registrationStatus,
      registrationStartsAt: workspace.registration?.startsAt || currentSession.registrationStartsAt,
      registrationEndsAt: workspace.registration?.endsAt || currentSession.registrationEndsAt,
      registrationCapacity: workspace.registration?.capacity ?? currentSession.registrationCapacity,
      registrationPolicy: workspace.registration?.policy || currentSession.registrationPolicy || {},
    });
  }, [workspace]);

  useEffect(() => {
    if (!selectedProgramId) {
      setSelectedProgramId(workspace.programWorkspace.currentProgramId);
    }
  }, [selectedProgramId, workspace.programWorkspace.currentProgramId]);

  const currentProgram =
    workspace.programWorkspace.programs.find((program) => program.id === selectedProgramId) ||
    workspace.programWorkspace.programs[0] ||
    null;
  const eventTypes = workspace.programWorkspace.reference?.eventTypes || [];
  const speakersCatalog = workspace.programWorkspace.speakersCatalog || [];

  useEffect(() => {
    if (!currentProgram) {
      setSelectedDayId(null);
      return;
    }

    if (!selectedDayId || !currentProgram.days.some((day) => day.id === selectedDayId)) {
      setSelectedDayId(currentProgram.days[0]?.id || null);
    }
  }, [currentProgram, selectedDayId]);

  const currentDay =
    currentProgram?.days.find((day) => day.id === selectedDayId) || currentProgram?.days[0] || null;

  const participantList = useMemo(() => {
    const normalizedQuery = participantQuery.trim().toLowerCase();

    return workspace.audiencePool.filter((participant) => {
      const matchesGroup =
        selectedGroupId === "all" ? true : participant.groupId === selectedGroupId;
      const matchesQuery =
        !normalizedQuery ||
        participant.fullName.toLowerCase().includes(normalizedQuery) ||
        participant.emotionalProfile.toLowerCase().includes(normalizedQuery) ||
        participant.identityStatus.toLowerCase().includes(normalizedQuery);

      return matchesGroup && matchesQuery;
    });
  }, [participantQuery, selectedGroupId, workspace.audiencePool]);

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

    const nextProgram = nextWorkspace.programWorkspace.programs[0];
    setSelectedProgramId(nextProgram?.id || null);
    setSelectedDayId(nextProgram?.days[0]?.id || null);
    return nextWorkspace;
  }

  async function handleCreateSession(payload) {
    const session = await onCreateSession(payload);
    if (session) {
      setIsCreatingSession(false);
      onSessionCreated?.(session);
    }
  }

  async function handleProgramSelect(programId) {
    setSelectedProgramId(programId);
    const nextWorkspace = await onSelectProgram(programId);
    if (!nextWorkspace) {
      return;
    }

    const nextProgram = nextWorkspace.programWorkspace.programs.find((item) => item.id === programId);
    setSelectedDayId(nextProgram?.days[0]?.id || null);
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
          <MetricBadge label="Текущее мероприятие" value={workspace.summary.activeEventLabel} />
          <MetricBadge label="Программ" value={workspace.summary.programsCount} />
          <MetricBadge label="Спикеров" value={workspace.summary.speakersCount} />
          <MetricBadge label="Участников" value={workspace.audiencePool.length} />
        </div>
      </div>

      <div className="scope-strip organizer-toolbar">
        <Tabs items={TAB_OPTIONS} activeId={activeTab} onChange={setActiveTab} ariaLabel="Разделы организатора" />

        <div className="pill-grid">
          <SoftPill>Storage: {workspace.meta?.storageMode || "memory"}</SoftPill>
          <SoftPill outline>Обновлено: {formatPublicationDate(workspace.meta?.updatedAt)}</SoftPill>
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
        <div className="organizer-focus-grid">
          <ProgramSelector
            programs={workspace.programWorkspace.programs}
            currentProgram={currentProgram}
            currentDay={currentDay}
            activeEventId={workspace.programWorkspace.activeEventId}
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

            <ProgramCreateCard saving={saving} onCreate={handleCreateProgram} />

            {currentDay ? (
              <>
                <ProgramDayComposer
                  program={currentProgram}
                  currentDay={currentDay}
                  saving={saving}
                  onCreate={(payload) => onCreateProgramDay(currentProgram.id, payload)}
                  onUpdate={(dayId, payload) => onUpdateProgramDay(currentProgram.id, dayId, payload)}
                />
                {currentDay.events.map((event) => (
                  <EventEditorCard
                    key={event.id}
                    event={event}
                    eventTypes={eventTypes}
                    speakersCatalog={speakersCatalog}
                    isActive={workspace.programWorkspace.activeEventId === event.id}
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
      ) : null}

      {activeTab === "sessions" ? (
        <div className="organizer-focus-grid">
          <SessionCatalog
            sessions={workspace.sessionCatalog || []}
            selectedSessionId={workspace.sessionId}
            query={sessionQuery}
            onQueryChange={setSessionQuery}
            onSelectSession={(sessionId) => {
              const selected = workspace.sessionCatalog?.find((session) => session.id === sessionId);
              if (selected) {
                onSessionCreated?.(selected);
              }
            }}
          />
          <div className="organizer-section-stack">
            <button
              type="button"
              className="primary-button"
              disabled={saving}
              onClick={() => {
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
            {sessionDraft ? (
              <SessionEditorForm
                value={sessionDraft}
                mode={isCreatingSession ? "create" : "edit"}
                saving={saving}
                onChange={setSessionDraft}
                onSubmit={(payload) =>
                  isCreatingSession ? handleCreateSession(payload) : onUpdateSession(payload)
                }
                onCancel={() => setIsCreatingSession(false)}
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
          groups={workspace.groupsSummary.groups}
          alerts={workspace.groupsSummary.alerts}
          audiencePool={workspace.audiencePool}
        />
      ) : null}

      {activeTab === "participants" ? (
        <div className="organizer-focus-grid">
          <ParticipantSearchPanel
            groups={workspace.groupsSummary.groups}
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
