import React from "react";
import { Box, Typography, useTheme } from "@mui/material";
import CustomLink from "src/theme/CustomLink/CustomLink";
import { FIXED_MESSAGES_TEXT } from "src/chat/util";

interface FeedbackFormButtonProps {
  notifyOnFeedbackFormOpen: () => void;
  notifyOnExperiencesDrawerOpen: () => void;
  isFeedbackSubmitted: boolean;
  isFeedbackStarted: boolean;
}

const uniqueId = "41675f8b-257c-4a63-9563-3fe9feb6a850";

export const DATA_TEST_ID = {
  CONVERSATION_CONCLUSION_FOOTER_CONTAINER: `feedback-form-button-container-${uniqueId}`,
  FEEDBACK_FORM_BUTTON: `feedback-form-button-${uniqueId}`,
  EXPERIENCES_DRAWER_BUTTON: `feedback-form-experiences-drawer-button-${uniqueId}`,
  FEEDBACK_IN_PROGRESS_BUTTON: `feedback-in-progress-button-${uniqueId}`,
  FEEDBACK_MESSAGE_TEXT: `feedback-message-text-${uniqueId}`,
  FEEDBACK_IN_PROGRESS_MESSAGE: `feedback-in-progress-message-${uniqueId}`,
  THANK_YOU_MESSAGE: `thank-you-message-${uniqueId}`,
};

const ConversationConclusionFooter: React.FC<FeedbackFormButtonProps> = ({
  notifyOnFeedbackFormOpen,
  notifyOnExperiencesDrawerOpen,
  isFeedbackSubmitted,
  isFeedbackStarted,
}) => {
  const theme = useTheme();

  let feedbackMessage;
  if (isFeedbackSubmitted) {
    feedbackMessage = (
      <Typography variant="body1" data-testid={DATA_TEST_ID.THANK_YOU_MESSAGE}>
        {FIXED_MESSAGES_TEXT.THANK_YOU}
      </Typography>
    );
  } else if (isFeedbackStarted) {
    feedbackMessage = (
      <Typography variant="body1" data-testid={DATA_TEST_ID.FEEDBACK_IN_PROGRESS_MESSAGE}>
        Please{" "}
        <CustomLink onClick={notifyOnFeedbackFormOpen} data-testid={DATA_TEST_ID.FEEDBACK_IN_PROGRESS_BUTTON}>
          complete your feedback
        </CustomLink>{" "}
        to help us improve your experience!
      </Typography>
    );
  } else {
    feedbackMessage = (
      <Typography variant="body1" data-testid={DATA_TEST_ID.FEEDBACK_MESSAGE_TEXT}>
        We'd love your{" "}
        <CustomLink onClick={notifyOnFeedbackFormOpen} data-testid={DATA_TEST_ID.FEEDBACK_FORM_BUTTON}>
          feedback
        </CustomLink>{" "}
        on this chat. It only takes 5 minutes and helps us improve!
      </Typography>
    );
  }

  return (
    <Box
      display="flex"
      flexDirection="column"
      justifyContent="start"
      gap={theme.fixedSpacing(theme.tabiyaSpacing.md)}
      marginTop={theme.fixedSpacing(theme.tabiyaSpacing.md)}
      data-testid={DATA_TEST_ID.CONVERSATION_CONCLUSION_FOOTER_CONTAINER}
    >
      <Typography variant="body1">
        Don't forget to{" "}
        <CustomLink onClick={notifyOnExperiencesDrawerOpen} data-testid={DATA_TEST_ID.EXPERIENCES_DRAWER_BUTTON}>
          <span style={{ whiteSpace: "normal" }}>view and download your CV</span>
        </CustomLink>
        !
      </Typography>

      {feedbackMessage}
    </Box>
  );
};

export default ConversationConclusionFooter;
