import React from "react";
import { Box } from "@mui/material";
import { useFeedback } from "src/feedback/overallFeedback/feedbackContext/FeedbackContext";
import QuestionRenderer
  from "src/feedback/overallFeedback/overallFeedbackForm/components/questionsRenderer/QuestionRenderer";
import { FeedbackItem } from "src/feedback/overallFeedback/overallFeedbackService/OverallFeedback.service.types";
import { FeedbackError } from "src/error/commonErrors";
import { ADDITIONAL_FEEDBACK_QUESTION_ID } from "./constants";

const uniqueId = "5d5def55-b805-4ef6-84cd-e0388d0e7cca";

export const DATA_TEST_ID = {
  ADDITIONAL_FEEDBACK: `additional-feedback-${uniqueId}`,
};

interface AdditionalFeedbackQuestionProps {
  feedbackItems: FeedbackItem[];
  onChange: (data: FeedbackItem) => void;
}

const AdditionalFeedbackQuestion: React.FC<AdditionalFeedbackQuestionProps> = ({ feedbackItems, onChange }) => {
  const { questionsConfig, error } = useFeedback();

  if (!questionsConfig) {
    console.error(new FeedbackError("Questions configuration is not available", error));
    return null;
  }

  const question = questionsConfig[ADDITIONAL_FEEDBACK_QUESTION_ID];

  if (!question) {
    console.error(new FeedbackError(`Questions configuration is not available for question: ${ADDITIONAL_FEEDBACK_QUESTION_ID}`, error));
    return null;
  }

  return (
    <Box data-testid={DATA_TEST_ID.ADDITIONAL_FEEDBACK}>
      <QuestionRenderer question={question} feedbackItems={feedbackItems} onChange={onChange} />
    </Box>
  );
};

export default AdditionalFeedbackQuestion; 