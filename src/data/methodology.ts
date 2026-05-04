/**
 * Methodology constants for «Дневник пути» (Истоки).
 *
 * This file is the single source of truth for:
 *  - 5 methodology state labels (Тишина / Настройка / Лад / Подъём / Сбой)
 *  - mapping 7 current state ids → 5 methodology labels
 *  - 4 mood (настрой) values
 *  - 3 group lad values (С группой / Рядом / В стороне)
 *  - 3 day-summary axes (Ум / Сердце / Воля)
 *  - prompts per axis × per mood
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

// ── Mood (настрой) ───────────────────────────────────────────────────

export const MOOD = ["crossroads", "support", "transmission", "silence"] as const;
export type Mood = (typeof MOOD)[number];

export const MOOD_META: Record<Mood, { ru: string; tagline: string; description: string }> = {
  crossroads: {
    ru: "Распутье",
    tagline: "Я в начале пути",
    description: "Смотрю, пробую, выбираю. Хочу понять, что отзывается, а что нет.",
  },
  support: {
    ru: "Опора",
    tagline: "Я уже выбрал и хочу укрепиться",
    description: "Я знаю, куда иду. Мне нужно подтверждение, опора, встречи с теми, кто рядом.",
  },
  transmission: {
    ru: "Передача",
    tagline: "Я несу ответственность за других и собираю ресурсы",
    description:
      "У меня есть свои — те, за кого я отвечаю. Приехал собрать инструменты и обменяться опытом.",
  },
  silence: {
    ru: "Тишина",
    tagline: "Я в нагрузке и нуждаюсь в бережном пространстве",
    description: "Я приехал в нагрузке. Мне сложно. Хочу, чтобы со мной было бережно.",
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
 * Per-mood reflection prompts for each summary axis. Used by the reflection
 * editor to soften/adapt the question tone. The methodology requires the
 * prompts to shift under the chosen mood (раздел III.3, table «Тон вопросов»).
 */
export const REFLECTION_PROMPTS_BY_MOOD: Record<Mood, Record<SummaryAxis, string>> = {
  crossroads: {
    mind: "Что я понял про дело, к которому присматриваюсь?",
    heart: "Что отозвалось — это моё или нет?",
    will: "К чему хочу подойти ближе?",
  },
  support: {
    mind: "Что прояснилось в моём пути?",
    heart: "Кого встретил из тех, кто идёт рядом?",
    will: "Что подтвердилось, к чему укрепился?",
  },
  transmission: {
    mind: "Какая мысль годится для моих?",
    heart: "Что задело так, что хочу передать?",
    will: "Что решил привезти и сделать?",
  },
  silence: {
    mind: "Что начало проясняться?",
    heart: "Где было тепло?",
    will: "К какому маленькому шагу подвинулся?",
  },
};
