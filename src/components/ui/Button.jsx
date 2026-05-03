// Props: variant ("primary" | "ghost" | "danger"), size ("sm" | "md" — default "md"),
//        disabled, loading (shows "..." in place of children), onClick, type, className, ...rest
export default function Button({
  variant = "ghost",
  size = "md",
  loading = false,
  disabled,
  className = "",
  children,
  ...rest
}) {
  const base =
    variant === "primary"
      ? "primary-button"
      : variant === "danger"
        ? "ghost-button is-danger"
        : "ghost-button";
  const sz = size === "sm" ? " btn-sm" : "";
  return (
    <button className={`${base}${sz} ${className}`.trim()} disabled={disabled || loading} {...rest}>
      {loading ? "..." : children}
    </button>
  );
}
