import React from "react";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import { Box, Typography, styled, alpha } from "@mui/material";

export interface ChatBubbleProps {
  message: string,
  sender: ConversationMessageSender,
  children?: React.ReactNode,
}

const uniqueId = "6e685eeb-2b54-432a-8b66-8a81633b3981";

export const DATA_TEST_ID = {
  CHAT_MESSAGE_BUBBLE_CONTAINER: `chat-message-bubble-container-${uniqueId}`,
  CHAT_MESSAGE_BUBBLE_MESSAGE_TEXT: `chat-message-bubble-message-text-${uniqueId}`,
  CHAT_MESSAGE_BUBBLE_MESSAGE_FOOTER_CONTAINER: `chat-message-bubble-message-footer-container-${uniqueId}`,
};

const MessageBubble = styled(Box)<{ origin: ConversationMessageSender }>(({ theme, origin }) => ({
  width: "fit-content",
  variants: "outlined",
  wordWrap: "break-word",
  wordBreak: "break-word",
  padding: theme.fixedSpacing(theme.tabiyaSpacing.sm),
  border: origin === ConversationMessageSender.USER ? `2px solid ${theme.palette.primary.light}` : "none",
  borderRadius: origin === ConversationMessageSender.USER ? "12px 0px 12px 12px" : "12px 12px 12px 0px",
  backgroundColor:
    origin === ConversationMessageSender.USER ? alpha(theme.palette.primary.light, 0.16) : theme.palette.grey[100],
  color: origin === ConversationMessageSender.USER ? theme.palette.primary.contrastText : theme.palette.text.primary,
  position: "relative",
  alignSelf: origin === ConversationMessageSender.USER ? "flex-end" : "flex-start",
  display: "flex",
  flexDirection: "column",
}));

const ChatBubble: React.FC<ChatBubbleProps> = ({ message, sender, children }) => {
  return (
    <MessageBubble origin={sender} data-testid={DATA_TEST_ID.CHAT_MESSAGE_BUBBLE_CONTAINER}>
      <Typography whiteSpace="pre-line" data-testid={DATA_TEST_ID.CHAT_MESSAGE_BUBBLE_MESSAGE_TEXT}>{message}</Typography>
      <Box data-testid={DATA_TEST_ID.CHAT_MESSAGE_BUBBLE_MESSAGE_FOOTER_CONTAINER}>
        {children}
      </Box>
    </MessageBubble>
  );
};

export default ChatBubble;
