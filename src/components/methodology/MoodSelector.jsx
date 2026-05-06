import clsx from "clsx";
import { JOURNEY_STAGE, JOURNEY_STAGE_META } from "../../data/methodology";

/**
 * Onboarding-screen для выбора настроя на смену (4 варианта по методике).
 *
 * Props:
 *  - value: Mood | null            — выбранный настрой (или null)
 *  - onSelect: (mood: Mood) => void
 *  - onSkip?: () => void           — «решу позже» — методика разрешает
 *  - variant?: "grid" | "list"     — раскладка (default "grid")
 *  - title?: string
 *  - subtitle?: string
 */
function MoodSelector({
  value = null,
  onSelect,
  onSkip,
  variant = "grid",
  title = "Выберите настрой",
  subtitle = "Зачем вы здесь? Это поможет настроить тон вопросов в дневнике. Можно сменить в любой день.",
}) {
  return (
    <section className="mood-selector" data-variant={variant}>
      <header className="mood-selector-head">
        <p className="eyebrow">Настрой</p>
        <h2>{title}</h2>
        <p className="subtle">{subtitle}</p>
      </header>

      <div
        className={clsx("mood-selector-options", `is-${variant}`)}
        role="radiogroup"
        aria-label="Настрой смены"
      >
        {JOURNEY_STAGE.map((stage) => {
          const meta = JOURNEY_STAGE_META[stage];
          const isSelected = value === stage;

          return (
            <button
              key={stage}
              type="button"
              role="radio"
              aria-checked={isSelected}
              className={clsx("mood-option", isSelected && "is-selected")}
              onClick={() => onSelect?.(stage)}
            >
              <strong className="mood-option-name">{meta.ru}</strong>
              <em className="mood-option-tagline">{meta.tagline}</em>
              <p className="mood-option-description">{meta.description}</p>
            </button>
          );
        })}
      </div>

      {onSkip ? (
        <div className="mood-selector-actions">
          <button type="button" className="ghost-button" onClick={onSkip}>
            Решу позже
          </button>
        </div>
      ) : null}
    </section>
  );
}

export default MoodSelector;
