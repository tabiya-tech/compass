import React, { useMemo } from "react";
import { Box } from "@mui/material";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";

interface FeedbackFormButtonProps {
  notifyOnFeedbackFormOpened: () => void;
}

const uniqueId = "41675f8b-257c-4a63-9563-3fe9feb6a850";

export const DATA_TEST_ID = {
  CONVERSATION_CONCLUSION_FOOTER_CONTAINER: `feedback-form-button-container-${uniqueId}`,
  FEEDBACK_FORM_BUTTON: `feedback-form-button-${uniqueId}`,
};

const ConversationConclusionFooter: React.FC<FeedbackFormButtonProps> = ({ notifyOnFeedbackFormOpened }) => {
  const hasSavedFeedback = useMemo(() => {
    const formAnswers = PersistentStorageService.getOverallFeedback();
    return formAnswers.length > 0;
  }, []);

  return (
    <Box display="flex" justifyContent="end" data-testid={DATA_TEST_ID.CONVERSATION_CONCLUSION_FOOTER_CONTAINER}>
      <PrimaryButton
        onClick={notifyOnFeedbackFormOpened}
        disableWhenOffline={true}
        data-testid={DATA_TEST_ID.FEEDBACK_FORM_BUTTON}
      >
        {hasSavedFeedback ? "Continue with feedback" : "Give feedback"}
      </PrimaryButton>
    </Box>
  );
};

export default ConversationConclusionFooter;
