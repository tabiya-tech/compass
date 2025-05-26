import React from "react";
import { Box } from "@mui/material";
import { useFeedback } from "src/feedback/overallFeedback/feedbackContext/FeedbackContext";
import QuestionRenderer
  from "src/feedback/overallFeedback/overallFeedbackForm/components/questionsRenderer/QuestionRenderer";
import { FeedbackItem } from "src/feedback/overallFeedback/overallFeedbackService/OverallFeedback.service.types";
import { FeedbackError } from "src/error/commonErrors";
import { RECOMMENDATION_QUESTION_ID } from "./constants";

;

const uniqueId = "3f2595f0-a373-42d7-b410-94d608e7a455";

export const DATA_TEST_ID = {
  RECOMMENDATION: `recommendation-${uniqueId}`,
};

interface RecommendationQuestionProps {
  feedbackItems: FeedbackItem[];
  onChange: (data: FeedbackItem) => void;
}

const RecommendationQuestion: React.FC<RecommendationQuestionProps> = ({ feedbackItems, onChange }) => {
  const { questionsConfig, error } = useFeedback();

  if (!questionsConfig) {
    console.error(new FeedbackError("Questions configuration is not available", error));
    return null;
  }

  const question = questionsConfig[RECOMMENDATION_QUESTION_ID];

  if (!question) {
    console.error(new FeedbackError(`Questions configuration is not available for question: ${RECOMMENDATION_QUESTION_ID}`, error));
    return null;
  }

  return (
    <Box data-testid={DATA_TEST_ID.RECOMMENDATION}>
      <QuestionRenderer question={question} feedbackItems={feedbackItems} onChange={onChange} />
    </Box>
  );
};

export default RecommendationQuestion; 