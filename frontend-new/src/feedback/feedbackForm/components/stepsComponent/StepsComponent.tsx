import React from "react";
import { Box } from "@mui/material";
import { DetailedQuestion, QuestionType } from "src/feedback/feedbackForm/feedback.types";
import { Answer, FeedbackItem } from "src/feedback/feedbackForm/feedbackFormService/feedbackFormService.types";
import CustomRating from "src/feedback/feedbackForm/components/customRating/CustomRating";
import YesNoQuestion from "src/feedback/feedbackForm/components/yesNoQuestion/YesNoQuestion";
import CheckboxQuestion from "src/feedback/feedbackForm/components/checkboxQuestion/CheckboxQuestion";

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
  const getAnswerByQuestionId = (questionId: string): FeedbackItem["answer"] | undefined => {
    return (feedbackItems || []).find((item: FeedbackItem) => item.question_id === questionId)?.answer;
  };

  const handleInputChange = (questionId: string, value: Answer ) => {
    const formattedData: FeedbackItem = {
      question_id: questionId,
      answer: {
        rating_numeric: value.rating_numeric,
        rating_boolean: value.rating_boolean,
        selected_options: value.selected_options,
        comment: value.comment,
      },
    };
    onChange(formattedData);
  };

  return (
    <Box display="flex" flexDirection="column" gap={theme => theme.tabiyaSpacing.xl}
         data-testid={DATA_TEST_ID.STEPS_COMPONENT}>
      {questions.map((question) => {
        const {
          questionId,
          type,
          questionText,
          options,
          displayRating,
          lowRatingLabel,
          highRatingLabel,
          showCommentsOn,
        } = question;
        const answer = getAnswerByQuestionId(questionId) || {};

        return (
          <Box key={questionId}>
            {type === QuestionType.Checkbox && (
              <CheckboxQuestion
                type={type}
                questionId={questionId}
                questionText={questionText}
                options={options || []}
                selectedOptions={(answer.selected_options || [])}
                notifyChange={(selectedOptions, comments) =>
                  handleInputChange(questionId, { selected_options: selectedOptions, comment: comments })
                }
                comments={answer.comment ?? ""}
              />
            )}
            {type === QuestionType.Rating && (
              <CustomRating
                type={type}
                questionId={questionId}
                questionText={questionText}
                ratingValue={answer.rating_numeric ?? null}
                displayRating={displayRating}
                notifyChange={(value, comments) =>
                  handleInputChange(questionId, { rating_numeric: value, comment: comments })
                }
                lowRatingLabel={lowRatingLabel ?? ""}
                highRatingLabel={highRatingLabel ?? ""}
                comments={answer.comment ?? ""}
              />
            )}
            {type === QuestionType.YesNo && (
              <YesNoQuestion
                type={type}
                questionId={questionId}
                questionText={questionText}
                ratingValue={answer.rating_boolean ?? null}
                notifyChange={(value, comments) =>
                  handleInputChange(questionId, { rating_boolean: value, comment: comments })
                }
                showCommentsOn={showCommentsOn ?? undefined}
                comments={answer.comment ?? ""}
              />
            )}
          </Box>
        );
      })}
    </Box>
  );
};

export default StepsComponent;
