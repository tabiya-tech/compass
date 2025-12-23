import React from "react";
import { MessageContainer } from "src/chat/chatMessage/userChatMessage/UserChatMessage";
import ConversationConclusionFooter from "src/chat/chatMessage/conversationConclusionChatMessage/conversationConclusionFooter/ConversationConclusionFooter";
import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";

const uniqueId = "2fbaf2ef-9eab-485a-bd28-b4a164e18b06";

export const DATA_TEST_ID = {
  CONVERSATION_CONCLUSION_CHAT_MESSAGE_CONTAINER: `conversation_conclusion_chat-message-container-${uniqueId}`,
};

export const CONVERSATION_CONCLUSION_CHAT_MESSAGE_TYPE = `conversation-conclusion-message-${uniqueId}`;

export interface ConversationConclusionChatMessageProps {
  message: string;
}

const ConversationConclusionChatMessage: React.FC<ConversationConclusionChatMessageProps> = ({ message }) => {
  return (
    <MessageContainer
      origin={ConversationMessageSender.COMPASS}
      data-testid={DATA_TEST_ID.CONVERSATION_CONCLUSION_CHAT_MESSAGE_CONTAINER}
    >
      <ChatBubble message={message} sender={ConversationMessageSender.COMPASS}>
        <ConversationConclusionFooter />
      </ChatBubble>
    </MessageContainer>
  );
};

export default ConversationConclusionChatMessage;
