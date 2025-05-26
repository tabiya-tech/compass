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

const uniqueId = "f52f579d-4cb6-4674-825d-37612e821e65";

export const DATA_TEST_ID = {
  CLARITY_OF_SKILLS: `clarity-of-skills-${uniqueId}`,
};

interface ClarityOfSkillsQuestionProps {
  feedbackItems: FeedbackItem[];
  onChange: (data: FeedbackItem) => void;
}

const ClarityOfSkillsQuestion: React.FC<ClarityOfSkillsQuestionProps> = ({ feedbackItems, onChange }) => {
  const { questionsConfig } = useFeedback();

  if (!questionsConfig) {
    return null;
  }

  const question: DetailedQuestion = {
    type: QuestionType.YesNo,
    questionId: "clarity_of_skills",
    questionText: questionsConfig.clarity_of_skills.question_text,
    description: questionsConfig.clarity_of_skills.description,
    showCommentsOn: YesNoEnum.No,
    placeholder: questionsConfig.clarity_of_skills.comment_placeholder,
  };

  return (
    <Box data-testid={DATA_TEST_ID.CLARITY_OF_SKILLS}>
      <QuestionRenderer question={question} feedbackItems={feedbackItems} onChange={onChange} />
    </Box>
  );
};

export default ClarityOfSkillsQuestion; 