import { useState } from "react";
import ReflectionEditor from "./ReflectionEditor";

export default {
  title: "Methodology/ReflectionEditor",
  component: ReflectionEditor,
  parameters: { layout: "padded" },
  argTypes: {
    journeyStage: {
      control: "radio",
      options: [null, "search", "verification", "support", "transmission"],
    },
    isCarefulMode: { control: "boolean" },
    showFreeText: { control: "boolean" },
    compact: { control: "boolean" },
  },
  args: {
    journeyStage: null,
    isCarefulMode: false,
    showFreeText: true,
    compact: false,
  },
};

function Interactive(args) {
  const [value, setValue] = useState({});
  return (
    <div style={{ width: 640, maxWidth: "100%", margin: "0 auto" }}>
      <ReflectionEditor {...args} value={value} onChange={setValue} />
      <pre
        style={{
          marginTop: "var(--space-4)",
          padding: "var(--space-3)",
          background: "var(--color-surface-muted)",
          borderRadius: "var(--radius-1)",
          fontSize: "var(--font-size-xs)",
          color: "var(--color-text-soft)",
        }}
      >
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

/** Default — без выбранного этапа, дефолтные промпты (Что прояснилось/отозвалось/К чему подвинулся). */
export const Default = {
  render: (args) => <Interactive {...args} />,
};

/** Поиск — для тех, кто ещё выбирает (промпты про присматривание, что отзывается). */
export const StageSearch = {
  args: { journeyStage: "search" },
  render: (args) => <Interactive {...args} />,
};

/** Проверка — для семинаристов 19-22 и тех, кто проверяет принятый путь. */
export const StageVerification = {
  args: { journeyStage: "verification" },
  render: (args) => <Interactive {...args} />,
};

/** Опора — уверенно идущим (промпты про углубление, своих). */
export const StageSupport = {
  args: { journeyStage: "support" },
  render: (args) => <Interactive {...args} />,
};

/** Передача — несущим ответственность (промпты про инструменты, что передать). */
export const StageTransmission = {
  args: { journeyStage: "transmission" },
  render: (args) => <Interactive {...args} />,
};

/** Careful mode — мягкие промпты поверх любого этапа. */
export const CarefulMode = {
  args: { journeyStage: "support", isCarefulMode: true },
  render: (args) => <Interactive {...args} />,
};

/** Compact — без описаний, под inline-режим (на мобильном или внутри диалога). */
export const Compact = {
  args: { compact: true, showFreeText: false },
  render: (args) => <Interactive {...args} />,
};

/** Без свободной записи — только три оси. */
export const ThreeAxesOnly = {
  args: { showFreeText: false },
  render: (args) => <Interactive {...args} />,
};
