import React, { ReactElement } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import ChatList from "./ChatList";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import { IChatMessage } from "src/chat/Chat.types";
import { nanoid } from "nanoid";
import CompassChatMessage, { CompassChatMessageProps, COMPASS_CHAT_MESSAGE_TYPE } from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";
import UserChatMessage, { UserChatMessageProps, USER_CHAT_MESSAGE_TYPE } from "src/chat/chatMessage/userChatMessage/UserChatMessage";
import TypingChatMessage, { TypingChatMessageProps, TYPING_CHAT_MESSAGE_TYPE } from "src/chat/chatMessage/typingChatMessage/TypingChatMessage";
import ConversationConclusionChatMessage, { ConversationConclusionChatMessageProps, CONVERSATION_CONCLUSION_CHAT_MESSAGE_TYPE } from "src/chat/chatMessage/conversationConclusionChatMessage/ConversationConclusionChatMessage";
import ErrorChatMessage, {
  ERROR_CHAT_MESSAGE_TYPE,
  ErrorChatMessageProps,
} from "src/chat/chatMessage/errorChatMessage/ErrorChatMessage";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";

// Helper function to create a message with its component
const createMessage = (
  message: string,
  sender: ConversationMessageSender,
  type: string = USER_CHAT_MESSAGE_TYPE,
  reaction: any = null
): IChatMessage<any> => {
  const messageData = {
    message_id: nanoid(),
    sender,
    message,
    sent_at: new Date().toISOString(),
    type,
    reaction,
  };

  let component: (props: any) => ReactElement<any>;
  if (type === TYPING_CHAT_MESSAGE_TYPE) {
    component = (props) => <TypingChatMessage {...(props as TypingChatMessageProps)} />;
  } else if (type === CONVERSATION_CONCLUSION_CHAT_MESSAGE_TYPE) {
    component = (props) => <ConversationConclusionChatMessage {...(props as ConversationConclusionChatMessageProps)} />;
  } else if (type === ERROR_CHAT_MESSAGE_TYPE) {
    component = (props) => <ErrorChatMessage {...(props as ErrorChatMessageProps)} />;
  } else {
    component = sender === ConversationMessageSender.USER ? 
      (props) => <UserChatMessage {...(props as UserChatMessageProps)} /> :
      (props) => <CompassChatMessage {...(props as CompassChatMessageProps)} />;
  }

  return {
    type: messageData.type,
    message_id: messageData.message_id,
    sender: messageData.sender,
    payload: messageData,
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
      createMessage("Hello, how can I help you?", ConversationMessageSender.COMPASS, COMPASS_CHAT_MESSAGE_TYPE),
      createMessage("I need help with something", ConversationMessageSender.USER, USER_CHAT_MESSAGE_TYPE),
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
      createMessage("Hello, how can I help you?", ConversationMessageSender.USER, USER_CHAT_MESSAGE_TYPE),
      createMessage("", ConversationMessageSender.COMPASS, TYPING_CHAT_MESSAGE_TYPE),
    ],
  },
};

export const TypingWhenEmpty: Story = {
  args: {
    messages: [
      createMessage("", ConversationMessageSender.COMPASS, TYPING_CHAT_MESSAGE_TYPE),
    ],
  },
};

export const SingleMessage: Story = {
  args: {
    messages: [
      createMessage("Hello, I'm Brujula", ConversationMessageSender.COMPASS, COMPASS_CHAT_MESSAGE_TYPE)
    ],
  },
};

export const MultipleMessages: Story = {
  args: {
    messages: [
      createMessage("Hello", ConversationMessageSender.USER, USER_CHAT_MESSAGE_TYPE),
      createMessage("Hi, I'm Brujula", ConversationMessageSender.COMPASS, COMPASS_CHAT_MESSAGE_TYPE),
      createMessage("Thank you for using compass", ConversationMessageSender.COMPASS, CONVERSATION_CONCLUSION_CHAT_MESSAGE_TYPE),
      createMessage("Typing...", ConversationMessageSender.COMPASS, TYPING_CHAT_MESSAGE_TYPE),
    ],
  },
};

export const LongConversation: Story = {
  args: {
    messages: Array.from({ length: 100 }, (_, i) => 
      createMessage(
        `Message ${i}`,
        i % 2 === 0 ? ConversationMessageSender.COMPASS : ConversationMessageSender.USER,
        i % 2 === 0 ? COMPASS_CHAT_MESSAGE_TYPE : USER_CHAT_MESSAGE_TYPE
      )
    ),
  },
};
