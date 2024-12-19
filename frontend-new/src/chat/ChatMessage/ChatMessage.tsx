import React from "react";
import { Box, Typography, styled, alpha } from "@mui/material";
import { IChatMessage } from "src/chat/Chat.types";
import { getDurationFromNow } from "src/utils/getDurationFromNow/getDurationFromNow";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import ChatMessageBubbleFooter from "./components/chatMessageBubbleFooter/ChatMessageBubbleFooter";

export enum ChatMessageFooterType {
  FEEDBACK_FORM = "feedback-form",
}

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
  maxWidth: "80%",
  minWidth: "30%",
  variants: "outlined",
  wordWrap: "break-word",
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
  gap: theme.fixedSpacing(theme.tabiyaSpacing.sm),
}));

const TimeStamp = styled(Typography)(({ theme }) => ({
  fontSize: theme.typography.body2.fontSize,
  color: theme.palette.text.secondary,
  marginTop: theme.spacing(theme.tabiyaSpacing.xs),
}));

type ChatMessageProps = {
  chatMessage: IChatMessage;
  notifyOpenFeedbackForm: () => void;
};

const ChatMessage: React.FC<ChatMessageProps> = ({ chatMessage, notifyOpenFeedbackForm }) => {
  let duration;
  try {
    duration = getDurationFromNow(new Date(chatMessage.sent_at));
  } catch (e) {
    console.error(new Error("Failed to get message duration", { cause: e }));
  }
  return (
    <MessageContainer origin={chatMessage.sender} data-testid={DATA_TEST_ID.CHAT_MESSAGE_CONTAINER}>
      <MessageBubble origin={chatMessage.sender}>
        <Typography whiteSpace="pre-line">{chatMessage.message}</Typography>
        {chatMessage.footerType !== undefined && (
          <ChatMessageBubbleFooter
            footerType={chatMessage.footerType}
            notifyOpenFeedbackForm={notifyOpenFeedbackForm}
          />
        )}
      </MessageBubble>
      {!chatMessage.isTypingMessage && (
        <TimeStamp data-testid={DATA_TEST_ID.CHAT_MESSAGE_TIMESTAMP} variant="caption">
          sent {duration}
        </TimeStamp>
      )}
    </MessageContainer>
  );
};

export default ChatMessage;
