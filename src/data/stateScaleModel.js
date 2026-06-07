// Канонической снова стала 7-балльная активационная шкала «от Апатии до Паники».
// Methodology v4 (5 уровней: Тишина / Настройка / Лад / Подъём / Сбой) изъята —
// варианты picker'а arc-5/emoji-5/slider-5 остаются опциональными и работают
// через локальный METHODOLOGY_OVERLAY ниже (не через src/data/methodology.ts).
// См. docs/architecture/methodology-mapping.md §2.1.

// 3 зоны активации — для аналитики и для группировки в zone-варианте picker'а.
export const STATE_SCALE_ZONES = [
  {
    id: "low",
    label: "Низкая активация",
    shortLabel: "Низкая",
    rangeLabel: "Сейчас тихо, наблюдаю",
  },
  {
    id: "working",
    label: "Рабочая активация",
    shortLabel: "Рабочая",
    rangeLabel: "В ритме, со-настройка",
  },
  {
    id: "high",
    label: "Высокая активация",
    shortLabel: "Высокая",
    rangeLabel: "Много, стоит замедлиться",
  },
];

const ZONE_BY_ID = Object.fromEntries(STATE_SCALE_ZONES.map((zone) => [zone.id, zone]));

export const STATE_SCALE_ORDER = [
  "apathy",
  "passive",
  "relaxed",
  "balance",
  "engaged",
  "overstimulated",
  "panic",
];

export const STATE_SCALE_NEUTRAL_PREVIEW = {
  title: "Найдите свою точку",
  zoneLabel: "Шкала активации",
  description: "Шкала активации: от Апатии до Паники. Каждое состояние равноправно.",
  participantHint: "Передвиньте бегунок. Ответ сохранится после отпускания.",
  ariaValueText: "Предпросмотр: Баланс, ответ ещё не сохранён",
  color: "#7a8088",
  surface: "#ededee",
  textColor: "#3a4046",
};

// Канонические лейблы 7-уровневой шкалы. Цвета и зоны выравнены с
// server/db/repositories/stateScaleStore.cjs DEFAULT_STATES.
export const STATE_SCALE_META = {
  apathy: {
    label: "Апатия",
    shortLabel: "Апатия",
    icon: "0",
    level: 0,
    zone: "low",
    zoneLabel: "Низкая активация",
    description: "Внутри тихо, наблюдаю, мало откликается.",
    participantHint: "Это не провал — состояние накопления.",
    color: "#3a4a78",
    surface: "#e1e6f0",
    textColor: "#1f2a4a",
    toneColor: "#3a4a78",
  },
  passive: {
    label: "Пассивность",
    shortLabel: "Пассивность",
    icon: "1",
    level: 1,
    zone: "low",
    zoneLabel: "Низкая активация",
    description: "Тихо, ещё не вошёл в общий ритм.",
    participantHint: "Наблюдаю, пока не отзываюсь активно.",
    color: "#5b6dab",
    surface: "#e6ebf6",
    textColor: "#2a3866",
    toneColor: "#5b6dab",
  },
  relaxed: {
    label: "Расслабленность",
    shortLabel: "Расслаб.",
    icon: "2",
    level: 2,
    zone: "working",
    zoneLabel: "Рабочая активация",
    description: "Прислушиваюсь, пристраиваюсь, ещё не вошёл, но уже здесь.",
    participantHint: "Постепенно настраиваюсь.",
    color: "#4fc3b5",
    surface: "#dbf2ee",
    textColor: "#1d4f48",
    toneColor: "#4fc3b5",
  },
  balance: {
    label: "Баланс",
    shortLabel: "Баланс",
    icon: "3",
    level: 3,
    zone: "working",
    zoneLabel: "Рабочая активация",
    description: "Со-настроен с собой, темой и людьми. Иду в ритме.",
    participantHint: "В рабочем ритме.",
    color: "#9bd40b",
    surface: "#eff8d4",
    textColor: "#3c5106",
    toneColor: "#9bd40b",
  },
  engaged: {
    label: "Включённость",
    shortLabel: "Включ.",
    icon: "4",
    level: 4,
    zone: "working",
    zoneLabel: "Рабочая активация",
    description: "Много жара, ярко, хочется говорить и делать.",
    participantHint: "В подъёме.",
    color: "#ffd23f",
    surface: "#fff4c8",
    textColor: "#665216",
    toneColor: "#ffd23f",
  },
  overstimulated: {
    label: "Перевозбуждённость",
    shortLabel: "Перевозб.",
    icon: "5",
    level: 5,
    zone: "high",
    zoneLabel: "Высокая активация",
    description: "Много, тяжелее обычного. Стоит сделать паузу или поговорить.",
    participantHint: "Стоит сделать паузу или поговорить.",
    color: "#ff7a1a",
    surface: "#fde0cb",
    textColor: "#5f2806",
    toneColor: "#ff7a1a",
  },
  panic: {
    label: "Паника",
    shortLabel: "Паника",
    icon: "6",
    level: 6,
    zone: "high",
    zoneLabel: "Высокая активация",
    description: "Слишком много или что-то не идёт. Нужна остановка.",
    participantHint: "Стоит сделать паузу или поговорить.",
    color: "#ff4a40",
    surface: "#fcd0cc",
    textColor: "#5e120e",
    toneColor: "#ff4a40",
  },
};

// ── Optional 5-level methodology overlay (изъятый этап v4) ──────────────────
// Используется ТОЛЬКО для опциональных picker-вариантов arc-5 / emoji-5 /
// slider-5 в StateScalePicker. Канонические лейблы/зоны выше — 7-уровневые.

const METHODOLOGY_OVERLAY = [
  { id: "silence", ru: "Тишина", sourceIds: ["apathy", "passive"], canonicalId: "passive" },
  { id: "tuning", ru: "Настройка", sourceIds: ["relaxed"], canonicalId: "relaxed" },
  { id: "harmony", ru: "Лад", sourceIds: ["balance"], canonicalId: "balance" },
  { id: "lift", ru: "Подъём", sourceIds: ["engaged"], canonicalId: "engaged" },
  {
    id: "breakdown",
    ru: "Сбой",
    sourceIds: ["overstimulated", "panic"],
    canonicalId: "overstimulated",
  },
];

const METHODOLOGY_DESCRIPTIONS = {
  silence: {
    description: "Внутри тихо, наблюдаю, мало откликается.",
    participantHint: "Это не провал — состояние накопления.",
  },
  tuning: {
    description: "Прислушиваюсь, пристраиваюсь, ещё не вошёл, но уже здесь.",
    participantHint: "Постепенно настраиваюсь.",
  },
  harmony: {
    description: "Со-настроен с собой, темой и людьми. Иду в ритме.",
    participantHint: "В рабочем ритме.",
  },
  lift: {
    description: "Много жара, ярко, хочется говорить и делать. Иногда через край.",
    participantHint: "В подъёме.",
  },
  breakdown: {
    description: "Слишком много или что-то не идёт. Нужна остановка или разговор.",
    participantHint: "Стоит сделать паузу или поговорить.",
  },
};

function isNumber(value) {
  return Number.isFinite(Number(value));
}

function getLevel(state, fallbackIndex) {
  if (isNumber(state.level)) {
    return Number(state.level);
  }

  if (isNumber(STATE_SCALE_META[state.id]?.level)) {
    return Number(STATE_SCALE_META[state.id].level);
  }

  return fallbackIndex;
}

/**
 * Optional 5-group view over the canonical 7-level state list. Each group keeps
 * `sourceIds` so callers can highlight a group from a stored 7-level stateId,
 * plus `canonicalId` to write back on selection. Used only by the optional
 * picker variants arc-5 / emoji-5 / slider-5.
 */
export function methodologyStateGroups(states) {
  const normalized = normalizeStateScale(states);
  const byId = new Map(normalized.map((state) => [state.id, state]));

  return METHODOLOGY_OVERLAY.map((group, level) => {
    const canonicalState =
      byId.get(group.canonicalId) || normalized.find((s) => group.sourceIds.includes(s.id));
    const meta = METHODOLOGY_DESCRIPTIONS[group.id] || {};

    return {
      id: group.id,
      level,
      label: group.ru,
      shortLabel: group.ru,
      description: meta.description || "",
      participantHint: meta.participantHint || "",
      icon: canonicalState?.icon || "",
      color: canonicalState?.color || "#78733d",
      surface: canonicalState?.surface || "#f4efdb",
      textColor: canonicalState?.textColor || "#2a2522",
      toneColor: canonicalState?.toneColor || canonicalState?.color || "#78733d",
      sourceIds: group.sourceIds,
      canonicalId: group.canonicalId,
    };
  });
}

/**
 * Find the methodology group that owns a given 7-level stateId. Used by the
 * 5-level UI variants to light up the right group when the stored value is e.g.
 * `apathy` or `panic`.
 */
export function findMethodologyGroupForStateId(groups, stateId) {
  if (!stateId) return null;
  return groups.find((group) => group.sourceIds.includes(stateId)) || null;
}

export function normalizeStateScale(states = []) {
  const source = states.length ? states : STATE_SCALE_ORDER.map((id) => ({ id }));

  return source
    .map((state, index) => {
      const meta = STATE_SCALE_META[state.id] || {};
      const zoneId = state.zone || meta.zone || "custom";
      const zone = ZONE_BY_ID[zoneId];
      const label = state.label || meta.label || state.id;
      const color = meta.color || state.color || "#78733d";

      return {
        ...state,
        id: state.id,
        label,
        shortLabel: state.shortLabel || state.short_label || meta.shortLabel || label,
        icon: state.icon || meta.icon || "",
        level: getLevel(state, index),
        zone: zoneId,
        zoneLabel: state.zoneLabel || meta.zoneLabel || zone?.label || "Шкала активации",
        description: state.description || meta.description || "",
        participantHint: state.participantHint || meta.participantHint || "",
        color,
        surface: meta.surface || state.surface || "#f4efdb",
        textColor: meta.textColor || state.textColor || "#2a2522",
        toneColor: meta.toneColor || state.toneColor || color,
      };
    })
    .sort((left, right) => left.level - right.level);
}
