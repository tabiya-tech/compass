import React from "react";
import { Box, styled } from "@mui/material";
import { IChatMessage } from "src/chat/Chat.types";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import ChatMessageFooter from "src/chat/chatMessage/components/chatMessageFooter/ChatMessageFooter";
import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";

const uniqueId = "2fbaf2ef-9eab-485a-bd28-b4a164e18b06";

export const DATA_TEST_ID = {
  CHAT_MESSAGE_CONTAINER: `chat-message-container-${uniqueId}`,
};

export const MessageContainer = styled(Box)<{ origin: ConversationMessageSender }>(({ theme, origin }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: origin === ConversationMessageSender.USER ? "flex-end" : "flex-start",
  marginBottom: theme.spacing(theme.tabiyaSpacing.sm),
  width: "100%",
}));

type BasicChatMessageProps = {
  chatMessage: IChatMessage;
};

const BasicChatMessage: React.FC<BasicChatMessageProps> = ({ chatMessage }) => {
  return (
    <MessageContainer origin={chatMessage.sender} data-testid={DATA_TEST_ID.CHAT_MESSAGE_CONTAINER}>
      <ChatBubble message={chatMessage.message} sender={chatMessage.sender} />
      <ChatMessageFooter sentAt={chatMessage.sent_at} />
    </MessageContainer>
  );
};

export default BasicChatMessage;
