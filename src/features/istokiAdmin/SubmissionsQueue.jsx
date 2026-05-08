import { useEffect, useState } from "react";
import { useAdminSubmission, useAdminSubmissions, useSubmissionMutations } from "./api";
import SubmissionDetail from "./SubmissionDetail";

const STATUS_TABS = [
  { id: "pending", label: "Ожидают" },
  { id: "approved", label: "Одобрены" },
  { id: "rejected", label: "Отклонены" },
];

const KIND_BADGES = {
  podcast: { label: "Подкаст", icon: "♬" },
  story: { label: "История", icon: "✎" },
  chronicle: { label: "Событие", icon: "❖" },
};

function timeAgo(iso) {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "только что";
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  return `${days} дн назад`;
}

function SubmissionsQueue() {
  const [tab, setTab] = useState("pending");
  const [activeId, setActiveId] = useState(null);
  const listQuery = useAdminSubmissions(tab);
  const items = listQuery.data?.items ?? [];

  const detailQuery = useAdminSubmission(activeId);
  const mutations = useSubmissionMutations();

  // When the tab list reloads, auto-select the first item if nothing is
  // selected yet — saves a click.
  useEffect(() => {
    if (!activeId && items.length) {
      setActiveId(items[0].id);
    }
  }, [items, activeId]);

  // If the selected submission is no longer in the visible tab (e.g. just
  // approved while we're on "pending"), drop the selection.
  useEffect(() => {
    if (activeId && !items.find((i) => i.id === activeId)) {
      setActiveId(null);
    }
  }, [items, activeId]);

  return (
    <div className="istoki-admin-queue">
      <aside className="istoki-admin-queue-sidebar">
        <div className="istoki-admin-queue-tabs" role="tablist">
          {STATUS_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className="istoki-admin-queue-tab"
              onClick={() => {
                setTab(t.id);
                setActiveId(null);
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {listQuery.isLoading ? (
          <div className="istoki-admin-empty">Загрузка…</div>
        ) : listQuery.isError ? (
          <div className="istoki-admin-empty">
            Не удалось загрузить заявки
            <div style={{ marginTop: 6, fontSize: 11, opacity: 0.7 }}>
              {listQuery.error?.message || ""}
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="istoki-admin-empty">
            {tab === "pending"
              ? "Очередь пуста"
              : tab === "approved"
                ? "Ничего не одобрено"
                : "Ничего не отклонено"}
          </div>
        ) : (
          <ul className="istoki-admin-queue-list">
            {items.map((submission) => {
              const badge = KIND_BADGES[submission.kind] || { label: submission.kind };
              return (
                <li key={submission.id}>
                  <button
                    type="button"
                    className="istoki-admin-queue-item"
                    data-active={submission.id === activeId ? "true" : "false"}
                    onClick={() => setActiveId(submission.id)}
                  >
                    <div className="istoki-admin-queue-item-head">
                      <span className="istoki-admin-queue-kind">
                        <span aria-hidden="true">{badge.icon}</span> {badge.label}
                      </span>
                      <span className="istoki-admin-queue-time">
                        {timeAgo(submission.createdAt)}
                      </span>
                    </div>
                    <div className="istoki-admin-queue-region">
                      {submission.regionCode || "без региона"}
                    </div>
                    <div className="istoki-admin-queue-submitter">{submission.submitterName}</div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      <main className="istoki-admin-queue-main">
        {!activeId ? (
          <div className="istoki-admin-empty-large">
            {items.length === 0
              ? "Здесь появятся заявки от посетителей."
              : "Выберите заявку из списка слева."}
          </div>
        ) : detailQuery.isLoading ? (
          <div className="istoki-admin-empty-large">Загружаем заявку…</div>
        ) : detailQuery.isError ? (
          <div className="istoki-admin-empty-large">Не удалось загрузить заявку</div>
        ) : detailQuery.data ? (
          <SubmissionDetail
            submission={detailQuery.data}
            onApprove={(note) => mutations.approve.mutateAsync({ id: detailQuery.data.id, note })}
            onReject={(note) => mutations.reject.mutateAsync({ id: detailQuery.data.id, note })}
            isMutating={mutations.approve.isPending || mutations.reject.isPending}
          />
        ) : null}
      </main>
    </div>
  );
}

export default SubmissionsQueue;
