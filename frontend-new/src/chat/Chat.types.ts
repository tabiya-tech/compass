import { ReactElement } from "react";

import { CompassChatMessageProps } from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";
import { UserChatMessageProps } from "src/chat/chatMessage/userChatMessage/UserChatMessage";
import { ConversationConclusionChatMessageProps } from "src/chat/chatMessage/conversationConclusionChatMessage/ConversationConclusionChatMessage";
import { TypingChatMessageProps } from "src/chat/chatMessage/typingChatMessage/TypingChatMessage";
import { ChatBubbleProps } from "src/chat/chatMessage/components/chatBubble/ChatBubble";

export enum ChatMessageType {
  USER_MESSAGE = "user_message",
  COMPASS_MESSAGE = "compass_message",
  CONVERSATION_CONCLUSION = "conversation_conclusion",
  TYPING = "typing",
  ERROR = "error",
}

export type IChatMessage<T> = {
  type: ChatMessageType;
  message_id: string;
  sender: string;
  payload: T;
  component: (props: T) => ReactElement<T>;
};

export type ChatMessageProps = CompassChatMessageProps | UserChatMessageProps | ConversationConclusionChatMessageProps | TypingChatMessageProps | ChatBubbleProps;
