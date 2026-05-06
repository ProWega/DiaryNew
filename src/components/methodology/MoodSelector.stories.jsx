import { useState } from "react";
import MoodSelector from "./MoodSelector";

export default {
  title: "Methodology/MoodSelector",
  component: MoodSelector,
  parameters: {
    layout: "fullscreen",
  },
  argTypes: {
    variant: { control: "radio", options: ["grid", "list"] },
    title: { control: "text" },
    subtitle: { control: "text" },
  },
  args: {
    variant: "grid",
  },
};

function Interactive(args) {
  const [mood, setMood] = useState(args.value ?? null);
  return (
    <div style={{ background: "var(--color-surface-muted)", minHeight: "100vh", paddingTop: 32 }}>
      <MoodSelector {...args} value={mood} onSelect={setMood} />
    </div>
  );
}

/** Вариант A — 2×2 сетка. Все четыре настроя видны сразу, удобно сравнить. */
export const Grid = {
  args: { variant: "grid" },
  render: (args) => <Interactive {...args} />,
};

/** Вариант B — вертикальный список. Больше места под описание, читается «как письмо». */
export const VerticalList = {
  args: { variant: "list" },
  render: (args) => <Interactive {...args} />,
};

function InteractiveWithSkip(args) {
  const [mood, setMood] = useState(null);
  return (
    <div style={{ background: "var(--color-surface-muted)", minHeight: "100vh", paddingTop: 32 }}>
      <MoodSelector {...args} value={mood} onSelect={setMood} onSkip={() => alert("skip")} />
    </div>
  );
}

function InteractivePreselected(args) {
  const [mood, setMood] = useState("search");
  return (
    <div style={{ background: "var(--color-surface-muted)", minHeight: "100vh", paddingTop: 32 }}>
      <MoodSelector
        {...args}
        value={mood}
        onSelect={setMood}
        title="Сменить настрой"
        subtitle="Текущий настрой — Поиск. Можно сменить, если на смене ваше внутреннее состояние изменилось."
      />
    </div>
  );
}

/** С кнопкой «Решу позже» — методика разрешает пропустить выбор. */
export const WithSkipOption = {
  args: { variant: "grid" },
  render: (args) => <InteractiveWithSkip {...args} />,
};

/** Состояние «Поиск уже выбран» — для возврата к экрану смены этапа. */
export const Preselected = {
  args: { variant: "grid" },
  render: (args) => <InteractivePreselected {...args} />,
};

/** Mobile viewport — vertical-list автоматически сжимается. */
export const MobileGrid = {
  args: { variant: "grid" },
  parameters: { viewport: { defaultViewport: "mobile" } },
  render: (args) => <Interactive {...args} />,
};
