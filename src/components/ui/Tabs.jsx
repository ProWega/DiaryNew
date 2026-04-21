function Tabs({ items, activeId, onChange, disabled = false, ariaLabel = "Вкладки" }) {
  return (
    <div className="tab-row" role="tablist" aria-label={ariaLabel}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={activeId === item.id}
          className={activeId === item.id ? "mini-tab is-active" : "mini-tab"}
          disabled={disabled || item.disabled}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export default Tabs;
