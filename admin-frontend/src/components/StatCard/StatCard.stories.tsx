import type { Meta, StoryObj } from "@storybook/react";
import StatCard from "src/components/StatCard/StatCard";

const meta: Meta<typeof StatCard> = {
  title: "Dashboard/StatCard",
  component: StatCard,
  tags: ["autodocs"],
  args: {
    title: "Active Students (7 days)",
    value: 921,
    subtitle: "68% of registered",
  },
};

export default meta;

type Story = StoryObj<typeof StatCard>;

export const Shown: Story = {};

export const ShownWithoutSubtitle: Story = {
  args: {
    subtitle: undefined,
  },
};

export const WithTooltip: Story = {
  args: {
    tooltip: "Students who logged in or interacted with Compass in the past 7 days.",
  },
};
