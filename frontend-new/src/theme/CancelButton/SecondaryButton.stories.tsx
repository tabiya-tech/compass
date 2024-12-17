import type { Meta, StoryObj } from "@storybook/react";

import SecondaryButton from "./SecondaryButton";

const meta: Meta<typeof SecondaryButton> = {
  title: "Components/SecondaryButton",
  component: SecondaryButton,
  tags: ["autodocs"],
  argTypes: {},
};

export default meta;
type Story = StoryObj<typeof SecondaryButton>;

export const Shown: Story = {
  args: {},
};

export const DisabledWhenOffline: Story = {
  args: {
    disableWhenOffline: true,
  },
};
