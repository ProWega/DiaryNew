export function SoftPill({ children, outline = false }) {
  return <span className={outline ? "soft-pill is-outline" : "soft-pill"}>{children}</span>;
}

export function StatusPill({ children, tone = "" }) {
  return <span className={`status-pill ${tone}`.trim()}>{children}</span>;
}

export function AlertCard({ title, detail, tone = "" }) {
  return (
    <div className={`alert-card ${tone}`.trim()}>
      <strong>{title}</strong>
      {detail ? <p>{detail}</p> : null}
    </div>
  );
}
