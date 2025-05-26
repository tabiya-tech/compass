import React from "react";
import { Box } from "@mui/material";
import { useFeedback } from "src/feedback/overallFeedback/context/FeedbackContext";
import QuestionRenderer from "src/feedback/overallFeedback/feedbackForm/components/questionsRenderer/QuestionRenderer";
import { FeedbackItem } from "src/feedback/overallFeedback/overallFeedbackService/OverallFeedback.service.types";
import { DetailedQuestion, QuestionType } from "src/feedback/overallFeedback/feedbackForm/feedbackForm.types";

const uniqueId = "de1e4fe0-25ea-49bc-ad32-8d1d3af27161";

export const DATA_TEST_ID = {
  INTERACTION_EASE: `interaction-ease-${uniqueId}`,
};

interface InteractionEaseQuestionProps {
  feedbackItems: FeedbackItem[];
  onChange: (data: FeedbackItem) => void;
}

const InteractionEaseQuestion: React.FC<InteractionEaseQuestionProps> = ({ feedbackItems, onChange }) => {
  const { questionsConfig } = useFeedback();

  if (!questionsConfig) {
    return null;
  }

  const question: DetailedQuestion = {
    type: QuestionType.Rating,
    questionId: "interaction_ease",
    questionText: questionsConfig.interaction_ease.question_text,
    lowRatingLabel: "Difficult",
    highRatingLabel: "Easy",
    maxRating: 5,
    placeholder: questionsConfig.interaction_ease.comment_placeholder,
    description: questionsConfig.interaction_ease.description,
  };

  return (
    <Box data-testid={DATA_TEST_ID.INTERACTION_EASE}>
      <QuestionRenderer question={question} feedbackItems={feedbackItems} onChange={onChange} />
    </Box>
  );
};

export default InteractionEaseQuestion; 