import React from "react";
import { Box } from "@mui/material";
import { useFeedback } from "src/feedback/overallFeedback/context/FeedbackContext";
import QuestionRenderer from "src/feedback/overallFeedback/feedbackForm/components/questionsRenderer/QuestionRenderer";
import { FeedbackItem } from "src/feedback/overallFeedback/overallFeedbackService/OverallFeedback.service.types";
import { DetailedQuestion, QuestionType } from "src/feedback/overallFeedback/feedbackForm/feedbackForm.types";

const uniqueId = "b8cad548-471b-4ec1-8a6f-bbe9028f87b9";

export const DATA_TEST_ID = {
  WORK_EXPERIENCE_ACCURACY: `work-experience-accuracy-${uniqueId}`,
};

interface WorkExperienceAccuracyQuestionProps {
  feedbackItems: FeedbackItem[];
  onChange: (data: FeedbackItem) => void;
}

const WorkExperienceAccuracyQuestion: React.FC<WorkExperienceAccuracyQuestionProps> = ({ feedbackItems, onChange }) => {
  const { questionsConfig } = useFeedback();

  if (!questionsConfig) {
    return null;
  }

  const workExperienceQuestion = questionsConfig.work_experience_accuracy;
  if (workExperienceQuestion.type !== QuestionType.Checkbox) {
    return null;
  }

  const question: DetailedQuestion = {
    type: QuestionType.Checkbox,
    questionId: "work_experience_accuracy",
    questionText: workExperienceQuestion.question_text,
    options: Object.entries(workExperienceQuestion.options).map(([key, value]) => ({
      key,
      value
    })),
    lowRatingLabel: "Inaccurate",
    highRatingLabel: "Very accurate",
    placeholder: workExperienceQuestion.comment_placeholder,
    description: workExperienceQuestion.description,
  };

  return (
    <Box data-testid={DATA_TEST_ID.WORK_EXPERIENCE_ACCURACY}>
      <QuestionRenderer question={question} feedbackItems={feedbackItems} onChange={onChange} />
    </Box>
  );
};

export default WorkExperienceAccuracyQuestion; 