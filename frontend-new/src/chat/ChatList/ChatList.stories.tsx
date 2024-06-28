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

export const Empty: Story = {
  args: {
    messages: [],
  },
};

export const Typing: Story = {
  args: {
    messages: [
      {
        id: 1,
        origin: ChatMessageOrigin.ME,
        message: "Hello, how can I help you?",
        timestamp: Date.now(),
      },
    ],
    isTyping: true,
  },
};

export const TypingWhenEmpty: Story = {
  args: {
    messages: [],
    isTyping: true,
  },
};

export const LongConversation: Story = {
  args: {
    messages: Array.from({ length: 100 }, (_, i) => ({
      id: i,
      origin: i % 2 === 0 ? ChatMessageOrigin.COMPASS : ChatMessageOrigin.ME,
      message: `Message ${i}`,
      timestamp: Date.now() - i * 1000,
    })),
  },
};
