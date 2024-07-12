import type { Meta, StoryObj } from "@storybook/react";
import ChatList from "./ChatList";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";

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
        sender: ConversationMessageSender.COMPASS,
        message: "Hello, how can I help you?",
        sent_at: new Date().toISOString(),
      },
      {
        id: 2,
        sender: ConversationMessageSender.USER,
        message: "I need help with something",
        sent_at: new Date().toString(),
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
        sender: ConversationMessageSender.USER,
        message: "Hello, how can I help you?",
        sent_at: new Date().toISOString(),
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
      sender: i % 2 === 0 ? ConversationMessageSender.COMPASS : ConversationMessageSender.USER,
      message: `Message ${i}`,
      sent_at: new Date(Date.now() - i * 1000 * 60 * 60 * 24).toISOString(),
    })),
  },
};
