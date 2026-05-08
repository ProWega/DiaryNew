import { useParams } from "react-router-dom";
import { useSubmissionStatus } from "./api";

const KIND_LABELS = {
  podcast: "Подкаст",
  story: "Личная история",
  chronicle: "Событие летописи",
};

const STATUS_LABELS = {
  pending: { label: "На модерации", tone: "pending" },
  approved: { label: "Одобрена", tone: "approved" },
  rejected: { label: "Отклонена", tone: "rejected" },
};

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function SubmissionStatusPage() {
  const { token } = useParams();
  const query = useSubmissionStatus(token);

  return (
    <main className="istoki-status-shell">
      <section className="istoki-status-card">
        <div className="istoki-hero-eyebrow">Статус заявки</div>
        {query.isLoading && <p className="istoki-status-loading">Загружаем…</p>}
        {query.isError && (
          <p className="istoki-status-error">Заявка не найдена или ссылка устарела.</p>
        )}
        {query.data && (
          <>
            <h1 className="istoki-status-title">
              {KIND_LABELS[query.data.kind] || query.data.kind}
            </h1>
            <div className="istoki-status-meta">
              {query.data.regionCode && (
                <div>
                  <span className="istoki-status-meta-label">Регион</span>
                  <span>{query.data.regionCode}</span>
                </div>
              )}
              <div>
                <span className="istoki-status-meta-label">Подана</span>
                <span>{formatDate(query.data.createdAt)}</span>
              </div>
              {query.data.reviewedAt && (
                <div>
                  <span className="istoki-status-meta-label">Решение принято</span>
                  <span>{formatDate(query.data.reviewedAt)}</span>
                </div>
              )}
            </div>
            <div className="istoki-status-badge" data-tone={STATUS_LABELS[query.data.status]?.tone}>
              {STATUS_LABELS[query.data.status]?.label || query.data.status}
            </div>
            {query.data.status === "rejected" && query.data.moderationNote && (
              <div className="istoki-status-note">
                <span className="istoki-status-note-label">Комментарий редакции</span>
                <p>{query.data.moderationNote}</p>
              </div>
            )}
            {query.data.status === "pending" && (
              <p className="istoki-status-hint">
                Ваш материал находится на рассмотрении редакции. Обычно это занимает несколько дней.
                Эта страница обновляется автоматически.
              </p>
            )}
            {query.data.status === "approved" && (
              <p className="istoki-status-hint">
                Спасибо! Материал опубликован на «Карте Истоков» и теперь доступен всем посетителям.
              </p>
            )}
          </>
        )}
      </section>
    </main>
  );
}

export default SubmissionStatusPage;
