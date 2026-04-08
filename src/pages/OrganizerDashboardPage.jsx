import { useParams } from "react-router-dom";
import { useOrganizerDashboard } from "../api/hooks";
import FeedbackState from "../components/FeedbackState";
import OrganizerDashboardView from "../views/OrganizerDashboardView";

function OrganizerDashboardPage() {
  const { sessionId } = useParams();
  const { data, loading, error, refresh } = useOrganizerDashboard(sessionId);

  if (loading && !data) {
    return (
      <FeedbackState
        title="Загружаем аналитику заезда"
        description="Получаем сравнение групп, проблемные события, типологии и ИИ-отчёты по выбранному заезду."
      />
    );
  }

  if (error) {
    return (
      <FeedbackState
        title="Не удалось загрузить заезд"
        description="Текущий пользователь не может просматривать этот заезд или mock API вернул ошибку."
        actionLabel="Повторить"
        onAction={refresh}
      />
    );
  }

  return <OrganizerDashboardView dashboard={data} />;
}

export default OrganizerDashboardPage;
