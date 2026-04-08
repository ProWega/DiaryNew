function FeedbackState({
  title,
  description,
  actionLabel,
  onAction,
}) {
  return (
    <section className="feedback-state">
      <div className="feedback-card">
        <h2>{title}</h2>
        <p>{description}</p>
        {actionLabel && onAction ? (
          <button type="button" className="primary-button" onClick={onAction}>
            {actionLabel}
          </button>
        ) : null}
      </div>
    </section>
  );
}

export default FeedbackState;
