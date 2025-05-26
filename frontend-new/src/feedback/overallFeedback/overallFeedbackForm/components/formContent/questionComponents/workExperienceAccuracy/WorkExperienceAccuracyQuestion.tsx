import React from "react";
import { Box } from "@mui/material";
import { useFeedback } from "src/feedback/overallFeedback/feedbackContext/FeedbackContext";
import QuestionRenderer
  from "src/feedback/overallFeedback/overallFeedbackForm/components/questionsRenderer/QuestionRenderer";
import { FeedbackItem } from "src/feedback/overallFeedback/overallFeedbackService/OverallFeedback.service.types";
import { FeedbackError } from "src/error/commonErrors";
import { WORK_EXPERIENCE_ACCURACY_QUESTION_ID } from "./constants";

;

const uniqueId = "b8cad548-471b-4ec1-8a6f-bbe9028f87b9";

export const DATA_TEST_ID = {
  WORK_EXPERIENCE_ACCURACY: `work-experience-accuracy-${uniqueId}`,
};

interface WorkExperienceAccuracyQuestionProps {
  feedbackItems: FeedbackItem[];
  onChange: (data: FeedbackItem) => void;
}

const WorkExperienceAccuracyQuestion: React.FC<WorkExperienceAccuracyQuestionProps> = ({ feedbackItems, onChange }) => {
  const { questionsConfig, error } = useFeedback();

  if (!questionsConfig) {
    console.error(new FeedbackError("Questions configuration is not available", error));
    return null;
  }

  const question = questionsConfig[WORK_EXPERIENCE_ACCURACY_QUESTION_ID];

  if (!question) {
    console.error(new FeedbackError(`Questions configuration is not available for question: ${WORK_EXPERIENCE_ACCURACY_QUESTION_ID}`, error));
    return null;
  }

  return (
    <Box data-testid={DATA_TEST_ID.WORK_EXPERIENCE_ACCURACY}>
      <QuestionRenderer question={question} feedbackItems={feedbackItems} onChange={onChange} />
    </Box>
  );
};

export default WorkExperienceAccuracyQuestion; 