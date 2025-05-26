import React from "react";
import { Box } from "@mui/material";
import { useFeedback } from "src/feedback/overallFeedback/context/FeedbackContext";
import QuestionRenderer from "src/feedback/overallFeedback/feedbackForm/components/questionsRenderer/QuestionRenderer";
import { FeedbackItem } from "src/feedback/overallFeedback/overallFeedbackService/OverallFeedback.service.types";
import { DetailedQuestion, QuestionType } from "src/feedback/overallFeedback/feedbackForm/feedbackForm.types";

const uniqueId = "5d5def55-b805-4ef6-84cd-e0388d0e7cca";

export const DATA_TEST_ID = {
  ADDITIONAL_FEEDBACK: `additional-feedback-${uniqueId}`,
};

interface AdditionalFeedbackQuestionProps {
  feedbackItems: FeedbackItem[];
  onChange: (data: FeedbackItem) => void;
}

const AdditionalFeedbackQuestion: React.FC<AdditionalFeedbackQuestionProps> = ({ feedbackItems, onChange }) => {
  const { questionsConfig } = useFeedback();

  if (!questionsConfig) {
    return null;
  }

  const question: DetailedQuestion = {
    type: QuestionType.Rating,
    questionId: "additional_feedback",
    questionText: questionsConfig.additional_feedback.question_text,
    displayRating: false,
    description: questionsConfig.additional_feedback.description,
    placeholder: questionsConfig.additional_feedback.comment_placeholder,
  };

  return (
    <Box data-testid={DATA_TEST_ID.ADDITIONAL_FEEDBACK}>
      <QuestionRenderer question={question} feedbackItems={feedbackItems} onChange={onChange} />
    </Box>
  );
};

export default AdditionalFeedbackQuestion; 