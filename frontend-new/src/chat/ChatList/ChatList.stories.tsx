import type { Meta, StoryObj } from "@storybook/react";
import ChatList from "./ChatList";
import { ChatMessageOrigin } from "../Chat.types";

const meta: Meta<typeof ChatList> = {
  title: "Chat/ChatList",
  component: ChatList,
  tags: ["autodocs"],
  argTypes: {},
};

export default meta;

type Story = StoryObj<typeof ChatList>;

export const Shown: Story = {
  args: {
    messages: [
      {
        id: 1,
        origin: ChatMessageOrigin.COMPASS,
        message: "Hello, how can I help you?",
        timestamp: Date.now(),
      },
      {
        id: 2,
        origin: ChatMessageOrigin.ME,
        message: "I need help with something",
        timestamp: Date.now(),
      },
    ],
  },
};
