import clsx from "clsx";
import { CAREFUL_MODE_META } from "../../data/methodology";

/**
 * Опциональная пометка «сейчас бережно» — флаг, который ставится поверх
 * любого этапа пути. Не отдельный этап и не диагноз: это просьба о
 * деликатности на время острой жизненной нагрузки (СВО, болезнь близкого,
 * особый ребёнок, кризис).
 *
 * См. v4 §I.5: острая нагрузка почти всегда сопрягается с этапом пути,
 * заставлять выбирать = терять правду о человеке.
 *
 * Props:
 *  - value: boolean
 *  - onChange: (next: boolean) => void
 *  - compact?: boolean — без полного описания, для inline-режимов
 */
function CarefulModeToggle({ value = false, onChange, compact = false }) {
  return (
    <label className={clsx("careful-toggle", compact && "is-compact", value && "is-active")}>
      <input type="checkbox" checked={value} onChange={(e) => onChange?.(e.target.checked)} />
      <span className="careful-toggle-body">
        <strong>{CAREFUL_MODE_META.tagline}</strong>
        {!compact ? <em>{CAREFUL_MODE_META.description}</em> : null}
      </span>
    </label>
  );
}

export default CarefulModeToggle;
