import clsx from "clsx";

/**
 * Per-record privacy controls — методическое правило 7 (приватность per-record).
 *
 * Два независимых булевых флага в БД:
 *   isAnonymous          — куратор видит запись, но не знает кто автор
 *   isHiddenFromCurator  — куратор не видит запись вообще
 *
 * UX: 2 чекбокса. Минималистично, прямое отражение БД (выбор пользователя).
 * Когда isHiddenFromCurator=true, isAnonymous становится disabled — запись
 * куратору не видна вообще, анонимизировать нечего.
 *
 * Props:
 *  - isAnonymous: boolean
 *  - isHiddenFromCurator: boolean
 *  - onChange: ({ isAnonymous, isHiddenFromCurator }) => void
 *  - compact?: boolean — мелкий inline-режим под textarea
 */
function PrivacyToggle({
  isAnonymous = false,
  isHiddenFromCurator = false,
  onChange,
  compact = false,
}) {
  return (
    <fieldset className={clsx("privacy-toggle", compact && "is-compact")}>
      <legend className="visually-hidden">Приватность записи</legend>
      <label className="privacy-checkbox">
        <input
          type="checkbox"
          checked={isAnonymous}
          disabled={isHiddenFromCurator}
          onChange={(e) => onChange?.({ isAnonymous: e.target.checked, isHiddenFromCurator })}
        />
        <span>Анонимно для куратора</span>
      </label>
      <label className="privacy-checkbox">
        <input
          type="checkbox"
          checked={isHiddenFromCurator}
          onChange={(e) => onChange?.({ isAnonymous, isHiddenFromCurator: e.target.checked })}
        />
        <span>Скрыть от куратора совсем</span>
      </label>
    </fieldset>
  );
}

export default PrivacyToggle;
