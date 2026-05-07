import { useReturnPoints } from "../api/hooks";
import FeedbackState from "../components/FeedbackState";
import ReturnPointsView from "../views/ReturnPoints/ReturnPointsView";

function ReturnPointsPage() {
  const { data, loading, error, refresh, submit, submitting } = useReturnPoints();

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

  return <ReturnPointsView data={data} onSubmit={submit} submitting={submitting} />;
}

export default ReturnPointsPage;
