const { query } = require("../postgres.cjs");

let ensuredPromise = null;

const DEFAULT_STATES = [
  {
    id: "apathy",
    level: 0,
    label: "Апатия",
    shortLabel: "Апатия",
    icon: "😴",
    color: "#8b3ff6",
    surface: "#f0e6ff",
    textColor: "#4a2189",
  },
  {
    id: "passive",
    level: 1,
    label: "Пассивность",
    shortLabel: "Пассивность",
    icon: "😶",
    color: "#48a8f5",
    surface: "#e7f4ff",
    textColor: "#1d5f90",
  },
  {
    id: "relaxed",
    level: 2,
    label: "Расслабленность",
    shortLabel: "Расслабленность",
    icon: "🙂",
    color: "#4fc3b5",
    surface: "#e2f7f4",
    textColor: "#236c65",
  },
  {
    id: "balance",
    level: 3,
    label: "Баланс",
    shortLabel: "Баланс",
    icon: "😊",
    color: "#9bd40b",
    surface: "#f1fad8",
    textColor: "#4d6814",
  },
  {
    id: "engaged",
    level: 4,
    label: "Включенность",
    shortLabel: "Включенность",
    icon: "😀",
    color: "#ffd23f",
    surface: "#fff6cf",
    textColor: "#806319",
  },
  {
    id: "overstimulated",
    level: 5,
    label: "Перевозбуждённость",
    shortLabel: "Перевозбуждение",
    icon: "😵",
    color: "#ff7a1a",
    surface: "#fff0df",
    textColor: "#91470f",
  },
  {
    id: "panic",
    level: 6,
    label: "Паника",
    shortLabel: "Паника",
    icon: "😰",
    color: "#ff4a40",
    surface: "#ffe6e2",
    textColor: "#96302c",
  },
];

async function ensureDefaultStateScale() {
  if (ensuredPromise) {
    return ensuredPromise;
  }

  ensuredPromise = (async () => {
    for (const state of DEFAULT_STATES) {
      await query(
        `
          insert into state_scale_levels (
            id,
            session_id,
            level,
            label,
            short_label,
            icon,
            color,
            surface,
            text_color,
            enabled,
            sort_order
          )
          values ($1, null, $2, $3, $4, $5, $6, $7, $8, true, $2)
          on conflict (id)
          do update set
            session_id = null,
            level = excluded.level,
            label = excluded.label,
            short_label = excluded.short_label,
            icon = excluded.icon,
            color = excluded.color,
            surface = excluded.surface,
            text_color = excluded.text_color,
            enabled = true,
            sort_order = excluded.sort_order
        `,
        [
          state.id,
          state.level,
          state.label,
          state.shortLabel,
          state.icon,
          state.color,
          state.surface,
          state.textColor,
        ],
      );
    }
  })().catch((error) => {
    ensuredPromise = null;
    throw error;
  });

  return ensuredPromise;
}

module.exports = {
  DEFAULT_STATES,
  ensureDefaultStateScale,
};
