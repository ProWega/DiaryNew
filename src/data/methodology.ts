/**
 * Methodology constants for «Дневник пути» (Истоки), version v4.
 *
 * This file is the single source of truth for:
 *  - 5 methodology state labels (Тишина / Настройка / Лад / Подъём / Сбой)
 *  - mapping 7 current state ids → 5 methodology labels
 *  - 4 journey stages: Поиск / Проверка / Опора / Передача
 *  - careful mode flag («бережно» поверх любого этапа)
 *  - 3 group lad values (С группой / Рядом / В стороне)
 *  - 3 day-summary axes (Ум / Сердце / Воля)
 *  - prompts per axis × per journey stage + careful-mode prompts
 *
 * See docs/architecture/methodology-mapping.md for the rationale and the
 * "что нельзя нарушать" technical contract this file supports.
 */

// ── 5 methodology states ──────────────────────────────────────────────

export const STATE_LABELS = ["silence", "tuning", "harmony", "lift", "breakdown"] as const;
export type MethodologyState = (typeof STATE_LABELS)[number];

interface StateLabelMeta {
  ru: string;
  description: string;
  participantHint: string;
}

export const STATE_LABEL_META: Record<MethodologyState, StateLabelMeta> = {
  silence: {
    ru: "Тишина",
    description: "Внутри тихо, наблюдаю, мало откликается.",
    participantHint: "Это не провал — состояние накопления.",
  },
  tuning: {
    ru: "Настройка",
    description: "Прислушиваюсь, пристраиваюсь, ещё не вошёл, но уже здесь.",
    participantHint: "Постепенно настраиваюсь.",
  },
  harmony: {
    ru: "Лад",
    description: "Со-настроен с собой, темой и людьми. Иду в ритме.",
    participantHint: "В рабочем ритме.",
  },
  lift: {
    ru: "Подъём",
    description: "Много жара, ярко, хочется говорить и делать. Иногда через край.",
    participantHint: "В подъёме.",
  },
  breakdown: {
    ru: "Сбой",
    description: "Слишком много или что-то не идёт. Нужна остановка или разговор.",
    participantHint: "Стоит сделать паузу или поговорить.",
  },
};

// ── Mapping: 7 current state ids → 5 methodology labels ──────────────

/**
 * Maps existing `STATE_SCALE_ORDER` ids (7-level scale from stateScaleModel.js)
 * to the methodology's 5-level scale. The 7-level data stays in DB — UI
 * groups display through this mapping (variant B from the migration plan).
 */
export const STATE_SCALE_TO_METHODOLOGY: Record<string, MethodologyState> = {
  apathy: "silence",
  passive: "silence",
  relaxed: "tuning",
  balance: "harmony",
  engaged: "lift",
  overstimulated: "breakdown",
  panic: "breakdown",
};

/**
 * Reverse mapping: methodology label → canonical 7-level stateId picked when
 * the participant selects this label in a 5-level UI. Middle of each group so
 * новые записи не сваливаются в крайние `apathy`/`panic` (правило «Тишина не
 * дно» и симметричное «Сбой не край»).
 */
export const STATE_METHODOLOGY_TO_DEFAULT_SCALE: Record<MethodologyState, string> = {
  silence: "passive",
  tuning: "relaxed",
  harmony: "balance",
  lift: "engaged",
  breakdown: "overstimulated",
};

/**
 * Stable display order for the 5 methodology labels (silence → breakdown).
 * Re-exported alias of STATE_LABELS for callers that want the ordering intent
 * to be explicit.
 */
export const STATE_METHODOLOGY_ORDER = STATE_LABELS;

// ── Group lad (second dimension of state) ────────────────────────────

export const GROUP_LAD = ["with_group", "alongside", "apart"] as const;
export type GroupLad = (typeof GROUP_LAD)[number];

export const GROUP_LAD_META: Record<GroupLad, { ru: string; description: string }> = {
  with_group: {
    ru: "С группой",
    description: "Общее дыхание, иду вместе.",
  },
  alongside: {
    ru: "Рядом",
    description: "Здесь, но в своей орбите. Не в напряжении, просто параллельно.",
  },
  apart: {
    ru: "В стороне",
    description: "Не складывается, чужой ритм.",
  },
};

// ── Journey stage (этап пути) ────────────────────────────────────────

/**
 * 4 этапа пути по методике v4. Этапы циклически переживаются заново —
 * педагог в Передаче может на новой смене оказаться в Поиске. Это не регресс,
 * а живое движение пути (раздел II.2 v4).
 *
 * NB: «Тишина» больше не этап — стала отдельным флагом `careful_mode` ниже.
 */
export const JOURNEY_STAGE = ["search", "verification", "support", "transmission"] as const;
export type JourneyStage = (typeof JOURNEY_STAGE)[number];

export const JOURNEY_STAGE_META: Record<
  JourneyStage,
  { ru: string; tagline: string; description: string }
> = {
  search: {
    ru: "Поиск",
    tagline: "Я ещё выбираю, кем быть",
    description: "Смотрю, пробую, выбираю. Хочу понять, что отзывается, а что нет.",
  },
  verification: {
    ru: "Проверка",
    tagline: "Я уже на пути и проверяю себя в нём",
    description:
      "Решение принято, но настоящая проверка — в реальности — только начинается. Хочу убедиться, что выбрал правильно, и научиться идти.",
  },
  support: {
    ru: "Опора",
    tagline: "Я уверенно иду своим путём",
    description:
      "Я знаю, куда иду. Приехал найти своих, поговорить с теми, кто рядом, и углубиться.",
  },
  transmission: {
    ru: "Передача",
    tagline: "У меня есть свои",
    description:
      "Те, за кого я отвечаю. Приехал собрать инструменты, обменяться опытом и привезти что-то конкретное.",
  },
};

// ── Careful mode («бережно») — флаг поверх любого этапа ─────────────

/**
 * Опциональная пометка, которую участник ставит, когда сейчас сложно
 * и хочется деликатности — болезнь близкого, особый ребёнок, СВО, кризис.
 *
 * Принципиально, что это НЕ один из этапов — острая нагрузка почти всегда
 * сопрягается с другим этапом пути (мама особого ребёнка одновременно
 * в Передаче и в нагрузке). См. v4 раздел I.5.
 *
 * В БД хранится в `session_users.is_careful_mode boolean`.
 */
export const CAREFUL_MODE_META = {
  ru: "Бережно",
  tagline: "Сейчас бережно",
  description:
    "Иногда сейчас сложно, и хочется, чтобы со мной было бережно. Можно поставить поверх любого этапа.",
};

// ── Summary axes (Ум / Сердце / Воля) ────────────────────────────────

export const SUMMARY_AXES = ["mind", "heart", "will"] as const;
export type SummaryAxis = (typeof SUMMARY_AXES)[number];

export const SUMMARY_AXIS_META: Record<SummaryAxis, { ru: string; defaultPrompt: string }> = {
  mind: { ru: "Ум", defaultPrompt: "Что прояснилось?" },
  heart: { ru: "Сердце", defaultPrompt: "Что отозвалось?" },
  will: { ru: "Воля", defaultPrompt: "К чему подвинулся?" },
};

/**
 * Per-stage reflection prompts for each summary axis. Used by the reflection
 * editor to soften/adapt the question tone. The methodology requires the
 * prompts to shift under the chosen journey stage (v4 раздел III.3 table
 * «Тон вопросов»).
 */
export const REFLECTION_PROMPTS_BY_STAGE: Record<JourneyStage, Record<SummaryAxis, string>> = {
  search: {
    mind: "Что я понял про дело, к которому присматриваюсь?",
    heart: "Что отозвалось — это моё или нет?",
    will: "К чему хочу подойти ближе?",
  },
  verification: {
    mind: "Что прояснилось в моём пути? Где была проверка?",
    heart: "Кого встретил из тех, кто идёт рядом?",
    will: "Что подтвердилось, к чему укрепился?",
  },
  support: {
    mind: "Что углубилось сегодня?",
    heart: "Кого встретил из своих?",
    will: "К чему подвинулся в своём деле?",
  },
  transmission: {
    mind: "Какая мысль годится для моих?",
    heart: "Что задело так, что хочу передать?",
    will: "Что решил привезти и сделать?",
  },
};

/**
 * Soft prompts применяются ПОВЕРХ любого этапа когда `is_careful_mode=true`.
 * Тон мягкий, не давит — методическое правило 6 (мягкие пороги для бережного).
 */
export const REFLECTION_PROMPTS_CAREFUL: Record<SummaryAxis, string> = {
  mind: "Что начало проясняться?",
  heart: "Где было тепло?",
  will: "К какому маленькому шагу подвинулся?",
};
