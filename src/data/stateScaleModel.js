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
  description: "Слева — меньше сил. Центр — рабочий диапазон. Справа — перегрузка.",
  participantHint: "Передвиньте бегунок. Ответ сохранится после отпускания.",
  ariaValueText: "Предпросмотр: рабочий диапазон, ответ еще не сохранен",
  color: "#78733d",
  surface: "#f4efdb",
  textColor: "#2a2522",
};

export const STATE_SCALE_META = {
  apathy: {
    label: "Апатия",
    shortLabel: "Апатия",
    icon: "0",
    level: 0,
    zone: "burnout",
    zoneLabel: "Зона выгорания",
    description: "Полная апатия, прострация и безучастность.",
    participantHint: "Почти нет сил даже на простые рутинные действия.",
    color: "#4f5759",
    surface: "#ececea",
    textColor: "#303638",
    toneColor: "#4f5759",
  },
  passive: {
    label: "Пассивность",
    shortLabel: "Пассивность",
    icon: "1",
    level: 1,
    zone: "burnout",
    zoneLabel: "Зона выгорания",
    description: "Краски жизни поблекли, энтузиазм пропал.",
    participantHint: "Важные дела остаются без внимания или откладываются.",
    color: "#78733d",
    surface: "#f0ecda",
    textColor: "#484526",
    toneColor: "#78733d",
  },
  relaxed: {
    label: "Расслабленность",
    shortLabel: "Расслабленность",
    icon: "2",
    level: 2,
    zone: "integration",
    zoneLabel: "Зона интеграции",
    description: "Глубокая расслабленность и удовлетворение.",
    participantHint: "Можно спокойно наблюдать происходящее без срочного действия.",
    color: "#8b8042",
    surface: "#f4efd9",
    textColor: "#514a25",
    toneColor: "#8b8042",
  },
  balance: {
    label: "Баланс",
    shortLabel: "Баланс",
    icon: "3",
    level: 3,
    zone: "integration",
    zoneLabel: "Зона интеграции",
    description: "Спокойствие, радость и сфокусированное действие.",
    participantHint: "Есть ясность и движение без лишнего напряжения.",
    color: "#9a7a32",
    surface: "#f6edd1",
    textColor: "#5c481e",
    toneColor: "#9a7a32",
  },
  engaged: {
    label: "Включенность",
    shortLabel: "Включенность",
    icon: "4",
    level: 4,
    zone: "integration",
    zoneLabel: "Зона интеграции",
    description: "Приятное возбуждение, интерес и энтузиазм.",
    participantHint: "Хочется действовать, есть предвкушение и энергия.",
    color: "#c7b273",
    surface: "#fbf3dc",
    textColor: "#604f22",
    toneColor: "#9a7a32",
  },
  overstimulated: {
    label: "Перевозбуждённость",
    shortLabel: "Перевозбуждение",
    icon: "5",
    level: 5,
    zone: "distress",
    zoneLabel: "Зона дистресса",
    description: "Повышенная чувствительность, тревога и раздражение.",
    participantHint: "Даже мелочи цепляют сильнее обычного.",
    color: "#c95c36",
    surface: "#f7e2d8",
    textColor: "#713018",
    toneColor: "#c95c36",
  },
  panic: {
    label: "Паника",
    shortLabel: "Паника",
    icon: "6",
    level: 6,
    zone: "distress",
    zoneLabel: "Зона дистресса",
    description: "Паника, страх или гнев, которыми сложно управлять.",
    participantHint: "Трудно контролировать слова, действия и реакции.",
    color: "#6b1f2a",
    surface: "#f0dde0",
    textColor: "#4a111b",
    toneColor: "#6b1f2a",
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
