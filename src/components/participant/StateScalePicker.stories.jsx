import { useEffect, useState } from "react";
import { stateScale } from "../../data/mockData";
import StateScalePicker from "./StateScalePicker";

const stateIds = ["", ...stateScale.map((state) => state.id)];

export default {
  title: "Participant/StateScalePicker",
  component: StateScalePicker,
  argTypes: {
    variant: { control: "radio", options: ["arc", "zones", "compact"] },
    value: { control: "select", options: stateIds },
    animated: { control: "boolean" },
    disabled: { control: "boolean" },
    showDescriptions: { control: "boolean" },
    label: { control: "text" },
    states: { table: { disable: true } },
    onChange: { table: { disable: true } },
  },
  args: {
    states: stateScale,
    value: "balance",
    variant: "arc",
    animated: true,
    disabled: false,
    showDescriptions: true,
    label: "Шкала состояния",
  },
};

function StateScalePickerStory(args) {
  const [selectedState, setSelectedState] = useState(args.value);

  useEffect(() => {
    setSelectedState(args.value);
  }, [args.value]);

  return (
    <div style={{ maxWidth: 760, padding: 20 }}>
      <StateScalePicker {...args} value={selectedState} onChange={setSelectedState} />
    </div>
  );
}

export const Playground = {
  render: (args) => <StateScalePickerStory {...args} />,
};

export const ArcModel = {
  args: {
    variant: "arc",
    value: "engaged",
  },
  render: (args) => <StateScalePickerStory {...args} />,
};

export const ArcNeutralPreview = {
  args: {
    variant: "arc",
    value: "",
  },
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
  render: (args) => <StateScalePickerStory {...args} />,
};

export const ZoneCards = {
  args: {
    variant: "zones",
    value: "relaxed",
  },
  render: (args) => <StateScalePickerStory {...args} />,
};

export const CompactMobile = {
  args: {
    variant: "compact",
    value: "passive",
    showDescriptions: false,
  },
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
  render: (args) => <StateScalePickerStory {...args} />,
};

export const Disabled = {
  args: {
    disabled: true,
    value: "overstimulated",
  },
  render: (args) => <StateScalePickerStory {...args} />,
};

export const WithoutAnimation = {
  args: {
    animated: false,
    value: "panic",
  },
  render: (args) => <StateScalePickerStory {...args} />,
};
