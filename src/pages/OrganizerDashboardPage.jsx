import { useNavigate, useParams } from "react-router-dom";
import { useOrganizerWorkspace } from "../api/hooks";
import FeedbackState from "../components/FeedbackState";
import OrganizerCabinetView from "../views/OrganizerCabinetView";

function OrganizerDashboardPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const {
    data,
    loading,
    error,
    refresh,
    saving,
    mutationError,
    createSession,
    updateSession,
    createProgram,
    updateProgram,
    publishProgram,
    draftProgram,
    selectProgram,
    createProgramDay,
    updateProgramDay,
    deleteProgramDay,
    updateProgramDayFlowOrder,
    updateProgramDayFlows,
    updateEvent,
    addParallelEvent,
    deleteEvent,
    activateEvent,
    createGroup,
    updateGroup,
    deleteGroup,
    assignGroupCurator,
    assignGroupParticipants,
  } = useOrganizerWorkspace(sessionId);

  if (loading && !data) {
    return (
      <FeedbackState
        title="Загружаем кабинет организатора"
        description="Поднимаем программу, сводки по заезду, группы, участников и рабочее пространство редактирования."
      />
    );
  }

  if (error || !data) {
    return (
      <FeedbackState
        title="Не удалось загрузить рабочее пространство"
        description="Проверьте backend API, доступ к выбранному заезду и параметры подключения к PostgreSQL."
        actionLabel="Повторить"
        onAction={refresh}
      />
    );
  }

  return (
    <OrganizerCabinetView
      workspace={data}
      saving={saving}
      mutationError={mutationError}
      onCreateSession={createSession}
      onUpdateSession={updateSession}
      onSessionCreated={(session) => navigate(`/organizer/session/${session.id}`)}
      onCreateProgram={createProgram}
      onUpdateProgram={updateProgram}
      onPublishProgram={publishProgram}
      onDraftProgram={draftProgram}
      onSelectProgram={selectProgram}
      onCreateProgramDay={createProgramDay}
      onUpdateProgramDay={updateProgramDay}
      onDeleteProgramDay={deleteProgramDay}
      onUpdateProgramDayFlowOrder={updateProgramDayFlowOrder}
      onUpdateProgramDayFlows={updateProgramDayFlows}
      onUpdateEvent={updateEvent}
      onAddParallelEvent={addParallelEvent}
      onDeleteEvent={deleteEvent}
      onActivateEvent={activateEvent}
      onCreateGroup={createGroup}
      onUpdateGroup={updateGroup}
      onDeleteGroup={deleteGroup}
      onAssignGroupCurator={assignGroupCurator}
      onAssignGroupParticipants={assignGroupParticipants}
    />
  );
}

export default OrganizerDashboardPage;
