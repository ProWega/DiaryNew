import { HeatmapGrid } from "./Charts";

const meta = {
  title: "Charts/Diary Analytics/HeatmapGrid",
  component: HeatmapGrid,
  parameters: { layout: "padded", viewport: { defaultViewport: "mobile" } },
  argTypes: {
    columns: { control: "object" },
    rows: { control: "object" },
    showLegend: { control: "boolean" },
  },
};

export default meta;

export const Normal = {
  args: {
    title: "Heatmap состояний",
    columns: ["Группа 1", "Группа 2", "Группа 3"],
    rows: [
      { label: "Лекция", values: [4, 3, 4] },
      { label: "Практикум", values: [5, 2, 3] },
      { label: "Логистика", values: [1, 2, 2] },
    ],
    showLegend: true,
  },
};

export const ManyColumns = {
  args: {
    ...Normal.args,
    columns: ["Группа 1", "Группа 2", "Группа 3", "Группа 4", "Группа 5", "Группа 6"],
    rows: [
      { label: "Очень длинное название лекции", values: [4, 3, 4, 2, 5, 3] },
      { label: "Практикум", values: [5, 2, 3, 4, 2, 1] },
    ],
  },
};

export const Empty = {
  args: {
    title: "Пустая heatmap",
    columns: [],
    rows: [],
    emptyLabel: "Нет событий или групп",
  },
};
