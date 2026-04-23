import React from "react";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import { Box, Typography, styled } from "@mui/material";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export interface ChatBubbleProps {
  message: string | React.ReactNode;
  sender: ConversationMessageSender;
  children?: React.ReactNode;
  fillColor?: string;
}

const uniqueId = "6e685eeb-2b54-432a-8b66-8a81633b3981";

export const DATA_TEST_ID = {
  CHAT_MESSAGE_BUBBLE_CONTAINER: `chat-message-bubble-container-${uniqueId}`,
  CHAT_MESSAGE_BUBBLE_MESSAGE_TEXT: `chat-message-bubble-message-text-${uniqueId}`,
  CHAT_MESSAGE_BUBBLE_MESSAGE_FOOTER_CONTAINER: `chat-message-bubble-message-footer-container-${uniqueId}`,
};

type MessageBubbleProps = {
  origin: ConversationMessageSender;
  fillColor?: string;
};
const MessageBubble = styled(Box, {
  shouldForwardProp: (prop) => prop !== "fillColor" && prop !== "origin",
})<MessageBubbleProps>(({ theme, origin, fillColor = "transparent" }) => ({
  width: "fit-content",
  variants: "outlined",
  wordWrap: "break-word",
  wordBreak: "break-word",
  padding: theme.fixedSpacing(theme.tabiyaSpacing.sm),
  border: origin === ConversationMessageSender.USER ? `2px solid ${fillColor}` : "none",
  borderRadius: origin === ConversationMessageSender.USER ? "12px 12px 0 12px" : "0 0 0 0",
  backgroundColor: origin === ConversationMessageSender.USER ? fillColor : "transparent",
  color: origin === ConversationMessageSender.USER ? "#FFF" : theme.palette.text.primary,
  position: "relative",
  alignSelf: origin === ConversationMessageSender.USER ? "flex-end" : "flex-start",
  display: "flex",
  flexDirection: "column",
  // Markdown styles for AI chat messages
  "& p": { margin: 0 },
  "& strong": { fontWeight: 700 },
  "& em": { fontStyle: "italic" },
  "& ul, & ol": { paddingLeft: theme.fixedSpacing(theme.tabiyaSpacing.md), margin: 0 },
  "& li": { marginBottom: theme.fixedSpacing(theme.tabiyaSpacing.xxs) },
  // Override browser defaults for code blocks so that agent responses should never render as monospace
  "& code": { fontFamily: "inherit", whiteSpace: "pre-wrap", wordBreak: "break-word" },
  // fontFamily must be set on pre itself — code inside pre would otherwise inherit monospace from pre
  "& pre": {
    fontFamily: "inherit",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    overflowWrap: "break-word",
    margin: 0,
  },
}));

const ChatBubble: React.FC<ChatBubbleProps> = ({ message, sender, children, fillColor }) => {
  const isCompassMessage = sender === ConversationMessageSender.COMPASS && typeof message === "string";

  return (
    <MessageBubble origin={sender} data-testid={DATA_TEST_ID.CHAT_MESSAGE_BUBBLE_CONTAINER} fillColor={fillColor}>
      <Box
        whiteSpace="pre-wrap"
        data-testid={DATA_TEST_ID.CHAT_MESSAGE_BUBBLE_MESSAGE_TEXT}
        color={sender === ConversationMessageSender.USER ? "#FFF" : undefined}
      >
        {isCompassMessage ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message as string}</ReactMarkdown>
        ) : (
          <Typography whiteSpace="pre-line" color={sender === ConversationMessageSender.USER ? "#FFF" : undefined}>
            {message}
          </Typography>
        )}
      </Box>
      <Box data-testid={DATA_TEST_ID.CHAT_MESSAGE_BUBBLE_MESSAGE_FOOTER_CONTAINER}>{children}</Box>
    </MessageBubble>
  );
};

export default ChatBubble;
