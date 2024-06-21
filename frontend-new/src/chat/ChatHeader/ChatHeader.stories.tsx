import type { Meta, StoryObj } from "@storybook/react";
import ChatHeader from "./ChatHeader";

const meta: Meta<typeof ChatHeader> = {
  title: "Chat/ChatHeader",
  component: ChatHeader,
  tags: ["autodocs"],
  argTypes: {},
};

export default meta;

type Story = StoryObj<typeof ChatHeader>;

export const Shown: Story = {
  args: {},
};
