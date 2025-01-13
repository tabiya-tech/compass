import type { Meta, StoryObj } from "@storybook/react";
import ConversationConclusionChatMessage from "src/chat/chatMessage/conversationConclusionChatMessage/ConversationConclusionChatMessage";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import { ChatMessageType } from "src/chat/Chat.types";
import { nanoid } from "nanoid";
import { action } from "@storybook/addon-actions";

const meta: Meta<typeof ConversationConclusionChatMessage> = {
  title: "Chat/ChatMessage/ConversationConclusion",
  component: ConversationConclusionChatMessage,
  tags: ["autodocs"],
  argTypes: {},
};

export default meta;

type Story = StoryObj<typeof ConversationConclusionChatMessage>;

// REVIEW: add notifyOnFeedbackFormOpened on all the stories
export const AccurateMessage: Story = {
  args: {
    chatMessage: {
      id: nanoid(),
      sender: ConversationMessageSender.COMPASS,
      sent_at: new Date().toISOString(),
      message:
        "We’d love your feedback on this conversation. It’ll only take 5 minutes and will help us improve your experience",
      type: ChatMessageType.CONVERSATION_CONCLUSION
    },
  },
};


export const LongMessage: Story = {
  args: {
    chatMessage: {
      id: nanoid(),
      sender: ConversationMessageSender.COMPASS,
      sent_at: new Date().toISOString(),
      message:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
      type: ChatMessageType.CONVERSATION_CONCLUSION
    },
  },
};

export const LongUnBrokenWord: Story = {
  args: {
    chatMessage: {
      id: nanoid(),
      sender: ConversationMessageSender.COMPASS,
      sent_at: new Date().toISOString(),
      message: "a".repeat(1000),
      type: ChatMessageType.BASIC_CHAT
    },
  },
};

export const SingleLetter: Story = {
  args: {
    chatMessage: {
      id: nanoid(),
      sender: ConversationMessageSender.COMPASS,
      sent_at: new Date().toISOString(),
      message: "a",
      type: ChatMessageType.BASIC_CHAT
    },
  },
};

export const ShownWithDifferentTimestamps: Story = {
  render: () => (
    <>
      <ConversationConclusionChatMessage
        chatMessage={{
          id: nanoid(),
          sender: ConversationMessageSender.COMPASS,
          sent_at: new Date().toISOString(),
          message: "sent just now",
          type: ChatMessageType.BASIC_CHAT
        }}
        notifyOnFeedbackFormOpened={action("Feedback Form opened")}
      />
      <ConversationConclusionChatMessage
        chatMessage={{
          id: nanoid(),
          sender: ConversationMessageSender.COMPASS,
          sent_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
          message: "sent an hour ago",
          type: ChatMessageType.BASIC_CHAT
        }}
        notifyOnFeedbackFormOpened={action("Feedback Form opened")}
      />
      <ConversationConclusionChatMessage
        chatMessage={{
          id: nanoid(),
          sender: ConversationMessageSender.COMPASS,
          sent_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
          message: "sent yesterday",
          type: ChatMessageType.BASIC_CHAT
        }}
        notifyOnFeedbackFormOpened={action("Feedback Form opened")}
      />
      <ConversationConclusionChatMessage
        chatMessage={{
          id: nanoid(),
          sender: ConversationMessageSender.COMPASS,
          sent_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
          message: "sent two days ago",
          type: ChatMessageType.BASIC_CHAT
        }}
        notifyOnFeedbackFormOpened={action("Feedback Form opened")}
      />
      <ConversationConclusionChatMessage
        chatMessage={{
          id: nanoid(),
          sender: ConversationMessageSender.COMPASS,
          sent_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
          message: "sent a week ago",
          type: ChatMessageType.BASIC_CHAT
        }}
        notifyOnFeedbackFormOpened={action("Feedback Form opened")}
      />
      <ConversationConclusionChatMessage
        chatMessage={{
          id: nanoid(),
          sender: ConversationMessageSender.COMPASS,
          sent_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
          message: "sent a month ago",
          type: ChatMessageType.BASIC_CHAT
        }}
        notifyOnFeedbackFormOpened={action("Feedback Form opened")}
      />
      <ConversationConclusionChatMessage
        chatMessage={{
          id: nanoid(),
          sender: ConversationMessageSender.COMPASS,
          sent_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30 * 12).toISOString(),
          message: "sent a year ago",
          type: ChatMessageType.BASIC_CHAT
        }}
        notifyOnFeedbackFormOpened={action("Feedback Form opened")}
      />
    </>
  ),
};