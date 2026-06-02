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

export const Default: Story = {
  args: {
    children: "View Full Course",
    showCircle: true,
  },
};

export const WithoutCircle: Story = {
  args: {
    children: "Learn More",
  },
};

export const Secondary: Story = {
  args: {
    children: "View Matches",
    color: "secondary",
    showCircle: true,
  },
};

export const BrandAction: Story = {
  args: {
    children: "Learn More",
    color: "primary",
    showCircle: true,
  },
};

export const Disabled: Story = {
  args: {
    children: "Continue",
    showCircle: true,
    disabled: true,
  },
};

export const DisabledWhenOffline: Story = {
  args: {
    children: "Continue",
    disableWhenOffline: true,
  },
};
