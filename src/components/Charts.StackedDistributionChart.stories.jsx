import { StackedDistributionChart } from "./Charts";

const rows = [
  {
    id: "day-1",
    label: "День 1",
    segments: [
      { id: "relaxed", label: "Расслабленность", value: 12, color: "#8dd8e8" },
      { id: "balance", label: "Баланс", value: 24, color: "#b8e26f" },
      { id: "engaged", label: "Вовлечённость", value: 16, color: "#ffd568" },
      { id: "panic", label: "Паника", value: 4, color: "#ff8a7b" },
    ],
  },
  {
    id: "day-2",
    label: "День 2",
    segments: [
      { id: "relaxed", label: "Расслабленность", value: 8, color: "#8dd8e8" },
      { id: "balance", label: "Баланс", value: 18, color: "#b8e26f" },
      { id: "engaged", label: "Вовлечённость", value: 24, color: "#ffd568" },
      { id: "panic", label: "Паника", value: 6, color: "#ff8a7b" },
    ],
  },
];

const meta = {
  title: "Charts/Diary Analytics/StackedDistributionChart",
  component: StackedDistributionChart,
  parameters: { layout: "padded" },
  argTypes: {
    rows: { control: "object" },
    height: { control: "number" },
    showLegend: { control: "boolean" },
  },
};

export default meta;

export const ByDay = {
  args: {
    title: "Распределение состояний по дням",
    rows,
    showLegend: true,
  },
};

export const Empty = {
  args: {
    title: "Нет распределения",
    rows: [],
    emptyLabel: "Данных по состояниям пока нет",
  },
};
