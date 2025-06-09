import React from "react";
import { Box } from "@mui/material";
import { useFeedback } from "src/feedback/overallFeedback/feedbackContext/FeedbackContext";
import QuestionRenderer
  from "src/feedback/overallFeedback/overallFeedbackForm/components/questionsRenderer/QuestionRenderer";
import { FeedbackItem } from "src/feedback/overallFeedback/overallFeedbackService/OverallFeedback.service.types";
import { FeedbackError } from "src/error/commonErrors";
import { CLARITY_OF_SKILLS_QUESTION_ID } from "./constants";

;

const uniqueId = "f52f579d-4cb6-4674-825d-37612e821e65";

export const DATA_TEST_ID = {
  CLARITY_OF_SKILLS: `clarity-of-skills-${uniqueId}`,
};

interface ClarityOfSkillsQuestionProps {
  feedbackItems: FeedbackItem[];
  onChange: (data: FeedbackItem) => void;
}

const ClarityOfSkillsQuestion: React.FC<ClarityOfSkillsQuestionProps> = ({ feedbackItems, onChange }) => {
  const { questionsConfig, error } = useFeedback();

  if (!questionsConfig || error) {
    console.error(new FeedbackError("Questions configuration is not available", error));
    return null;
  }

  const question = questionsConfig[CLARITY_OF_SKILLS_QUESTION_ID];

  if (!question) {
    console.error(new FeedbackError(`Questions configuration is not available for question: ${CLARITY_OF_SKILLS_QUESTION_ID}`, error));
    return null;
  }

  return (
    <Box data-testid={DATA_TEST_ID.CLARITY_OF_SKILLS}>
      <QuestionRenderer question={question} feedbackItems={feedbackItems} onChange={onChange} />
    </Box>
  );
};

export default ClarityOfSkillsQuestion; 