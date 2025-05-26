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

const uniqueId = "dcf60100-613f-4b8e-84a1-42b7ba8b806c";

export const DATA_TEST_ID = {
  INCORRECT_SKILLS: `incorrect-skills-${uniqueId}`,
};

interface IncorrectSkillsQuestionProps {
  feedbackItems: FeedbackItem[];
  onChange: (data: FeedbackItem) => void;
}

const IncorrectSkillsQuestion: React.FC<IncorrectSkillsQuestionProps> = ({ feedbackItems, onChange }) => {
  const { questionsConfig } = useFeedback();

  if (!questionsConfig) {
    return null;
  }

  const question: DetailedQuestion = {
    type: QuestionType.YesNo,
    questionId: "incorrect_skills",
    questionText: questionsConfig.incorrect_skills.question_text,
    description: questionsConfig.incorrect_skills.description,
    showCommentsOn: YesNoEnum.Yes,
    placeholder: questionsConfig.incorrect_skills.comment_placeholder,
  };

  return (
    <Box data-testid={DATA_TEST_ID.INCORRECT_SKILLS}>
      <QuestionRenderer question={question} feedbackItems={feedbackItems} onChange={onChange} />
    </Box>
  );
};

export default IncorrectSkillsQuestion; 