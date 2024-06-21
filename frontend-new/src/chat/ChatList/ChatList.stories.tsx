import type { Meta, StoryObj } from "@storybook/react";
import ChatList from "./ChatList";

const meta: Meta<typeof ChatList> = {
  title: "Chat/ChatList",
  component: ChatList,
  tags: ["autodocs"],
  argTypes: {},
};

export default meta;

type Story = StoryObj<typeof ChatList>;

export const Shown: Story = {
  args: {},
};
