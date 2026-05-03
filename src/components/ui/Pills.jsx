import clsx from "clsx";

export function SoftPill({ children, outline = false }) {
  return <span className={clsx("soft-pill", outline && "is-outline")}>{children}</span>;
}

export function StatusPill({ children, tone = "" }) {
  return <span className={clsx("status-pill", tone)}>{children}</span>;
}

export function AlertCard({ title, detail, tone = "" }) {
  return (
    <div className={clsx("alert-card", tone)}>
      <strong>{title}</strong>
      {detail ? <p>{detail}</p> : null}
    </div>
  );
}
