import React from "react";
import { Box, useMediaQuery, useTheme } from "@mui/material";
import { DetailedQuestion, QuestionType } from "src/feedback/overallFeedback/feedbackForm/feedbackForm.types";
import {
  SimplifiedAnswer,
  FeedbackItem,
} from "src/feedback/overallFeedback/overallFeedbackService/OverallFeedback.service.types";
import CustomRating from "src/feedback/overallFeedback/feedbackForm/components/customRating/CustomRating";
import YesNoQuestion from "src/feedback/overallFeedback/feedbackForm/components/yesNoQuestion/YesNoQuestion";
import CheckboxQuestion from "src/feedback/overallFeedback/feedbackForm/components/checkboxQuestion/CheckboxQuestion";

interface StepProps {
  questions: DetailedQuestion[];
  feedbackItems: FeedbackItem[];
  onChange: (data: FeedbackItem) => void;
}

const uniqueId = "3bf900a2-f9fa-4b28-8c20-8bc21570635c";

export const DATA_TEST_ID = {
  STEPS_COMPONENT: `steps-component-${uniqueId}`,
};

const StepsComponent: React.FC<StepProps> = ({ questions, feedbackItems, onChange }) => {
  const theme = useTheme();
  const isSmallMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const getAnswerByQuestionId = (questionId: string): SimplifiedAnswer | undefined => {
    return feedbackItems.find((item: FeedbackItem) => item.question_id === questionId)?.simplified_answer;
  };

  const handleInputChange = (questionId: string, value: SimplifiedAnswer) => {
    const formattedData: FeedbackItem = {
      question_id: questionId,
      simplified_answer: value,
    };
    onChange(formattedData);
  };

  return (
    <Box
      display="flex"
      flexDirection="column"
      gap={(theme) => (isSmallMobile ? theme.tabiyaSpacing.xl * 3 : theme.tabiyaSpacing.xl * 1.2)}
      data-testid={DATA_TEST_ID.STEPS_COMPONENT}
    >
      {questions.map((question) => {
        const answer = getAnswerByQuestionId(question.questionId) || {};

        return (
          <Box key={question.questionId}>
            {question.type === QuestionType.Checkbox && (
              <CheckboxQuestion
                type={question.type}
                questionId={question.questionId}
                questionText={question.questionText}
                options={question.options || []}
                selectedOptions={answer.selected_options_keys || []}
                notifyChange={(selectedOptions, comments) =>
                  handleInputChange(question.questionId, { selected_options_keys: selectedOptions, comment: comments })
                }
                comments={answer.comment ?? ""}
                placeholder={question.placeholder}
              />
            )}
            {question.type === QuestionType.Rating && (
              <CustomRating
                type={question.type}
                questionId={question.questionId}
                questionText={question.questionText}
                ratingValue={answer.rating_numeric ?? null}
                displayRating={question.displayRating}
                notifyChange={(value, comments) =>
                  handleInputChange(question.questionId, { rating_numeric: value, comment: comments })
                }
                lowRatingLabel={question.lowRatingLabel ?? ""}
                highRatingLabel={question.highRatingLabel ?? ""}
                comments={answer.comment ?? ""}
                maxRating={question.maxRating ?? 5}
                placeholder={question.placeholder}
              />
            )}
            {question.type === QuestionType.YesNo && (
              <YesNoQuestion
                type={question.type}
                questionId={question.questionId}
                questionText={question.questionText}
                ratingValue={answer.rating_boolean ?? null}
                notifyChange={(value, comments) =>
                  handleInputChange(question.questionId, { rating_boolean: value, comment: comments })
                }
                showCommentsOn={question.showCommentsOn ?? undefined}
                comments={answer.comment ?? ""}
                placeholder={question.placeholder}
              />
            )}
          </Box>
        );
      })}
    </Box>
  );
};

export default StepsComponent;
