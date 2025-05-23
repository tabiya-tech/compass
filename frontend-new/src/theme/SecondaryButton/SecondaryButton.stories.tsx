import type { Meta, StoryObj } from "@storybook/react";

import SecondaryButton from "./SecondaryButton";

const meta: Meta<typeof SecondaryButton> = {
  title: "Components/SecondaryButton",
  component: SecondaryButton,
  tags: ["autodocs"],
  argTypes: {
    onClick: { action: "clicked" },
  },
};

export default meta;
type Story = StoryObj<typeof SecondaryButton>;

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
