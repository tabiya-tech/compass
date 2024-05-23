import App from "./App";
import type { Meta, StoryObj } from "@storybook/react";

const meta: Meta<typeof App> = {
  title: "Application/App",
  component: App,
  tags: ["autodocs"],
  argTypes: {},
};

export default meta;
type Story = StoryObj<typeof App>;

export const Shown: Story = {};
