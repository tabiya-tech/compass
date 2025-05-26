import React from "react";
import { Box } from "@mui/material";
import { useFeedback } from "src/feedback/overallFeedback/context/FeedbackContext";
import QuestionRenderer from "src/feedback/overallFeedback/feedbackForm/components/questionsRenderer/QuestionRenderer";
import { FeedbackItem } from "src/feedback/overallFeedback/overallFeedbackService/OverallFeedback.service.types";
import {
  DetailedQuestion,
  QuestionType,
  YesNoEnum,
} from "src/feedback/overallFeedback/feedbackForm/feedbackForm.types";

const uniqueId = "f60211ff-b133-41e5-9457-bb55d8d6b350";

export const DATA_TEST_ID = {
  PERCEIVED_BIAS: `perceived-bias-${uniqueId}`,
};

interface PerceivedBiasQuestionProps {
  feedbackItems: FeedbackItem[];
  onChange: (data: FeedbackItem) => void;
}

const PerceivedBiasQuestion: React.FC<PerceivedBiasQuestionProps> = ({ feedbackItems, onChange }) => {
  const { questionsConfig } = useFeedback();

  if (!questionsConfig) {
    return null;
  }

  const question: DetailedQuestion = {
    type: QuestionType.YesNo,
    questionId: "perceived_bias",
    questionText: questionsConfig.perceived_bias.question_text,
    showCommentsOn: YesNoEnum.Yes,
    placeholder: questionsConfig.perceived_bias.comment_placeholder,
    description: questionsConfig.perceived_bias.description,
  };

  return (
    <Box data-testid={DATA_TEST_ID.PERCEIVED_BIAS}>
      <QuestionRenderer question={question} feedbackItems={feedbackItems} onChange={onChange} />
    </Box>
  );
};

export default PerceivedBiasQuestion; 