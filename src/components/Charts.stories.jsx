import { EmotionLineChart, chartPalette } from "./Charts";

const baseLabels = ["Сбор", "Лекция", "Обед", "Практикум", "Свободное время"];

const meta = {
  title: "Charts/Diary Analytics/EmotionLineChart",
  component: EmotionLineChart,
  parameters: {
    layout: "padded",
    viewport: { defaultViewport: "mobile" },
  },
  argTypes: {
    data: { control: "object" },
    values: { control: "object" },
    labels: { control: "object" },
    series: { control: "object" },
    height: { control: "number" },
    compact: { control: "boolean" },
    showGrid: { control: "boolean" },
    showBands: { control: "boolean" },
    showLabels: { control: "boolean" },
    showPoints: { control: "boolean" },
    showLegend: { control: "boolean" },
    palette: { control: "object" },
    yDomain: { control: "object" },
    thresholds: { control: "object" },
    annotations: { control: "object" },
  },
};

export default meta;

export const Normal = {
  args: {
    title: "Карта эмоций",
    description: "Траектория состояния по мероприятиям дня.",
    values: [2, 4, 3, 5, 3],
    labels: baseLabels,
    height: 260,
    compact: false,
    showGrid: true,
    showBands: true,
    showLabels: true,
    showPoints: true,
    showLegend: false,
    palette: chartPalette,
    yDomain: [0, 6],
    thresholds: [{ value: 5, label: "Зона перегруза", color: "#df765f" }],
    annotations: [{ index: 3, label: "Пик дня", color: "#8a6321" }],
  },
};

export const DataApi = {
  args: {
    ...Normal.args,
    title: "Data API",
    values: [],
    labels: [],
    data: [
      { id: "start", label: "Старт", value: 2, meta: { flag: "●" } },
      { id: "lecture", label: "Лекция", value: 4 },
      { id: "workshop", label: "Практикум", value: 5, tone: "risk" },
      { id: "evening", label: "Вечер", value: 3 },
    ],
  },
};

export const SinglePoint = {
  args: {
    ...Normal.args,
    title: "Одна точка",
    values: [3],
    labels: ["Итог дня"],
    thresholds: [],
    annotations: [],
  },
};

export const Empty = {
  args: {
    ...Normal.args,
    title: "Пустые данные",
    values: [],
    labels: [],
    data: [],
    emptyLabel: "Участник пока не отметил состояние",
  },
};

export const CompactMobile = {
  args: {
    ...Normal.args,
    title: "Компактный график",
    compact: true,
    height: 150,
    showLabels: false,
    showBands: false,
  },
};

export const LongLabels = {
  args: {
    ...Normal.args,
    labels: [
      "Утренний сбор с длинным названием",
      "Лекция про дизайн сообщества",
      "Практикум в параллельных группах",
      "Свободное время и восстановление",
      "Вечерняя рефлексия",
    ],
  },
};
