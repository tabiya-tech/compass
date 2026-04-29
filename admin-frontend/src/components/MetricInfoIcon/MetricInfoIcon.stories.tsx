import type { Meta, StoryObj } from "@storybook/react";
import MetricInfoIcon from "src/components/MetricInfoIcon/MetricInfoIcon";

const meta: Meta<typeof MetricInfoIcon> = {
  title: "Dashboard/MetricInfoIcon",
  component: MetricInfoIcon,
  tags: ["autodocs"],
  args: {
    title: "Students who logged in or interacted with Compass in the past 7 days.",
  },
};

export default meta;

type Story = StoryObj<typeof MetricInfoIcon>;

export const Shown: Story = {};

export const LargerIcon: Story = {
  args: {
    iconSize: 20,
  },
};
