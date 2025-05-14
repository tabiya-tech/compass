import type { Meta, StoryObj } from "@storybook/react";

import PrimaryButton from "./PrimaryButton";

const meta: Meta<typeof PrimaryButton> = {
  title: "Components/PrimaryButton",
  component: PrimaryButton,
  tags: ["autodocs"],
  argTypes: {
    onClick: { action: "clicked" },
  },
};

export default meta;
type Story = StoryObj<typeof PrimaryButton>;

export const Shown: Story = {
  args: {
    children: "Click here",
  },
};

export const Disabled: Story = {
  args: {
    children: "Click here",
    disabled: true,
  },
};

export const DisabledWhenOffline: Story = {
  args: {
    children: "Click here",
    disableWhenOffline: true,
  },
};
