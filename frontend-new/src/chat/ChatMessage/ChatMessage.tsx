import React from "react";
import { Box, Typography, styled } from "@mui/material";
import { IChatMessage } from "src/chat/Chat.types";
import { getDurationFromNow } from "src/utils/getDurationFromNow";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";

const uniqueId = "2fbaf2ef-9eab-485a-bd28-b4a164e18b06";

export const DATA_TEST_ID = {
  CHAT_MESSAGE_CONTAINER: `chat-message-container-${uniqueId}`,
  CHAT_MESSAGE_TIMESTAMP: `chat-message-sent_at-${uniqueId}`,
};

const MessageContainer = styled(Box)<{ origin: ConversationMessageSender }>(({ theme, origin }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: origin === ConversationMessageSender.USER ? "flex-end" : "flex-start",
  marginBottom: theme.spacing(theme.tabiyaSpacing.sm),
  width: "100%",
}));

const MessageBubble = styled(Box)<{ origin: ConversationMessageSender }>(({ theme, origin }) => ({
  maxWidth: "70%",
  minWidth: "30%",
  variants: "outlined",
  wordWrap: "break-word",
  padding: theme.fixedSpacing(theme.tabiyaSpacing.sm),
  borderRadius: theme.rounding(theme.tabiyaRounding.xs),
  backgroundColor: origin === ConversationMessageSender.USER ? theme.palette.primary.light : theme.palette.grey[200],
  color: origin === ConversationMessageSender.USER ? theme.palette.primary.contrastText : theme.palette.text.primary,
  position: "relative",
  alignSelf: origin === ConversationMessageSender.USER ? "flex-end" : "flex-start",
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
    duration = getDurationFromNow(new Date(chatMessage.sent_at));
  } catch (e) {
    console.error(e);
  }
  return (
    <MessageContainer origin={chatMessage.sender} data-testid={DATA_TEST_ID.CHAT_MESSAGE_CONTAINER}>
      <MessageBubble origin={chatMessage.sender}>{chatMessage.message}</MessageBubble>
      {!isTyping && (
        <TimeStamp data-testid={DATA_TEST_ID.CHAT_MESSAGE_TIMESTAMP} variant="caption">
          sent {duration}
        </TimeStamp>
      )}
    </MessageContainer>
  );
};

export default ChatMessage;
