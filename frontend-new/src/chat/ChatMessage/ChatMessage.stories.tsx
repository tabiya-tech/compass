import type { Meta, StoryObj } from "@storybook/react";
import ChatMessage, { ChatMessageFooterType } from "./ChatMessage";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import { nanoid } from "nanoid";

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
      id: nanoid(),
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
      id: nanoid(),
      sender: ConversationMessageSender.USER,
      sent_at: new Date().toISOString(),
      message: "Hi. I'm here to learn about my skills!",
    },
  },
};

export const LongMessage: Story = {
  args: {
    chatMessage: {
      id: nanoid(),
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
      id: nanoid(),
      sender: ConversationMessageSender.USER,
      sent_at: new Date().toISOString(),
      message: "a".repeat(1000),
    },
  },
};

export const SingleLetter: Story = {
  args: {
    chatMessage: {
      id: nanoid(),
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
          id: nanoid(),
          sender: ConversationMessageSender.USER,
          sent_at: new Date().toISOString(),
          message: "sent just now",
        }}
        notifyOpenFeedbackForm={() => {}}
        notifyReactionChange={() => {}}
      />
      <ChatMessage
        chatMessage={{
          id: nanoid(),
          sender: ConversationMessageSender.USER,
          sent_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
          message: "sent an hour ago",
        }}
        notifyOpenFeedbackForm={() => {}}
        notifyReactionChange={() => {}}
      />
      <ChatMessage
        chatMessage={{
          id: nanoid(),
          sender: ConversationMessageSender.USER,
          sent_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
          message: "sent yesterday",
        }}
        notifyOpenFeedbackForm={() => {}}
        notifyReactionChange={() => {}}
      />
      <ChatMessage
        chatMessage={{
          id: nanoid(),
          sender: ConversationMessageSender.USER,
          sent_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
          message: "sent two days ago",
        }}
        notifyOpenFeedbackForm={() => {}}
        notifyReactionChange={() => {}}
      />
      <ChatMessage
        chatMessage={{
          id: nanoid(),
          sender: ConversationMessageSender.USER,
          sent_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
          message: "sent a week ago",
        }}
        notifyOpenFeedbackForm={() => {}}
        notifyReactionChange={() => {}}
      />
      <ChatMessage
        chatMessage={{
          id: nanoid(),
          sender: ConversationMessageSender.USER,
          sent_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
          message: "sent a month ago",
        }}
        notifyOpenFeedbackForm={() => {}}
        notifyReactionChange={() => {}}
      />
      <ChatMessage
        chatMessage={{
          id: nanoid(),
          sender: ConversationMessageSender.USER,
          sent_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30 * 12).toISOString(),
          message: "sent a year ago",
        }}
        notifyOpenFeedbackForm={() => {}}
        notifyReactionChange={() => {}}
      />
    </>
  ),
};

export const ShownWithFeedbackFooter: Story = {
  args: {
    chatMessage: {
      id: nanoid(),
      sender: ConversationMessageSender.COMPASS,
      sent_at: new Date().toISOString(),
      message: "Please provide feedback on your experience",
      footerType: ChatMessageFooterType.FEEDBACK_FORM_BUTTON,
    },
  },
};

export const WithFeedbackFormButton: Story = {
  args: {
    chatMessage: {
      id: nanoid(),
      sender: ConversationMessageSender.COMPASS,
      sent_at: new Date().toISOString(),
      message: "Hello, I'm Compass",
      footerType: ChatMessageFooterType.FEEDBACK_FORM_BUTTON,
    },
  },
};

export const WithReactions: Story = {
  args: {
    chatMessage: {
      id: nanoid(),
      sender: ConversationMessageSender.COMPASS,
      sent_at: new Date().toISOString(),
      message: "Hello, I'm Compass",
    },
  },
};