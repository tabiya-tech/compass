import React from "react";
import { IChatMessage } from "src/chat/Chat.types";
import { MessageContainer } from "src/chat/chatMessage/basicChatMessage/BasicChatMessage";
import ConversationConclusionFooter from "src/chat/chatMessage/conversationConclusionChatMessage/conversationConclusionFooter/ConversationConclusionFooter";
import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";

const uniqueId = "2fbaf2ef-9eab-485a-bd28-b4a164e18b06";

export const DATA_TEST_ID = {
  CONVERSATION_CONCLUSION_CHAT_MESSAGE_CONTAINER: `conversation_conclusion_chat-message-container-${uniqueId}`,
};

interface ConversationConclusionChatMessageProps {
  chatMessage: IChatMessage;
}

const ConversationConclusionChatMessage: React.FC<ConversationConclusionChatMessageProps> = ({
  chatMessage,
}) => {
  return (
    <MessageContainer
      origin={chatMessage.sender}
      data-testid={DATA_TEST_ID.CONVERSATION_CONCLUSION_CHAT_MESSAGE_CONTAINER}
    >
      <ChatBubble message={chatMessage.message} sender={chatMessage.sender}>
        <ConversationConclusionFooter />
      </ChatBubble>
    </MessageContainer>
  );
};

export default ConversationConclusionChatMessage;
