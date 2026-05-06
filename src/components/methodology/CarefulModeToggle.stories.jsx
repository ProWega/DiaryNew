import { useState } from "react";
import CarefulModeToggle from "./CarefulModeToggle";

export default {
  title: "Methodology/CarefulModeToggle",
  component: CarefulModeToggle,
  parameters: { layout: "centered" },
  argTypes: {
    compact: { control: "boolean" },
  },
  args: { compact: false },
};

function Interactive(args) {
  const [value, setValue] = useState(args.value ?? false);
  return (
    <div style={{ width: 480, padding: "var(--space-5)" }}>
      <CarefulModeToggle {...args} value={value} onChange={setValue} />
    </div>
  );
}

/** Default — пометка не активна. Полный текст с описанием видимый. */
export const Default = {
  args: { value: false, compact: false },
  render: (args) => <Interactive {...args} />,
};

/** Активное состояние — пометка поставлена. */
export const Active = {
  args: { value: true, compact: false },
  render: (args) => <Interactive {...args} />,
};

/** Compact — без описания, для inline-использования (например, под textarea). */
export const Compact = {
  args: { value: false, compact: true },
  render: (args) => <Interactive {...args} />,
};
