import React from "react";
import { Box } from "@mui/material";
import { useFeedback } from "src/feedback/overallFeedback/feedbackContext/FeedbackContext";
import QuestionRenderer
  from "src/feedback/overallFeedback/overallFeedbackForm/components/questionsRenderer/QuestionRenderer";
import { FeedbackItem } from "src/feedback/overallFeedback/overallFeedbackService/OverallFeedback.service.types";
import { FeedbackError } from "src/error/commonErrors";
import { MISSING_SKILLS_QUESTION_ID } from "./constants";

const uniqueId = "95ccb7e6-350e-4fd1-81d0-96c5b6094ab4";

export const DATA_TEST_ID = {
  MISSING_SKILLS: `missing-skills-${uniqueId}`,
};

interface MissingSkillsQuestionProps {
  feedbackItems: FeedbackItem[];
  onChange: (data: FeedbackItem) => void;
}

const MissingSkillsQuestion: React.FC<MissingSkillsQuestionProps> = ({ feedbackItems, onChange }) => {
  const { questionsConfig,error } = useFeedback();

  if (!questionsConfig) {
    console.error(new FeedbackError("Questions configuration is not available", error));
    return null;
  }

  const question = questionsConfig[MISSING_SKILLS_QUESTION_ID];

  if (!question) {
    console.error(new FeedbackError(`Questions configuration is not available for question: ${MISSING_SKILLS_QUESTION_ID}`, error));
    return null;
  }

  return (
    <Box data-testid={DATA_TEST_ID.MISSING_SKILLS}>
      <QuestionRenderer question={question} feedbackItems={feedbackItems} onChange={onChange} />
    </Box>
  );
};

export default MissingSkillsQuestion; 