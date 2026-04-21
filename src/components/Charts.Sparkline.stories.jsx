import { DistributionBars, Sparkline } from "./Charts";

const meta = {
  title: "Charts/Diary Analytics/Sparkline",
  component: Sparkline,
  parameters: { layout: "padded" },
  argTypes: {
    data: { control: "object" },
    values: { control: "object" },
    color: { control: "color" },
    height: { control: "number" },
    width: { control: "number" },
    strokeWidth: { control: "number" },
    showPoints: { control: "boolean" },
    yDomain: { control: "object" },
  },
};

export default meta;

export const Normal = {
  render: (args) => (
    <div className="panel-card" style={{ maxWidth: 360 }}>
      <Sparkline {...args} />
    </div>
  ),
  args: {
    values: [2, 2, 3, 3, 4],
    color: "#6fb9c8",
    height: 56,
    width: 180,
    strokeWidth: 3,
    showPoints: true,
    yDomain: [0, 6],
  },
};

export const Variants = {
  render: () => (
    <div className="panel-card" style={{ display: "grid", gap: 16, maxWidth: 420 }}>
      <Sparkline values={[2, 2, 3, 3, 4]} color="#6fb9c8" />
      <Sparkline values={[5, 4, 3, 2, 1]} color="#df765f" />
      <Sparkline values={[1, 5, 2, 6, 3]} color="#f4b84a" />
    </div>
  ),
};

export const DistributionBarsLegacy = {
  render: (args) => (
    <div className="panel-card">
      <DistributionBars {...args} />
    </div>
  ),
  args: {
    title: "Распределение состояний",
    total: 56,
    showValues: true,
    items: [
      { id: "balance", label: "Баланс", count: 21, color: "#b8e26f" },
      { id: "engaged", label: "Вовлечённость", count: 18, color: "#ffd568" },
      { id: "panic", label: "Паника", count: 3, color: "#ff8a7b" },
    ],
  },
};
