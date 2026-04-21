function Field({ label, children, wide = false, error, hint }) {
  return (
    <label className={wide ? "field-block is-wide" : "field-block"}>
      <span>{label}</span>
      {children}
      {hint ? <small className="field-hint">{hint}</small> : null}
      {error ? <small className="field-error">{error}</small> : null}
    </label>
  );
}

export default Field;
