import React from "react";
import { Box } from "@mui/material";
import { useFeedback } from "src/feedback/overallFeedback/context/FeedbackContext";
import QuestionRenderer from "src/feedback/overallFeedback/feedbackForm/components/questionsRenderer/QuestionRenderer";
import { FeedbackItem } from "src/feedback/overallFeedback/overallFeedbackService/OverallFeedback.service.types";
import { DetailedQuestion, QuestionType } from "src/feedback/overallFeedback/feedbackForm/feedbackForm.types";

const uniqueId = "3f2595f0-a373-42d7-b410-94d608e7a455";

export const DATA_TEST_ID = {
  RECOMMENDATION: `recommendation-${uniqueId}`,
};

interface RecommendationQuestionProps {
  feedbackItems: FeedbackItem[];
  onChange: (data: FeedbackItem) => void;
}

const RecommendationQuestion: React.FC<RecommendationQuestionProps> = ({ feedbackItems, onChange }) => {
  const { questionsConfig } = useFeedback();

  if (!questionsConfig) {
    return null;
  }

  const question: DetailedQuestion = {
    type: QuestionType.Rating,
    questionId: "recommendation",
    questionText: questionsConfig.recommendation.question_text,
    lowRatingLabel: "Unlikely",
    highRatingLabel: "Likely",
    maxRating: 5,
    description: questionsConfig.recommendation.description,
  };

  return (
    <Box data-testid={DATA_TEST_ID.RECOMMENDATION}>
      <QuestionRenderer question={question} feedbackItems={feedbackItems} onChange={onChange} />
    </Box>
  );
};

export default RecommendationQuestion; 