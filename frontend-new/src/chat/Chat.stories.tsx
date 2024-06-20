import type { Meta, StoryObj } from "@storybook/react";
import Chat from "./Chat";

const meta: Meta<typeof Chat> = {
  title: "Chat/Chat-Component",
  component: Chat,
  tags: ["autodocs"],
  argTypes: {},
};

export default meta;

type Story = StoryObj<typeof Chat>;

export const Shown: Story = {
  args: {},
};
