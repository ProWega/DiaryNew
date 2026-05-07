import {
  STATE_LABELS,
  STATE_LABEL_META,
  STATE_SCALE_TO_METHODOLOGY,
  STATE_METHODOLOGY_TO_DEFAULT_SCALE,
} from "./methodology";

// Группы 3 → методически: Тишина / Лад / Сбой (Настройка и Подъём
// визуально живут внутри центральной группы как переходы).
// IDs сохранены (burnout/integration/distress) для backward-compat
// в StateScalePicker — переписать picker под 5-уровневую модель — отдельная задача.
export const STATE_SCALE_ZONES = [
  {
    id: "burnout",
    label: "Тишина",
    shortLabel: "Тишина",
    rangeLabel: "Состояние накопления",
  },
  {
    id: "integration",
    label: "Лад",
    shortLabel: "Лад",
    rangeLabel: "Рабочий диапазон",
  },
  {
    id: "distress",
    label: "Сбой",
    shortLabel: "Сбой",
    rangeLabel: "Нужна остановка или разговор",
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
  zoneLabel: "Шкала состояния",
  description: "Тишина — Настройка — Лад — Подъём — Сбой. Каждое состояние равноправно.",
  participantHint: "Передвиньте бегунок. Ответ сохранится после отпускания.",
  ariaValueText: "Предпросмотр: Лад, ответ ещё не сохранён",
  color: "#7a8088",
  surface: "#ededee",
  textColor: "#3a4046",
};

// Methodology «Дневник пути» v4: 5 уровней (Тишина / Настройка / Лад / Подъём / Сбой).
// Внутри каждого методического уровня — 1 или 2 точки шкалы (для гранулярности
// в arc-варианте). Текст единый на пару, цвет варьируется на тон.
// См. docs/architecture/methodology-mapping.md §2.1 (вариант B).
export const STATE_SCALE_META = {
  apathy: {
    label: "Тишина",
    shortLabel: "Тишина",
    icon: "0",
    level: 0,
    zone: "burnout",
    zoneLabel: "Тишина (глубокая)",
    description: "Внутри тихо, наблюдаю, мало откликается.",
    participantHint: "Это не провал — состояние накопления.",
    // Глубокий синий — методика §III, правило 5: Тишина не должна читаться «плохой»
    color: "#3a4a78",
    surface: "#e1e6f0",
    textColor: "#1f2a4a",
    toneColor: "#3a4a78",
  },
  passive: {
    label: "Тишина",
    shortLabel: "Тишина",
    icon: "1",
    level: 1,
    zone: "burnout",
    zoneLabel: "Тишина",
    description: "Внутри тихо, ещё не вошёл в общий ритм.",
    participantHint: "Накапливаю, наблюдаю, пока не отзываюсь активно.",
    color: "#5b6dab",
    surface: "#e6ebf6",
    textColor: "#2a3866",
    toneColor: "#5b6dab",
  },
  relaxed: {
    label: "Настройка",
    shortLabel: "Настройка",
    icon: "2",
    level: 2,
    zone: "integration",
    zoneLabel: "Настройка",
    description: "Прислушиваюсь, пристраиваюсь, ещё не вошёл, но уже здесь.",
    participantHint: "Постепенно настраиваюсь.",
    // Серебристо-серый
    color: "#7a8088",
    surface: "#ededee",
    textColor: "#3a4046",
    toneColor: "#7a8088",
  },
  balance: {
    label: "Лад",
    shortLabel: "Лад",
    icon: "3",
    level: 3,
    zone: "integration",
    zoneLabel: "Лад",
    description: "Со-настроен с собой, темой и людьми. Иду в ритме.",
    participantHint: "В рабочем ритме.",
    // Тёплый зелёный
    color: "#5d7c3e",
    surface: "#e7efd9",
    textColor: "#2f4220",
    toneColor: "#5d7c3e",
  },
  engaged: {
    label: "Подъём",
    shortLabel: "Подъём",
    icon: "4",
    level: 4,
    zone: "integration",
    zoneLabel: "Подъём",
    description: "Много жара, ярко, хочется говорить и делать.",
    participantHint: "В подъёме.",
    // Янтарный
    color: "#d4a132",
    surface: "#faedcb",
    textColor: "#664a14",
    toneColor: "#d4a132",
  },
  overstimulated: {
    label: "Сбой",
    shortLabel: "Сбой",
    icon: "5",
    level: 5,
    zone: "distress",
    zoneLabel: "Сбой",
    description: "Много, тяжелее обычного. Стоит сделать паузу или поговорить.",
    participantHint: "Стоит сделать паузу или поговорить.",
    // Алый
    color: "#a83b2a",
    surface: "#f6dad4",
    textColor: "#5e1c12",
    toneColor: "#a83b2a",
  },
  panic: {
    label: "Сбой",
    shortLabel: "Сбой",
    icon: "6",
    level: 6,
    zone: "distress",
    zoneLabel: "Сбой (острый)",
    description: "Слишком много или что-то не идёт. Нужна остановка.",
    participantHint: "Стоит сделать паузу или поговорить.",
    color: "#7d2418",
    surface: "#f0c8c0",
    textColor: "#48140a",
    toneColor: "#7d2418",
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
 * Build the 5-group view from a normalized 7-level state list. Each group keeps
 * `sourceIds` (1–2 items) so callers can highlight a group from a stored legacy
 * stateId, plus `canonicalId` to write back on selection.
 */
export function methodologyStateGroups(states) {
  const normalized = normalizeStateScale(states);
  const byId = new Map(normalized.map((state) => [state.id, state]));

  return STATE_LABELS.map((id, level) => {
    const canonicalId = STATE_METHODOLOGY_TO_DEFAULT_SCALE[id];
    const sourceIds = Object.entries(STATE_SCALE_TO_METHODOLOGY)
      .filter(([, label]) => label === id)
      .map(([sourceId]) => sourceId);
    const canonicalState =
      byId.get(canonicalId) || normalized.find((s) => sourceIds.includes(s.id));
    const labelMeta = STATE_LABEL_META[id];

    return {
      id,
      level,
      label: labelMeta.ru,
      shortLabel: labelMeta.ru,
      description: labelMeta.description,
      participantHint: labelMeta.participantHint,
      icon: canonicalState?.icon || "",
      color: canonicalState?.color || "#78733d",
      surface: canonicalState?.surface || "#f4efdb",
      textColor: canonicalState?.textColor || "#2a2522",
      toneColor: canonicalState?.toneColor || canonicalState?.color || "#78733d",
      sourceIds,
      canonicalId,
    };
  });
}

/**
 * Find the methodology group that owns a given legacy stateId. Used to light
 * up the right group when the stored value is `apathy` or `panic`.
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
        zoneLabel: state.zoneLabel || meta.zoneLabel || zone?.label || "Шкала состояния",
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
