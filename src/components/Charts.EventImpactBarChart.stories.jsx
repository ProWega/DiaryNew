import { DeltaBars, EventImpactBarChart } from "./Charts";

const impactData = [
  { id: "lecture", label: "Лекция", value: 0.9 },
  { id: "logistics", label: "Переход", value: -1.1 },
  { id: "workshop", label: "Практикум", value: 1.3 },
  { id: "evening", label: "Свечка", value: 0.4 },
];

const meta = {
  title: "Charts/Diary Analytics/EventImpactBarChart",
  component: EventImpactBarChart,
  parameters: { layout: "padded" },
  argTypes: {
    data: { control: "object" },
    values: { control: "object" },
    labels: { control: "object" },
    height: { control: "number" },
    yDomain: { control: "object" },
    showGrid: { control: "boolean" },
    showLabels: { control: "boolean" },
    showValues: { control: "boolean" },
    positiveColor: { control: "color" },
    negativeColor: { control: "color" },
  },
};

export default meta;

export const EventImpact = {
  args: {
    title: "Эффект мероприятий",
    data: impactData,
    height: 260,
    yDomain: [-1.5, 1.5],
    showGrid: true,
    showLabels: true,
    showValues: true,
    positiveColor: "#7dae42",
    negativeColor: "#df765f",
  },
};

export const DeltaTransitions = {
  render: (args) => <DeltaBars {...args} />,
  args: {
    title: "Резкие переходы",
    data: [
      { id: "d1", label: "Сбор → Лекция", value: 2 },
      { id: "d2", label: "Лекция → Обед", value: -1 },
      { id: "d3", label: "Обед → Практикум", value: 2 },
      { id: "d4", label: "Практикум → Вечер", value: -2 },
    ],
    yDomain: [-3, 3],
    showValues: true,
  },
};

export const Empty = {
  args: {
    ...EventImpact.args,
    title: "Нет данных",
    data: [],
    emptyLabel: "Нет рассчитанного эффекта мероприятий",
  },
};
