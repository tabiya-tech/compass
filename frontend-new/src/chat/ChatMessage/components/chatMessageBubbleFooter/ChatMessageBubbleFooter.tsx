import React from "react";
import { Box, Divider, useTheme } from "@mui/material";
import FeedbackFormFooter from "src/feedback/feedbackForm/components/feedbackFormButton/FeedbackFormFooter";
import { ChatMessageFooterType } from "../../ChatMessage";

const uniqueId = "e4f89c2a-8c7d-4a3b-9f1c-d5c9e8f6b3a2";

export const DATA_TEST_ID = {
  CHAT_MESSAGE_BUBBLE_FOOTER: `chat-message-bubble-footer-${uniqueId}`,
  CHAT_MESSAGE_BUBBLE_FOOTER_DIVIDER: `chat-message-bubble-footer-divider-${uniqueId}`,
};

interface Props {
  footerType: ChatMessageFooterType;
  notifyOpenFeedbackForm: () => void;
}

const ChatMessageBubbleFooter: React.FC<Props> = ({ footerType, notifyOpenFeedbackForm }) => {
  const theme = useTheme();

  const getFooterFromType = (type: ChatMessageFooterType) => {
    switch (type) {
      case ChatMessageFooterType.FEEDBACK_FORM:
        return <FeedbackFormFooter notifyOpenFeedbackForm={notifyOpenFeedbackForm} />;
      default:
        return null;
    }
  };

  return (
    <Box
      data-testid={DATA_TEST_ID.CHAT_MESSAGE_BUBBLE_FOOTER}
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: theme.fixedSpacing(theme.tabiyaSpacing.xs),
        width: "100%",
      }}
    >
      <Divider data-testid={DATA_TEST_ID.CHAT_MESSAGE_BUBBLE_FOOTER_DIVIDER} />
      {getFooterFromType(footerType)}
    </Box>
  );
};

export default ChatMessageBubbleFooter;
