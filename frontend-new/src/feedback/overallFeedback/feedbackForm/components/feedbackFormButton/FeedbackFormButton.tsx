import React, { useMemo } from "react";
import { Box } from "@mui/material";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import {
  FEEDBACK_FORM_ANSWERS_KEY,
  STORAGE,
} from "src/feedback/overallFeedback/feedbackForm/components/feedbackFormContent/FeedbackFormContent";

interface FeedbackFormButtonProps {
  notifyOpenFeedbackForm: () => void;
}

const uniqueId = "41675f8b-257c-4a63-9563-3fe9feb6a850";

export const DATA_TEST_ID = {
  FEEDBACK_FORM_BUTTON_CONTAINER: `feedback-form-button-container-${uniqueId}`,
  FEEDBACK_FORM_BUTTON: `feedback-form-button-${uniqueId}`,
};

const FeedbackFormButton: React.FC<FeedbackFormButtonProps> = ({ notifyOpenFeedbackForm }) => {
  const hasSavedFeedback = useMemo(() => {
    const formAnswers = PersistentStorageService.getItem(STORAGE, FEEDBACK_FORM_ANSWERS_KEY);
    return !!formAnswers;
  }, []);

  return (
    <Box display="flex" justifyContent="end" data-testid={DATA_TEST_ID.FEEDBACK_FORM_BUTTON_CONTAINER}>
      <PrimaryButton
        onClick={notifyOpenFeedbackForm}
        disableWhenOffline={true}
        data-testid={DATA_TEST_ID.FEEDBACK_FORM_BUTTON}
      >
        {hasSavedFeedback ? "Continue with feedback" : "Give feedback"}
      </PrimaryButton>
    </Box>
  );
};

export default FeedbackFormButton;
