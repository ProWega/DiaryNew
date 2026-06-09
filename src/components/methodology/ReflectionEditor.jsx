import clsx from "clsx";
import {
  SUMMARY_AXES,
  SUMMARY_AXIS_META,
  REFLECTION_PROMPTS_BY_STAGE,
} from "../../data/methodology";

/**
 * Reflection editor — итог дня. Три оси: Ум / Сердце / Воля + свободная запись.
 * Тон вопросов меняется под этап пути (journeyStage).
 *
 * Props:
 *  - value: { mind?: string, heart?: string, will?: string, freeText?: string }
 *  - onChange: (next: typeof value) => void
 *  - journeyStage?: JourneyStage  — для подбора тона промптов (default — стандартные defaultPrompt)
 *  - showFreeText?: boolean       — default true; свободная запись после трёх осей
 *  - compact?: boolean            — без описания и подсказок
 */
function ReflectionEditor({
  value = {},
  onChange,
  journeyStage = null,
  showFreeText = true,
  compact = false,
}) {
  const prompts = resolvePrompts(journeyStage);

  function patch(field, nextValue) {
    onChange?.({ ...value, [field]: nextValue });
  }

  return (
    <section className={clsx("reflection-editor", compact && "is-compact")}>
      {!compact ? (
        <header className="reflection-editor-head">
          <p className="eyebrow">Итог дня</p>
          <p className="subtle">
            Соберите день в одно — что прояснилось, что отозвалось, к чему подвинулись. Можно
            пропустить любую ось.
          </p>
        </header>
      ) : null}

      <div className="reflection-editor-axes">
        {SUMMARY_AXES.map((axis) => {
          const meta = SUMMARY_AXIS_META[axis];
          const prompt = prompts[axis];
          const fieldValue = value[axis] ?? "";

          return (
            <label key={axis} className="reflection-axis">
              <span className="reflection-axis-name">{meta.ru}</span>
              <textarea
                className="reflection-axis-input"
                rows={compact ? 2 : 3}
                value={fieldValue}
                placeholder={prompt}
                onChange={(e) => patch(axis, e.target.value)}
              />
            </label>
          );
        })}
      </div>

      {showFreeText ? (
        <label className="reflection-free">
          <span className="reflection-free-name">
            {compact ? "Свободно" : "Что ещё хочется записать"}
          </span>
          <textarea
            className="reflection-free-input"
            rows={compact ? 2 : 4}
            value={value.freeText ?? ""}
            onChange={(e) => patch("freeText", e.target.value)}
          />
        </label>
      ) : null}
    </section>
  );
}

function resolvePrompts(journeyStage) {
  if (journeyStage && REFLECTION_PROMPTS_BY_STAGE[journeyStage]) {
    return REFLECTION_PROMPTS_BY_STAGE[journeyStage];
  }
  return SUMMARY_AXES.reduce((acc, axis) => {
    acc[axis] = SUMMARY_AXIS_META[axis].defaultPrompt;
    return acc;
  }, {});
}

export default ReflectionEditor;
