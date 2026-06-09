/**
 * Methodology constants for «Дневник пути» (Истоки).
 *
 * Состояние участника фиксируется по 7-балльной активационной шкале
 * «от Апатии до Паники» — см. [src/data/stateScaleModel.js](./stateScaleModel.js)
 * (STATE_SCALE_META). 5-уровневая методическая карта v4 (Тишина/Настройка/Лад/
 * Подъём/Сбой) изъята; опциональные picker-варианты `arc-5/emoji-5/slider-5`
 * получают своё описание из внутреннего overlay в stateScaleModel.js.
 *
 * Этот файл — single source of truth для:
 *  - 4 journey stages: Поиск / Проверка / Опора / Передача
 *  - 3 group lad values (С группой / Рядом / В стороне)
 *  - 3 day-summary axes (Ум / Сердце / Воля)
 *  - prompts per axis × per journey stage
 *
 * См. docs/architecture/methodology-mapping.md для контракта.
 */

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
 * 4 этапа пути. Этапы циклически переживаются заново — педагог в Передаче
 * может на новой смене оказаться в Поиске. Это не регресс, а живое движение
 * пути.
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
      "Решение принято, но настоящая проверка — в реальности — только начинается. Хочу убедиться, что выбрал правильно.",
  },
  support: {
    ru: "Опора",
    tagline: "Я уверенно иду своим путём",
    description:
      "Я знаю, куда иду. Приехал найти своих, поговорить с теми, кто рядом, и восстановиться.",
  },
  transmission: {
    ru: "Передача",
    tagline: "У меня есть свои",
    description:
      "Те, за кого я отвечаю. Приехал собрать инструменты, обменяться опытом и привезти что-то конкретное.",
  },
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
 * Per-stage reflection prompts for each summary axis. Используется редактором
 * рефлексии для адаптации тона вопросов под выбранный этап пути.
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
