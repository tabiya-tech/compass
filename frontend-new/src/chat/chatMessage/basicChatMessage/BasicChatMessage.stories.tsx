import type { Meta, StoryObj } from "@storybook/react";
import BasicChatMessage from "./BasicChatMessage";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import { nanoid } from "nanoid";
import { ChatMessageType } from "src/chat/Chat.types";

const meta: Meta<typeof BasicChatMessage> = {
  // REVIEW: Chat/ChatMessage/Basic
  title: "Chat/ChatMessage/Basic",
  component: BasicChatMessage,
  tags: ["autodocs"],
};

export default meta;

type Story = StoryObj<typeof BasicChatMessage>;

export const FromCompass: Story = {
  args: {
    chatMessage: {
      message_id: nanoid(),
      sender: ConversationMessageSender.COMPASS,
      sent_at: new Date().toISOString(),
      message:
        "Before we start, would you like to introduce yourself and tell me a bit about your life and what brought you here today?",
      type: ChatMessageType.BASIC_CHAT
    },
  },
};

export const FromMe: Story = {
  args: {
    chatMessage: {
      message_id: nanoid(),
      sender: ConversationMessageSender.USER,
      sent_at: new Date().toISOString(),
      message: "Hi. I'm here to learn about my skills!",
      type: ChatMessageType.BASIC_CHAT
    },
  },
};

export const LongMessage: Story = {
  args: {
    chatMessage: {
      message_id: nanoid(),
      sender: ConversationMessageSender.USER,
      sent_at: new Date().toISOString(),
      message:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
      type: ChatMessageType.BASIC_CHAT
    },
  },
};

export const LongUnBrokenWord: Story = {
  args: {
    chatMessage: {
      message_id: nanoid(),
      sender: ConversationMessageSender.USER,
      sent_at: new Date().toISOString(),
      message: "a".repeat(1000),
      type: ChatMessageType.BASIC_CHAT
    },
  },
};

export const SingleLetter: Story = {
  args: {
    chatMessage: {
      message_id: nanoid(),
      sender: ConversationMessageSender.USER,
      sent_at: new Date().toISOString(),
      message: "a",
      type: ChatMessageType.BASIC_CHAT
    },
  },
};

export const ShownWithDifferentTimestamps: Story = {
  render: () => (
    <>
      <BasicChatMessage
        chatMessage={{
          message_id: nanoid(),
          sender: ConversationMessageSender.USER,
          sent_at: new Date().toISOString(),
          message: "sent just now",
          type: ChatMessageType.BASIC_CHAT
        }}
      />
      <BasicChatMessage
        chatMessage={{
          message_id: nanoid(),
          sender: ConversationMessageSender.USER,
          sent_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
          message: "sent an hour ago",
          type: ChatMessageType.BASIC_CHAT
        }}
      />
      <BasicChatMessage
        chatMessage={{
          message_id: nanoid(),
          sender: ConversationMessageSender.USER,
          sent_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
          message: "sent yesterday",
          type: ChatMessageType.BASIC_CHAT
        }}
      />
      <BasicChatMessage
        chatMessage={{
          message_id: nanoid(),
          sender: ConversationMessageSender.USER,
          sent_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
          message: "sent two days ago",
          type: ChatMessageType.BASIC_CHAT
        }}
      />
      <BasicChatMessage
        chatMessage={{
          message_id: nanoid(),
          sender: ConversationMessageSender.USER,
          sent_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
          message: "sent a week ago",
          type: ChatMessageType.BASIC_CHAT
        }}
      />
      <BasicChatMessage
        chatMessage={{
          message_id: nanoid(),
          sender: ConversationMessageSender.USER,
          sent_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
          message: "sent a month ago",
          type: ChatMessageType.BASIC_CHAT
        }}
      />
      <BasicChatMessage
        chatMessage={{
          message_id: nanoid(),
          sender: ConversationMessageSender.USER,
          sent_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30 * 12).toISOString(),
          message: "sent a year ago",
          type: ChatMessageType.BASIC_CHAT
        }}
      />
    </>
  ),
};
