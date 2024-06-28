import React from "react";
import { Box, Typography, styled } from "@mui/material";
import { ChatMessageOrigin, IChatMessage } from "src/chat/Chat.types";
import { getDurationFromNow } from "src/utils/getDurationFromNow";

const uniqueId = "2fbaf2ef-9eab-485a-bd28-b4a164e18b06";

export const DATA_TEST_ID = {
  CHAT_MESSAGE_CONTAINER: `chat-message-container-${uniqueId}`,
  CHAT_MESSAGE_TIMESTAMP: `chat-message-timestamp-${uniqueId}`,
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
  minWidth: "30%",
  variants: "outlined",
  wordWrap: "break-word",
  padding: theme.fixedSpacing(theme.tabiyaSpacing.sm),
  borderRadius: theme.rounding(theme.tabiyaRounding.xs),
  backgroundColor: origin === ChatMessageOrigin.ME ? theme.palette.primary.light : theme.palette.grey[200],
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
  isTyping: boolean;
};

const ChatMessage: React.FC<ChatMessageProps> = ({ chatMessage, isTyping }) => {
  let duration;
  try {
    duration = getDurationFromNow(new Date(chatMessage.timestamp));
  } catch (e) {
    console.error(e);
  }
  return (
    <MessageContainer origin={chatMessage.origin} data-testid={DATA_TEST_ID.CHAT_MESSAGE_CONTAINER}>
      <MessageBubble origin={chatMessage.origin}>{chatMessage.message}</MessageBubble>
      {!isTyping && (
        <TimeStamp data-testid={DATA_TEST_ID.CHAT_MESSAGE_TIMESTAMP} variant="caption">
          sent {duration}
        </TimeStamp>
      )}
    </MessageContainer>
  );
};

export default ChatMessage;
