import { RiskScatterChart } from "./Charts";

const riskData = [
  { id: "p1", label: "Иван", shortLabel: "И", x: 3.6, y: 2.1, size: 3, color: "#df765f" },
  { id: "p2", label: "Анна", shortLabel: "А", x: 3.2, y: 1.1, size: 1, color: "#8dbf4f" },
  { id: "p3", label: "Егор", shortLabel: "Е", x: 2.4, y: 3.4, size: 5, color: "#e97864" },
  { id: "p4", label: "Дарья", shortLabel: "Д", x: 3.9, y: 0.8, size: 0, color: "#6fb9c8" },
];

const meta = {
  title: "Charts/Diary Analytics/RiskScatterChart",
  component: RiskScatterChart,
  parameters: { layout: "padded" },
  argTypes: {
    data: { control: "object" },
    height: { control: "number" },
    xDomain: { control: "object" },
    yDomain: { control: "object" },
    thresholds: { control: "object" },
    showGrid: { control: "boolean" },
    palette: { control: "object" },
  },
};

export default meta;

export const RiskMap = {
  args: {
    title: "Карта риска участников",
    data: riskData,
    height: 320,
    xDomain: [0, 6],
    yDomain: [0, 4],
    showGrid: true,
    thresholds: [{ value: 3, label: "Высокая амплитуда", color: "#df765f" }],
  },
};

export const Empty = {
  args: {
    ...RiskMap.args,
    title: "Нет участников",
    data: [],
    emptyLabel: "Фильтр не вернул участников",
  },
};
