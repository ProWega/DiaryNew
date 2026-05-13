import { useCuratorUsage } from "../../api/hooks";

function formatTokens(n) {
  if (!Number.isFinite(n)) return "0";
  if (n < 1000) return String(n);
  return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
}

/**
 * Бейдж расхода токенов куратора за сегодня. Виден только когда задан
 * curatorDailyTokenBudget > 0 — иначе нет смысла показывать.
 */
function UsageBadge({ sessionId, compact = false }) {
  const { data, loading } = useCuratorUsage(sessionId);
  if (loading || !data) return null;
  const { spentToday, budget } = data;
  if (!budget || budget <= 0) return null;

  const percentage = Math.min(100, Math.round((spentToday / budget) * 100));
  const status = percentage >= 100 ? "is-over" : percentage >= 80 ? "is-warn" : "is-ok";

  return (
    <div className={`curator-usage-badge ${status}${compact ? " is-compact" : ""}`}>
      <span className="curator-usage-badge-label">
        {formatTokens(spentToday)} / {formatTokens(budget)} токенов
      </span>
      <span
        className="curator-usage-badge-bar"
        aria-hidden="true"
        style={{ "--usage-pct": `${percentage}%` }}
      />
    </div>
  );
}

export default UsageBadge;
