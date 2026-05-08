import { useAuth } from "../auth/AuthContext";
import { useReturnPoints } from "../api/hooks";
import FeedbackState from "../components/FeedbackState";
import ReturnPointsView from "../views/ReturnPoints/ReturnPointsView";

function isActiveSession(sessionInfo) {
  const endDate = sessionInfo?.endDate;
  if (!endDate) return false;
  const end = new Date(endDate);
  if (Number.isNaN(end.getTime())) return false;
  // The session is active if its end date hasn't yet passed.
  return end.getTime() >= Date.now();
}

function ReturnPointsPage() {
  const { bootstrap } = useAuth();
  const { data, loading, error, refresh, submit, submitting } = useReturnPoints();
  const hasActiveSession = isActiveSession(bootstrap?.sessionInfo);

  if (loading && !data) {
    return (
      <FeedbackState
        title="Собираем точки возврата"
        description="Считаем интервалы по каждой смене, в которой вы были."
      />
    );
  }

  if (error) {
    return (
      <FeedbackState
        title="Не удалось загрузить точки возврата"
        description="Похоже, API-слой вернул ошибку."
        actionLabel="Повторить"
        onAction={refresh}
      />
    );
  }

  return (
    <ReturnPointsView
      data={data}
      onSubmit={submit}
      submitting={submitting}
      hasActiveSession={hasActiveSession}
    />
  );
}

export default ReturnPointsPage;
