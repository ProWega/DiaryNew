import clsx from "clsx";

function Tabs({ items, activeId, onChange, disabled = false, ariaLabel = "Вкладки" }) {
  return (
    <div className="tab-row" role="tablist" aria-label={ariaLabel}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={activeId === item.id}
          className={clsx("mini-tab", activeId === item.id && "is-active")}
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
