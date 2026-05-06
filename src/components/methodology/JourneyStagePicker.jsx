import clsx from "clsx";
import { JOURNEY_STAGE, JOURNEY_STAGE_META } from "../../data/methodology";

/**
 * Onboarding-screen для выбора этапа пути (4 варианта по методике v4).
 * Не настрой и не настроение — это «где я в течение жизни». Этапы циклически
 * переживаются заново; педагог в Передаче может на новой смене оказаться
 * в Поиске. Это не регресс, а живое движение пути.
 *
 * Бережность («сейчас бережно») — отдельный флаг, не часть этапов.
 * См. CarefulModeToggle.jsx и docs/architecture/methodology-mapping.md.
 *
 * Props:
 *  - value: JourneyStage | null    — выбранный этап (или null)
 *  - onSelect: (stage: JourneyStage) => void
 *  - onSkip?: () => void           — «решу позже» — методика разрешает
 *  - variant?: "grid" | "list"     — desktop=grid, mobile=list (mobile-first
 *    через CSS media query: при <640px grid становится list автоматически)
 *  - title?: string
 *  - subtitle?: string
 */
function JourneyStagePicker({
  value = null,
  onSelect,
  onSkip,
  variant = "grid",
  title = "Где вы сейчас на пути?",
  subtitle = "Это не оценка и не диагноз. Просто помогает настроить тон вопросов в дневнике. Можно сменить в любой день.",
}) {
  return (
    <section className="stage-picker" data-variant={variant}>
      <header className="stage-picker-head">
        <p className="eyebrow">Этап пути</p>
        <h2>{title}</h2>
        <p className="subtle">{subtitle}</p>
      </header>

      <div
        className={clsx("stage-picker-options", `is-${variant}`)}
        role="radiogroup"
        aria-label="Этап пути"
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
              className={clsx("stage-option", isSelected && "is-selected")}
              onClick={() => onSelect?.(stage)}
            >
              <strong className="stage-option-name">{meta.ru}</strong>
              <em className="stage-option-tagline">{meta.tagline}</em>
              <p className="stage-option-description">{meta.description}</p>
            </button>
          );
        })}
      </div>

      {onSkip ? (
        <div className="stage-picker-actions">
          <button type="button" className="ghost-button" onClick={onSkip}>
            Решу позже
          </button>
        </div>
      ) : null}
    </section>
  );
}

export default JourneyStagePicker;
