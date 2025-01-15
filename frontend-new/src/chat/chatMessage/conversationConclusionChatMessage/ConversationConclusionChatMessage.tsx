import React from "react";
import { IChatMessage } from "src/chat/Chat.types";
import { MessageContainer } from "src/chat/chatMessage/userChatMessage/UserChatMessage";
import ConversationConclusionFooter from "src/chat/chatMessage/conversationConclusionChatMessage/conversationConclusionFooter/ConversationConclusionFooter";
import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import { Divider, useTheme } from "@mui/material"

const uniqueId = "2fbaf2ef-9eab-485a-bd28-b4a164e18b06";

export const DATA_TEST_ID = {
  CONVERSATION_CONCLUSION_CHAT_MESSAGE_CONTAINER: `conversation_conclusion_chat-message-container-${uniqueId}`
};

type ConversationConclusionChatMessageProps = {
  chatMessage: IChatMessage;
  notifyOnFeedbackFormOpened: () => void;
};

const ConversationConclusionChatMessage: React.FC<ConversationConclusionChatMessageProps> = ({ chatMessage, notifyOnFeedbackFormOpened }) => {
  const theme = useTheme()
  return (
    <MessageContainer origin={chatMessage.sender} data-testid={DATA_TEST_ID.CONVERSATION_CONCLUSION_CHAT_MESSAGE_CONTAINER}>
      <ChatBubble message={chatMessage.message} sender={chatMessage.sender}>
        <Divider
          color={theme.palette.grey[100]}
          sx={{ marginY: theme.spacing(1) }}
        />
        <ConversationConclusionFooter notifyOnFeedbackFormOpened={notifyOnFeedbackFormOpened} />
      </ChatBubble>
    </MessageContainer>
  );
};

export default ConversationConclusionChatMessage;
