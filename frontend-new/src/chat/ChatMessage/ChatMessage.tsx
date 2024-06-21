import React from "react";
import { Box, Typography } from "@mui/material";
import { styled } from "@mui/system";
import { ChatMessageOrigin, IChatMessage } from "src/chat/Chat.types";

const uniqueId = "2fbaf2ef-9eab-485a-bd28-b4a164e18b06";

export const DATA_TEST_ID = {
  CHAT_MESSAGE_CONTAINER: `chat-message-container-${uniqueId}`,
};

const MessageContainer = styled(Box)<{ origin: ChatMessageOrigin }>(({ theme, origin }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: origin === ChatMessageOrigin.ME ? "flex-end" : "flex-start",
  margin: "10px 0",
}));

const MessageBubble = styled(Box)<{ origin: ChatMessageOrigin }>(({ theme, origin }) => ({
  maxWidth: "70%",
  padding: "10px",
  borderRadius: "10px",
  backgroundColor: origin === ChatMessageOrigin.ME ? theme.palette.primary.light : theme.palette.grey[300],
  color: origin === ChatMessageOrigin.ME ? theme.palette.primary.contrastText : theme.palette.text.primary,
  position: "relative",
}));

const TimeStamp = styled(Typography)(({ theme }) => ({
  fontSize: "0.75rem",
  color: theme.palette.text.secondary,
  marginTop: "5px",
}));

type ChatMessageProps = {
  chatMessage: IChatMessage;
};

const ChatMessage: React.FC<ChatMessageProps> = ({ chatMessage }) => {
  return (
    <MessageContainer origin={chatMessage.origin} data-testid={DATA_TEST_ID.CHAT_MESSAGE_CONTAINER}>
      <MessageBubble origin={chatMessage.origin}>{chatMessage.message}</MessageBubble>
      <TimeStamp variant="caption">{chatMessage.timestamp.toString()}</TimeStamp>
    </MessageContainer>
  );
};

export default ChatMessage;
