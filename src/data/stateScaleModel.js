export const STATE_SCALE_ZONES = [
  {
    id: "burnout",
    label: "Зона выгорания",
    shortLabel: "Выгорание",
    rangeLabel: "Недоактивация и истощение",
  },
  {
    id: "integration",
    label: "Зона интеграции",
    shortLabel: "Интеграция",
    rangeLabel: "Рабочий диапазон",
  },
  {
    id: "distress",
    label: "Зона дистресса",
    shortLabel: "Дистресс",
    rangeLabel: "Перевозбуждение",
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
  title: "Найдите точку на шкале",
  zoneLabel: "Шкала состояния",
  description:
    "Слева - истощение и выключенность, в центре - рабочий диапазон, справа - перегрузка и дистресс.",
  participantHint: "Передвиньте бегунок после события; ответ сохранится, когда вы отпустите его.",
  ariaValueText: "Предпросмотр: рабочий диапазон, ответ еще не сохранен",
  color: "#8eab55",
  surface: "#f7f8f3",
  textColor: "#26313a",
};

export const STATE_SCALE_META = {
  apathy: {
    label: "Апатия",
    shortLabel: "Апатия",
    icon: "😴",
    level: 0,
    zone: "burnout",
    zoneLabel: "Зона выгорания",
    description: "Полная апатия, прострация и безучастность.",
    participantHint: "Почти нет сил даже на простые рутинные действия.",
    color: "#8b3ff6",
    surface: "#f0e6ff",
    textColor: "#4a2189",
    toneColor: "#8b3ff6",
  },
  passive: {
    label: "Пассивность",
    shortLabel: "Пассивность",
    icon: "😶",
    level: 1,
    zone: "burnout",
    zoneLabel: "Зона выгорания",
    description: "Краски жизни поблекли, энтузиазм пропал.",
    participantHint: "Важные дела остаются без внимания или откладываются.",
    color: "#48a8f5",
    surface: "#e7f4ff",
    textColor: "#1d5f90",
    toneColor: "#48a8f5",
  },
  relaxed: {
    label: "Расслабленность",
    shortLabel: "Расслабленность",
    icon: "🙂",
    level: 2,
    zone: "integration",
    zoneLabel: "Зона интеграции",
    description: "Глубокая расслабленность и удовлетворение.",
    participantHint: "Можно спокойно наблюдать происходящее без срочного действия.",
    color: "#4fc3b5",
    surface: "#e2f7f4",
    textColor: "#236c65",
    toneColor: "#4fc3b5",
  },
  balance: {
    label: "Баланс",
    shortLabel: "Баланс",
    icon: "😊",
    level: 3,
    zone: "integration",
    zoneLabel: "Зона интеграции",
    description: "Спокойствие, радость и сфокусированное действие.",
    participantHint: "Есть ясность и движение без лишнего напряжения.",
    color: "#9bd40b",
    surface: "#f1fad8",
    textColor: "#4d6814",
    toneColor: "#9bd40b",
  },
  engaged: {
    label: "Включенность",
    shortLabel: "Включенность",
    icon: "😀",
    level: 4,
    zone: "integration",
    zoneLabel: "Зона интеграции",
    description: "Приятное возбуждение, интерес и энтузиазм.",
    participantHint: "Хочется действовать, есть предвкушение и энергия.",
    color: "#ffd23f",
    surface: "#fff6cf",
    textColor: "#806319",
    toneColor: "#ffd23f",
  },
  overstimulated: {
    label: "Перевозбуждённость",
    shortLabel: "Перевозбуждение",
    icon: "😵",
    level: 5,
    zone: "distress",
    zoneLabel: "Зона дистресса",
    description: "Повышенная чувствительность, тревога и раздражение.",
    participantHint: "Даже мелочи цепляют сильнее обычного.",
    color: "#ff7a1a",
    surface: "#fff0df",
    textColor: "#91470f",
    toneColor: "#ff7a1a",
  },
  panic: {
    label: "Паника",
    shortLabel: "Паника",
    icon: "😰",
    level: 6,
    zone: "distress",
    zoneLabel: "Зона дистресса",
    description: "Паника, страх или гнев, которыми сложно управлять.",
    participantHint: "Трудно контролировать слова, действия и реакции.",
    color: "#ff4a40",
    surface: "#ffe6e2",
    textColor: "#96302c",
    toneColor: "#ff4a40",
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

export function normalizeStateScale(states = []) {
  const source = states.length ? states : STATE_SCALE_ORDER.map((id) => ({ id }));

  return source
    .map((state, index) => {
      const meta = STATE_SCALE_META[state.id] || {};
      const zoneId = state.zone || meta.zone || "custom";
      const zone = ZONE_BY_ID[zoneId];
      const label = state.label || meta.label || state.id;
      const color = meta.color || state.color || "#8eab55";

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
        surface: meta.surface || state.surface || "#f7f8f3",
        textColor: meta.textColor || state.textColor || "#26313a",
        toneColor: meta.toneColor || state.toneColor || color,
      };
    })
    .sort((left, right) => left.level - right.level);
}
