import { useParams } from "react-router-dom";
import { useCuratorDashboard } from "../api/hooks";
import FeedbackState from "../components/FeedbackState";
import CuratorDashboardView from "../views/CuratorDashboardView";

function CuratorDashboardPage() {
  const { sessionId, groupId } = useParams();
  const { data, loading, error, refresh, analyzeComments } = useCuratorDashboard(sessionId, groupId);

  if (loading && !data) {
    return (
      <FeedbackState
        title="Загружаем аналитику группы"
        description="Собираем агрегаты, сигналы риска, кластеры комментариев и индивидуальные траектории."
      />
    );
  }

  if (error) {
    return (
      <FeedbackState
        title="Не удалось загрузить группу"
        description="Либо выбран не тот контур группы, либо API-слой вернул ошибку."
        actionLabel="Повторить"
        onAction={refresh}
      />
    );
  }

  return <CuratorDashboardView dashboard={data} onAnalyzeComments={analyzeComments} />;
}

export default CuratorDashboardPage;
