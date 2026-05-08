import { useState } from "react";
import PodcastPlayer from "../istoki/components/PodcastPlayer";
import StoryCard from "../istoki/components/StoryCard";
import ChronicleTimeline from "../istoki/components/ChronicleTimeline";

const KIND_LABELS = {
  podcast: "Подкаст",
  story: "Личная история",
  chronicle: "Событие летописи",
};

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("ru-RU", {
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

function buildPreviewEntity(submission) {
  const fakeId = `preview-${submission.id}`;
  if (submission.kind === "podcast") {
    return { id: fakeId, ...submission.draft };
  }
  if (submission.kind === "story") {
    return { id: fakeId, ...submission.draft };
  }
  if (submission.kind === "chronicle") {
    return { id: fakeId, ...submission.draft };
  }
  return null;
}

function SubmissionDetail({ submission, onApprove, onReject, isMutating }) {
  const [note, setNote] = useState(submission.moderationNote || "");
  const [error, setError] = useState(null);
  const isPending = submission.status === "pending";

  async function handleApprove() {
    setError(null);
    try {
      await onApprove(note.trim() || undefined);
    } catch (err) {
      setError(err?.message || "Не удалось одобрить");
    }
  }

  async function handleReject() {
    setError(null);
    if (!note.trim()) {
      setError("Укажите причину отказа — она увидит автор");
      return;
    }
    try {
      await onReject(note.trim());
    } catch (err) {
      setError(err?.message || "Не удалось отклонить");
    }
  }

  const preview = buildPreviewEntity(submission);

  return (
    <div className="istoki-admin-submission" data-istoki-theme>
      <header className="istoki-admin-submission-head">
        <div>
          <div className="istoki-admin-submission-eyebrow">
            {KIND_LABELS[submission.kind]} · регион{" "}
            <strong>{submission.regionCode || "не указан"}</strong>
          </div>
          <h2 className="istoki-admin-submission-title">От {submission.submitterName}</h2>
          <div className="istoki-admin-submission-meta">
            <span>{submission.submitterEmail}</span>
            <span>·</span>
            <span>подана {formatDate(submission.createdAt)}</span>
          </div>
        </div>
        <span className="istoki-admin-submission-status" data-tone={submission.status}>
          {submission.status === "pending" && "На модерации"}
          {submission.status === "approved" && "Одобрена"}
          {submission.status === "rejected" && "Отклонена"}
        </span>
      </header>

      <section className="istoki-admin-submission-preview">
        <h3 className="istoki-admin-section-title">Предпросмотр публикации</h3>
        <div className="istoki-admin-submission-preview-body">
          {submission.kind === "podcast" && preview && (
            <PodcastPlayer podcast={preview} regionCode={submission.regionCode} />
          )}
          {submission.kind === "story" && preview && (
            <StoryCard story={preview} regionCode={submission.regionCode} />
          )}
          {submission.kind === "chronicle" && preview && <ChronicleTimeline entries={[preview]} />}
        </div>
      </section>

      <section className="istoki-admin-submission-moderation">
        <h3 className="istoki-admin-section-title">Решение редакции</h3>
        <label className="istoki-submit-field">
          <span>
            Комментарий{" "}
            {isPending && (
              <small style={{ opacity: 0.7 }}>(обязателен при отклонении, виден автору)</small>
            )}
          </span>
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={!isPending || isMutating}
            placeholder={
              isPending ? "Например: «Хорошая история, но нужна более качественная фотография»" : ""
            }
          />
        </label>
        {error && <div className="istoki-submit-error">{error}</div>}
        {isPending ? (
          <div className="istoki-admin-submission-actions">
            <button
              type="button"
              className="istoki-submit-button is-danger"
              onClick={handleReject}
              disabled={isMutating}
            >
              Отклонить
            </button>
            <button
              type="button"
              className="istoki-submit-button is-primary"
              onClick={handleApprove}
              disabled={isMutating}
            >
              Одобрить и опубликовать
            </button>
          </div>
        ) : (
          submission.moderationNote && (
            <div className="istoki-admin-submission-historic-note">{submission.moderationNote}</div>
          )
        )}
      </section>
    </div>
  );
}

export default SubmissionDetail;
