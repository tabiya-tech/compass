import React from "react";
import { Box } from "@mui/material";
import { Question, QuestionType } from "src/feedback/overallFeedback/overallFeedbackForm/overallFeedbackForm.types";
import {
  SimplifiedAnswer,
  FeedbackItem,
} from "src/feedback/overallFeedback/overallFeedbackService/OverallFeedback.service.types";
import CustomRating from "src/feedback/overallFeedback/overallFeedbackForm/components/formContent/questionTypes/customRating/CustomRating";
import YesNoQuestion from "src/feedback/overallFeedback/overallFeedbackForm/components/formContent/questionTypes/yesNoQuestion/YesNoQuestion";
import CheckboxQuestion from "src/feedback/overallFeedback/overallFeedbackForm/components/formContent/questionTypes/checkboxQuestion/CheckboxQuestion";
import { useIsSmallOrShortScreen } from "src/feedback/overallFeedback/overallFeedbackForm/useIsSmallOrShortScreen";

interface QuestionRendererProps {
  question: Question;
  feedbackItems: FeedbackItem[];
  onChange: (data: FeedbackItem) => void;
}

const uniqueId = "3bf900a2-f9fa-4b28-8c20-8bc21570635c";

export const DATA_TEST_ID = {
  QUESTION_RENDERER: `question-renderer-${uniqueId}`,
};

const QuestionRenderer: React.FC<QuestionRendererProps> = ({ question, feedbackItems, onChange }) => {
  const isSmallOrShortScreen = useIsSmallOrShortScreen()

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

  const answer = getAnswerByQuestionId(question.question_id) || {};

  return (
    <Box
      display="flex"
      flexDirection="column"
      gap={(theme) => (isSmallOrShortScreen ? theme.tabiyaSpacing.xl * 3 : theme.tabiyaSpacing.xl * 1.2)}
      data-testid={DATA_TEST_ID.QUESTION_RENDERER}
    >
      <Box key={question.question_id}>
        {question.type === QuestionType.Checkbox && (
          <CheckboxQuestion
            type={question.type}
            question_id={question.question_id}
            question_text={question.question_text}
            description={question.description}
            options={question.options || []}
            selectedOptions={answer.selected_options_keys || []}
            notifyChange={(selectedOptions, comments) =>
              handleInputChange(question.question_id, { selected_options_keys: selectedOptions, comment: comments })
            }
            comments={answer.comment ?? ""}
            comment_placeholder={question.comment_placeholder ?? null}
          />
        )}
        {question.type === QuestionType.Rating && (
          <CustomRating
            type={question.type}
            question_id={question.question_id}
            question_text={question.question_text}
            description={question.description}
            ratingValue={answer.rating_numeric ?? null}
            displayRating={question.display_rating}
            notifyChange={(value, comments) =>
              handleInputChange(question.question_id, { rating_numeric: value, comment: comments })
            }
            lowRatingLabel={question.low_rating_label ?? ""}
            highRatingLabel={question.high_rating_label ?? ""}
            comments={answer.comment ?? ""}
            maxRating={question.max_rating ?? 5}
            comment_placeholder={question.comment_placeholder ?? null}
          />
        )}
        {question.type === QuestionType.YesNo && (
          <YesNoQuestion
            type={question.type}
            question_id={question.question_id}
            question_text={question.question_text}
            description={question.description}
            ratingValue={answer.rating_boolean ?? null}
            notifyChange={(value, comments) =>
              handleInputChange(question.question_id, { rating_boolean: value, comment: comments })
            }
            showCommentsOn={question.show_comments_on ?? undefined}
            comments={answer.comment ?? ""}
            comment_placeholder={question.comment_placeholder ?? null}
          />
        )}
      </Box>
    </Box>
  );
};

export default QuestionRenderer;
