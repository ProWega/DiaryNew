import { useState } from "react";
import JourneyStagePicker from "./JourneyStagePicker";

export default {
  title: "Methodology/JourneyStagePicker",
  component: JourneyStagePicker,
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
  const [stage, setStage] = useState(args.value ?? null);
  return (
    <div style={{ background: "var(--color-surface-muted)", minHeight: "100vh", paddingTop: 32 }}>
      <JourneyStagePicker {...args} value={stage} onSelect={setStage} />
    </div>
  );
}

function InteractiveWithSkip(args) {
  const [stage, setStage] = useState(null);
  return (
    <div style={{ background: "var(--color-surface-muted)", minHeight: "100vh", paddingTop: 32 }}>
      <JourneyStagePicker
        {...args}
        value={stage}
        onSelect={setStage}
        onSkip={() => alert("skip")}
      />
    </div>
  );
}

function InteractivePreselected(args) {
  const [stage, setStage] = useState("verification");
  return (
    <div style={{ background: "var(--color-surface-muted)", minHeight: "100vh", paddingTop: 32 }}>
      <JourneyStagePicker
        {...args}
        value={stage}
        onSelect={setStage}
        title="Сменить этап"
        subtitle="Сейчас — Проверка. Можно сменить, если на этой смене что-то изменилось."
      />
    </div>
  );
}

/** Default — Grid 2×2 на desktop. Все 4 этапа видны сразу, удобно сравнить. */
export const Grid = {
  args: { variant: "grid" },
  render: (args) => <Interactive {...args} />,
};

/** Vertical list — full-width стек с подробными описаниями. */
export const VerticalList = {
  args: { variant: "list" },
  render: (args) => <Interactive {...args} />,
};

/** С кнопкой «Решу позже» — методика разрешает пропустить выбор. */
export const WithSkipOption = {
  args: { variant: "grid" },
  render: (args) => <InteractiveWithSkip {...args} />,
};

/** Состояние «Проверка уже выбрана» — для возврата к экрану смены этапа. */
export const Preselected = {
  args: { variant: "grid" },
  render: (args) => <InteractivePreselected {...args} />,
};

/** Mobile viewport — Grid автоматически сжимается в vertical через CSS media query. */
export const MobileGrid = {
  args: { variant: "grid" },
  parameters: { viewport: { defaultViewport: "mobile" } },
  render: (args) => <Interactive {...args} />,
};
