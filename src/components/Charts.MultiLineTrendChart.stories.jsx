import { MultiLineTrendChart, chartPalette } from "./Charts";

const meta = {
  title: "Charts/Diary Analytics/MultiLineTrendChart",
  component: MultiLineTrendChart,
  parameters: { layout: "padded" },
  argTypes: {
    series: { control: "object" },
    labels: { control: "object" },
    height: { control: "number" },
    showGrid: { control: "boolean" },
    showBands: { control: "boolean" },
    showLabels: { control: "boolean" },
    showPoints: { control: "boolean" },
    showLegend: { control: "boolean" },
    thresholds: { control: "object" },
    annotations: { control: "object" },
    palette: { control: "object" },
  },
};

export default meta;

export const GroupsComparison = {
  args: {
    title: "Сравнение групп",
    labels: ["Сбор", "Лекция", "Обед", "Практикум", "Вечер"],
    height: 280,
    showGrid: true,
    showBands: false,
    showLabels: true,
    showPoints: true,
    showLegend: true,
    palette: chartPalette,
    thresholds: [{ value: 5, label: "Перегруз", color: "#df765f" }],
    annotations: [{ index: 1, label: "Сильный спикер", color: "#4f6975" }],
    series: [
      { id: "g1", label: "Группа 1", values: [2, 4, 3, 5, 3], color: "#6fb9c8" },
      { id: "g2", label: "Группа 2", values: [3, 3, 2, 4, 2], color: "#8dbf4f" },
      { id: "g3", label: "Группа 3", values: [2, 3, 3, 3, 4], color: "#f4b84a" },
    ],
  },
};

export const Empty = {
  args: {
    ...GroupsComparison.args,
    title: "Нет траекторий",
    series: [],
    emptyLabel: "Выберите участников или группу",
  },
};

export const ManySeries = {
  args: {
    ...GroupsComparison.args,
    title: "Много участников",
    series: [
      { id: "p1", label: "Иван", values: [2, 4, 3, 5, 3] },
      { id: "p2", label: "Анна", values: [3, 4, 4, 4, 3] },
      { id: "p3", label: "Егор", values: [1, 2, 2, 5, 2] },
      { id: "p4", label: "Дарья", values: [3, 3, 3, 4, 4] },
      { id: "p5", label: "Мария", values: [2, 3, 4, 3, 3] },
    ],
  },
};
