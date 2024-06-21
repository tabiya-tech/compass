import React from "react";
import { Box, Typography, styled } from "@mui/material";
import { ChatMessageOrigin, IChatMessage } from "src/chat/Chat.types";

const uniqueId = "2fbaf2ef-9eab-485a-bd28-b4a164e18b06";

export const DATA_TEST_ID = {
  CHAT_MESSAGE_CONTAINER: `chat-message-container-${uniqueId}`,
};

const MessageContainer = styled(Box)<{ origin: ChatMessageOrigin }>(({ theme, origin }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: origin === ChatMessageOrigin.ME ? "flex-end" : "flex-start",
  marginBottom: theme.spacing(theme.tabiyaSpacing.sm),
  width: "100%",
}));

const MessageBubble = styled(Box)<{ origin: ChatMessageOrigin }>(({ theme, origin }) => ({
  maxWidth: "70%",
  padding: theme.spacing(theme.tabiyaSpacing.sm),
  borderRadius: theme.spacing(theme.tabiyaSpacing.sm),
  backgroundColor: origin === ChatMessageOrigin.ME ? theme.palette.primary.light : theme.palette.grey[300],
  color: origin === ChatMessageOrigin.ME ? theme.palette.primary.contrastText : theme.palette.text.primary,
  position: "relative",
  alignSelf: origin === ChatMessageOrigin.ME ? "flex-end" : "flex-start",
}));

const TimeStamp = styled(Typography)(({ theme }) => ({
  fontSize: theme.typography.body2.fontSize,
  color: theme.palette.text.secondary,
  marginTop: theme.spacing(theme.tabiyaSpacing.xs),
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
