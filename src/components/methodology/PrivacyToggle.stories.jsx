import { useState } from "react";
import PrivacyToggle from "./PrivacyToggle";

export default {
  title: "Methodology/PrivacyToggle",
  component: PrivacyToggle,
  parameters: { layout: "centered" },
  argTypes: {
    compact: { control: "boolean" },
  },
  args: { compact: false },
};

function Interactive(args) {
  const [state, setState] = useState({
    isAnonymous: args.isAnonymous ?? false,
    isHiddenFromCurator: args.isHiddenFromCurator ?? false,
  });
  return (
    <div
      style={{
        width: 480,
        padding: "var(--space-5)",
        background: "var(--color-surface-card)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-2)",
      }}
    >
      <textarea
        rows={4}
        defaultValue="Ваша запись (placeholder textarea — в реальности это reflection editor)"
        style={{
          width: "100%",
          padding: "var(--space-3)",
          marginBottom: "var(--space-4)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-1)",
          fontFamily: "inherit",
          resize: "vertical",
        }}
      />
      <PrivacyToggle {...args} {...state} onChange={setState} />
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
        {JSON.stringify(state, null, 2)}
      </pre>
    </div>
  );
}

/** Default — два независимых чекбокса. Прямое отражение БД. */
export const Default = {
  render: (args) => <Interactive {...args} />,
};

/** Compact — для inline под textarea. */
export const Compact = {
  args: { compact: true },
  render: (args) => <Interactive {...args} />,
};

/** Hidden — anonymous-чекбокс задизейблен (запись куратору не видна). */
export const HiddenState = {
  args: { isHiddenFromCurator: true },
  render: (args) => <Interactive {...args} />,
};
