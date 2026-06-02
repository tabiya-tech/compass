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

export const Default: Story = {
  args: {
    children: "Get Started",
    showCircle: true,
  },
};

export const WithoutCircle: Story = {
  args: {
    children: "Get Started",
  },
};

export const Secondary: Story = {
  args: {
    children: "See Your Matches",
    color: "secondary",
    showCircle: true,
  },
};

export const BrandAction: Story = {
  args: {
    children: "Explore Pathways",
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
