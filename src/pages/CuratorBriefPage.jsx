import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useCuratorBrief, useCuratorDashboard } from "../api/hooks";
import FeedbackState from "../components/FeedbackState";
import CuratorBriefView from "../views/CuratorBrief/CuratorBriefView";
import CuratorDashboardView from "../views/CuratorDashboardView";

const VIEW_BRIEF = "brief";
const VIEW_LEGACY = "dashboard";
const VIEW_OPTIONS = [VIEW_BRIEF, VIEW_LEGACY];
const DEFAULT_VIEW = VIEW_BRIEF;

function getViewStorageKey(userId) {
  return userId ? `newdiary-curator-view-${userId}` : "";
}

function readStoredView(userId) {
  if (typeof window === "undefined") return DEFAULT_VIEW;
  const key = getViewStorageKey(userId);
  if (!key) return DEFAULT_VIEW;
  try {
    const raw = window.localStorage.getItem(key);
    return VIEW_OPTIONS.includes(raw) ? raw : DEFAULT_VIEW;
  } catch {
    return DEFAULT_VIEW;
  }
}

function CuratorViewToggle({ view, onChange }) {
  return (
    <div className="curator-view-toggle" role="tablist" aria-label="Вид кабинета куратора">
      <button
        type="button"
        role="tab"
        aria-selected={view === VIEW_BRIEF}
        className={view === VIEW_BRIEF ? "mini-tab is-active" : "mini-tab"}
        onClick={() => onChange(VIEW_BRIEF)}
      >
        Записка
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={view === VIEW_LEGACY}
        className={view === VIEW_LEGACY ? "mini-tab is-active" : "mini-tab"}
        onClick={() => onChange(VIEW_LEGACY)}
      >
        Старый дашборд
      </button>
    </div>
  );
}

function BriefContent({ sessionId, groupId }) {
  const { data, loading, error, refresh } = useCuratorBrief(sessionId, groupId);

  if (loading && !data) {
    return (
      <FeedbackState
        title="Собираем записку"
        description="Считаем сегодняшний резонанс группы и готовим точки для разговора."
      />
    );
  }

  if (error) {
    return (
      <FeedbackState
        title="Не удалось собрать записку"
        description="Похоже, API-слой вернул ошибку. Можно открыть старый дашборд через переключатель выше."
        actionLabel="Повторить"
        onAction={refresh}
      />
    );
  }

  return <CuratorBriefView brief={data} />;
}

function LegacyContent({ sessionId, groupId }) {
  const { data, loading, error, refresh } = useCuratorDashboard(sessionId, groupId);

  if (loading && !data) {
    return (
      <FeedbackState
        title="Загружаем старый дашборд"
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

  return <CuratorDashboardView dashboard={data} />;
}

function CuratorBriefPage() {
  const { sessionId, groupId } = useParams();
  const { currentUser } = useAuth();
  const userId = currentUser?.id || "";
  const [view, setView] = useState(() => readStoredView(userId));

  useEffect(() => {
    setView(readStoredView(userId));
  }, [userId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = getViewStorageKey(userId);
    if (!key) return;
    try {
      window.localStorage.setItem(key, view);
    } catch {
      // ignore quota / private mode failures
    }
  }, [view, userId]);

  return (
    <div className="curator-shell">
      <CuratorViewToggle view={view} onChange={setView} />
      {view === VIEW_LEGACY ? (
        <LegacyContent sessionId={sessionId} groupId={groupId} />
      ) : (
        <BriefContent sessionId={sessionId} groupId={groupId} />
      )}
    </div>
  );
}

export default CuratorBriefPage;
