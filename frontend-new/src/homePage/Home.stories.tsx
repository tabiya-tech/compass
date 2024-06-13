import type { Meta, StoryObj } from "@storybook/react";
import Home from "./Home";

const meta: Meta<typeof Home> = {
  title: "Application/Home",
  component: Home,
  tags: ["autodocs"],
  argTypes: {},
};

export default meta;

type Story = StoryObj<typeof Home>;

export const Shown: Story = {
  args: {},
};
