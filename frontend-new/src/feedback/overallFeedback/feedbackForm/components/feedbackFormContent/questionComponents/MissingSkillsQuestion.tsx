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

const uniqueId = "95ccb7e6-350e-4fd1-81d0-96c5b6094ab4";

export const DATA_TEST_ID = {
  MISSING_SKILLS: `missing-skills-${uniqueId}`,
};

interface MissingSkillsQuestionProps {
  feedbackItems: FeedbackItem[];
  onChange: (data: FeedbackItem) => void;
}

const MissingSkillsQuestion: React.FC<MissingSkillsQuestionProps> = ({ feedbackItems, onChange }) => {
  const { questionsConfig } = useFeedback();

  if (!questionsConfig) {
    return null;
  }

  const question: DetailedQuestion = {
    type: QuestionType.YesNo,
    questionId: "missing_skills",
    questionText: questionsConfig.missing_skills.question_text,
    showCommentsOn: YesNoEnum.Yes,
    placeholder: questionsConfig.missing_skills.comment_placeholder,
    description: questionsConfig.missing_skills.description,
  };

  return (
    <Box data-testid={DATA_TEST_ID.MISSING_SKILLS}>
      <QuestionRenderer question={question} feedbackItems={feedbackItems} onChange={onChange} />
    </Box>
  );
};

export default MissingSkillsQuestion; 