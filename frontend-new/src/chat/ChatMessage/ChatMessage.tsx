import React from "react";
import { Box, Typography, styled, alpha, Divider, useTheme } from "@mui/material";
import { IChatMessage } from "src/chat/Chat.types";
import { getDurationFromNow } from "src/utils/getDurationFromNow/getDurationFromNow";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import FeedbackFormButton from "src/feedback/overallFeedback/feedbackForm/components/feedbackFormButton/FeedbackFormButton";

export enum ChatMessageFooterType {
  FEEDBACK_FORM_BUTTON = "feedback-form-button",
}

const uniqueId = "2fbaf2ef-9eab-485a-bd28-b4a164e18b06";

export const DATA_TEST_ID = {
  CHAT_MESSAGE_CONTAINER: `chat-message-container-${uniqueId}`,
  CHAT_MESSAGE_TIMESTAMP: `chat-message-sent_at-${uniqueId}`,
  CHAT_MESSAGE_FOOTER_DIVIDER: `chat-message-footer-divider-${uniqueId}`,
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
  const theme = useTheme();

  let duration;
  try {
    duration = getDurationFromNow(new Date(chatMessage.sent_at));
  } catch (e) {
    console.error(new Error("Failed to get message duration", { cause: e }));
  }
  const getFooterFromType = (type: ChatMessageFooterType) => {
    switch (type) {
      case ChatMessageFooterType.FEEDBACK_FORM_BUTTON:
        return <FeedbackFormButton notifyOpenFeedbackForm={notifyOpenFeedbackForm} />;
      default:
        return null;
    }
  };
  return (
    <MessageContainer origin={chatMessage.sender} data-testid={DATA_TEST_ID.CHAT_MESSAGE_CONTAINER}>
      <MessageBubble origin={chatMessage.sender}>
        <Typography whiteSpace="pre-line">{chatMessage.message}</Typography>
        {chatMessage.footerType !== undefined && (
          <Divider
            color={theme.palette.grey[100]}
            sx={{ marginY: theme.spacing(1) }}
            data-testid={DATA_TEST_ID.CHAT_MESSAGE_FOOTER_DIVIDER}
          />
        )}
        {chatMessage.footerType !== undefined && getFooterFromType(chatMessage.footerType)}
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
