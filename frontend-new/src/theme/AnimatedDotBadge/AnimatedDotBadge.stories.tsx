import React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import AnimatedDotBadge from "./AnimatedDotBadge";

const meta: Meta<typeof AnimatedDotBadge> = {
  title: "Components/AnimatedDotBadge",
  component: AnimatedDotBadge,
  tags: ["autodocs"],
};

export default meta;

type Story = StoryObj<typeof AnimatedDotBadge>;

export const Visible: Story = {
  args: {
    show: true,
    children: <div style={{ width: 40, height: 40, background: "#e0e0e0", borderRadius: 8 }} />,
  },
};

export const Hidden: Story = {
  args: {
    show: false,
    children: <div style={{ width: 40, height: 40, background: "#e0e0e0", borderRadius: 8 }} />,
  },
};


