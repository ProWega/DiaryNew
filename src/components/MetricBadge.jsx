function MetricBadge({ label, value, compact = false }) {
  return (
    <div className={compact ? "metric-badge is-compact" : "metric-badge"}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default MetricBadge;
