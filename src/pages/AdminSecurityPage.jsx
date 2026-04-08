import { useAdminDashboard } from "../api/hooks";
import FeedbackState from "../components/FeedbackState";
import AdminSecurityView from "../views/AdminSecurityView";

function AdminSecurityPage() {
  const { data, loading, error, refresh } = useAdminDashboard();

  if (loading && !data) {
    return (
      <FeedbackState
        title="Загружаем контур безопасности"
        description="Получаем матрицу ролей, политику хранения и последние аудит-события."
      />
    );
  }

  if (error) {
    return (
      <FeedbackState
        title="Не удалось загрузить админ-раздел"
        description="У текущего пользователя нет доступа к security-разделу или mock API вернул ошибку."
        actionLabel="Повторить"
        onAction={refresh}
      />
    );
  }

  return <AdminSecurityView dashboard={data} />;
}

export default AdminSecurityPage;
