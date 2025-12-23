import React from "react";
import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
const uniqueId = "error-message-7f3d9b2a-1c4e-4f8a-9d6b-5e2a8c1f3d9b";

export const ERROR_CHAT_MESSAGE_TYPE = `error-message-${uniqueId}`;

export const DATA_TEST_ID = {
  ERROR_CHAT_MESSAGE_CONTAINER: `error-chat-message-container-${uniqueId}`,
};

export type ErrorChatMessageProps = {
  message: string;
  children?: React.ReactNode;
};

const ErrorChatMessage: React.FC<ErrorChatMessageProps> = ({ message, children }) => {
  return (
    <div data-testid={DATA_TEST_ID.ERROR_CHAT_MESSAGE_CONTAINER}>
      <ChatBubble message={message} sender={ConversationMessageSender.COMPASS}>
        {children}
      </ChatBubble>
    </div>
  );
};

export default ErrorChatMessage;
