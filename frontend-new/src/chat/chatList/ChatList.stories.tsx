import React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import ChatList from "./ChatList";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import { ChatMessageType, IChatMessage } from "src/chat/Chat.types";
import { nanoid } from "nanoid";
import CompassChatMessage from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";
import UserChatMessage from "src/chat/chatMessage/userChatMessage/UserChatMessage";
import TypingChatMessage from "src/chat/chatMessage/typingChatMessage/TypingChatMessage";
import ConversationConclusionChatMessage from "src/chat/chatMessage/conversationConclusionChatMessage/ConversationConclusionChatMessage";
import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";

// Helper function to create a message with its component
const createMessage = (
  message: string,
  sender: ConversationMessageSender,
  type: ChatMessageType = ChatMessageType.BASIC_CHAT,
  reaction: any = null
): IChatMessage => {
  const messageData = {
    message_id: nanoid(),
    sender,
    message,
    sent_at: new Date().toISOString(),
    type,
    reaction,
  };

  let component;
  switch (type) {
    case ChatMessageType.TYPING:
      component = <TypingChatMessage waitBeforeThinking={15000} />;
      break;
    case ChatMessageType.CONVERSATION_CONCLUSION:
      component = <ConversationConclusionChatMessage chatMessage={messageData} />;
      break;
    case ChatMessageType.ERROR:
      component = <ChatBubble message={messageData.message} sender={messageData.sender} />;
      break;
    default:
      component = sender === ConversationMessageSender.USER ? 
        <UserChatMessage chatMessage={messageData} /> : 
        <CompassChatMessage chatMessage={messageData} />;
  }

  return {
    ...messageData,
    component,
  };
};

const meta: Meta<typeof ChatList> = {
  title: "Chat/ChatList",
  component: ChatList,
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => {
      // Mock UserPreferencesStateService
      const mockService = UserPreferencesStateService.getInstance();
      mockService.getActiveSessionId = () => 1234;
      mockService.activeSessionHasCustomerSatisfactionRating = () => false;
      mockService.activeSessionHasOverallFeedback = () => false;
      return <Story />;
    },
  ],
};

export default meta;
type Story = StoryObj<typeof ChatList>;

export const Shown: Story = {
  args: {
    messages: [
      createMessage("Hello, how can I help you?", ConversationMessageSender.COMPASS),
      createMessage("I need help with something", ConversationMessageSender.USER),
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
      createMessage("Hello, how can I help you?", ConversationMessageSender.USER),
      createMessage("", ConversationMessageSender.COMPASS, ChatMessageType.TYPING),
    ],
  },
};

export const TypingWhenEmpty: Story = {
  args: {
    messages: [
      createMessage("", ConversationMessageSender.COMPASS, ChatMessageType.TYPING),
    ],
  },
};

export const SingleMessage: Story = {
  args: {
    messages: [
      createMessage("Hello, I'm Compass", ConversationMessageSender.COMPASS)
    ],
  },
};

export const MultipleMessages: Story = {
  args: {
    messages: [
      createMessage("Hello", ConversationMessageSender.USER),
      createMessage("Hi, I'm Compass", ConversationMessageSender.COMPASS),
      createMessage("Thank you for using compass", ConversationMessageSender.COMPASS, ChatMessageType.CONVERSATION_CONCLUSION),
      createMessage("Typing...", ConversationMessageSender.COMPASS, ChatMessageType.TYPING),
    ],
  },
};

export const LongConversation: Story = {
  args: {
    messages: Array.from({ length: 100 }, (_, i) => 
      createMessage(
        `Message ${i}`,
        i % 2 === 0 ? ConversationMessageSender.COMPASS : ConversationMessageSender.USER
      )
    ),
  },
};
