import type { Meta, StoryObj } from "@storybook/react";
import ChatMessage from "./ChatMessage";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";

const meta: Meta<typeof ChatMessage> = {
  title: "Chat/ChatMessage",
  component: ChatMessage,
  tags: ["autodocs"],
};

export default meta;

type Story = StoryObj<typeof ChatMessage>;

export const FromCompass: Story = {
  args: {
    chatMessage: {
      id: 1,
      sender: ConversationMessageSender.COMPASS,
      sent_at: new Date().toISOString(),
      message:
        "Before we start, would you like to introduce yourself and tell me a bit about your life and what brought you here today?",
    },
  },
};

export const FromMe: Story = {
  args: {
    chatMessage: {
      id: 1,
      sender: ConversationMessageSender.USER,
      sent_at: new Date().toISOString(),
      message: "Hi. I'm here to learn about my skills!",
    },
  },
};

export const LongMessage: Story = {
  args: {
    chatMessage: {
      id: 1,
      sender: ConversationMessageSender.USER,
      sent_at: new Date().toISOString(),
      message:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
    },
  },
};

export const LongUnBrokenWord: Story = {
  args: {
    chatMessage: {
      id: 1,
      sender: ConversationMessageSender.USER,
      sent_at: new Date().toISOString(),
      message: "a".repeat(1000),
    },
  },
};

export const SingleLetter: Story = {
  args: {
    chatMessage: {
      id: 1,
      sender: ConversationMessageSender.USER,
      sent_at: new Date().toISOString(),
      message: "a",
    },
  },
};

export const ShownWithDifferentTimestamps: Story = {
  render: () => (
    <>
      <ChatMessage
        chatMessage={{
          id: 1,
          sender: ConversationMessageSender.USER,
          sent_at: new Date().toISOString(),
          message: "sent just now",
        }}
        isTyping={false}
      />
      <ChatMessage
        chatMessage={{
          id: 2,
          sender: ConversationMessageSender.USER,
          sent_at: new Date( Date.now() - 1000 * 60 * 60 ).toISOString(),
          message: "sent an hour ago",
        }}
        isTyping={false}
      />
      <ChatMessage
        chatMessage={{
          id: 3,
          sender: ConversationMessageSender.USER,
          sent_at: new Date( Date.now() - 1000 * 60 * 60 * 24 ).toISOString(),
          message: "sent yesterday",
        }}
        isTyping={false}
      />
      <ChatMessage
        chatMessage={{
          id: 4,
          sender: ConversationMessageSender.USER,
          sent_at: new Date( Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
          message: "sent two days ago",
        }}
        isTyping={false}
      />
      <ChatMessage chatMessage={
        {
          id: 5,
          sender: ConversationMessageSender.USER,
          sent_at: new Date( Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
          message: "sent a week ago",
        }
      } isTyping={false} />
      <ChatMessage
        chatMessage={{
          id: 5,
          sender: ConversationMessageSender.USER,
          sent_at: new Date( Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
          message: "sent a month ago",
        }}
        isTyping={false}
      />
      <ChatMessage
        chatMessage={{
          id: 6,
          sender: ConversationMessageSender.USER,
          sent_at: new Date( Date.now() - 1000 * 60 * 60 * 24 * 30 * 12).toISOString(),
          message: "sent a year ago",
        }}
        isTyping={false}
      />
    </>
  ),
};
