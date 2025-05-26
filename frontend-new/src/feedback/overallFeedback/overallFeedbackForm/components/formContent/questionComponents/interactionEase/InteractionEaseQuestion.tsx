import React from "react";
import { Box } from "@mui/material";
import { useFeedback } from "src/feedback/overallFeedback/feedbackContext/FeedbackContext";
import QuestionRenderer
  from "src/feedback/overallFeedback/overallFeedbackForm/components/questionsRenderer/QuestionRenderer";
import { FeedbackItem } from "src/feedback/overallFeedback/overallFeedbackService/OverallFeedback.service.types";
import { FeedbackError } from "src/error/commonErrors";
import { INTERACTION_EASE_QUESTION_ID } from "./constants";

const uniqueId = "de1e4fe0-25ea-49bc-ad32-8d1d3af27161";

export const DATA_TEST_ID = {
  INTERACTION_EASE: `interaction-ease-${uniqueId}`,
};

interface InteractionEaseQuestionProps {
  feedbackItems: FeedbackItem[];
  onChange: (data: FeedbackItem) => void;
}

const InteractionEaseQuestion: React.FC<InteractionEaseQuestionProps> = ({ feedbackItems, onChange }) => {
  const { questionsConfig, error } = useFeedback();

  if (!questionsConfig) {
    console.error(new FeedbackError("Questions configuration is not available", error));
    return null;
  }

  const question = questionsConfig[INTERACTION_EASE_QUESTION_ID];

  if (!question) {
    console.error(new FeedbackError(`Questions configuration is not available for question: ${INTERACTION_EASE_QUESTION_ID}`, error));
    return null;
  }

  return (
    <Box data-testid={DATA_TEST_ID.INTERACTION_EASE}>
      <QuestionRenderer question={question} feedbackItems={feedbackItems} onChange={onChange} />
    </Box>
  );
};

export default InteractionEaseQuestion; 