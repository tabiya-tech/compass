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
  args: {
    notifyOnFeedbackFormOpen: action("Feedback Form opened"),
    notifyOnExperiencesDrawerOpen: action("Experiences Drawer opened"),
    isFeedbackSubmitted: false,
    isFeedbackStarted: false,
  },
};

export default meta;

type Story = StoryObj<typeof ConversationConclusionChatMessage>;

export const AccurateMessage: Story = {
  args: {
    chatMessage: {
      id: nanoid(),
      sender: ConversationMessageSender.COMPASS,
      sent_at: new Date().toISOString(),
      message: "It was great exploring your skills with you! I hope you found this session helpful. Goodbye!",
      type: ChatMessageType.CONVERSATION_CONCLUSION,
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
      type: ChatMessageType.CONVERSATION_CONCLUSION,
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
      type: ChatMessageType.CONVERSATION_CONCLUSION,
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
      type: ChatMessageType.CONVERSATION_CONCLUSION,
    },
  },
};

export const FeedbackInProgress: Story = {
  args: {
    chatMessage: {
      id: nanoid(),
      sender: ConversationMessageSender.COMPASS,
      sent_at: new Date().toISOString(),
      message: "It was great exploring your skills with you! I hope you found this session helpful. Goodbye!",
      type: ChatMessageType.CONVERSATION_CONCLUSION,
    },
    isFeedbackStarted: true,
  },
};

export const FeedbackSubmitted: Story = {
  args: {
    chatMessage: {
      id: nanoid(),
      sender: ConversationMessageSender.COMPASS,
      sent_at: new Date().toISOString(),
      message: "It was great exploring your skills with you! I hope you found this session helpful. Goodbye!",
      type: ChatMessageType.CONVERSATION_CONCLUSION,
    },
    isFeedbackSubmitted: true,
  },
};
