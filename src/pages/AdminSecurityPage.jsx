import { useAdminWorkspace } from "../api/hooks";
import FeedbackState from "../components/FeedbackState";
import AdminCabinetView from "../views/AdminCabinetView";

function AdminSecurityPage() {
  const {
    data,
    loading,
    error,
    refresh,
    saving,
    mutationError,
    createUser,
    updateUser,
    updateUserStatus,
    upsertAssignment,
    createSession,
    updateSession,
    updateRegistration,
  } = useAdminWorkspace();

  if (loading && !data) {
    return (
      <FeedbackState
        title="Загружаем админский кабинет"
        description="Получаем пользователей, роли, заезды, назначения, статусы регистрации и аудит."
      />
    );
  }

  if (error || !data) {
    return (
      <FeedbackState
        title="Не удалось загрузить админский раздел"
        description="Проверьте backend API, права текущего пользователя и подключение к PostgreSQL."
        actionLabel="Повторить"
        onAction={refresh}
      />
    );
  }

  return (
    <AdminCabinetView
      workspace={data}
      saving={saving}
      mutationError={mutationError}
      onCreateUser={createUser}
      onUpdateUser={updateUser}
      onUpdateUserStatus={updateUserStatus}
      onUpsertAssignment={upsertAssignment}
      onCreateSession={createSession}
      onUpdateSession={updateSession}
      onUpdateRegistration={updateRegistration}
    />
  );
}

export default AdminSecurityPage;
