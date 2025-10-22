import { useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  QUESTION_KEYS,
  FeedbackItem,
  SimplifiedAnswer,
} from "src/feedback/overallFeedback/overallFeedbackService/OverallFeedback.service.types";
import { QuestionType } from "src/feedback/overallFeedback/feedbackForm/feedbackForm.types";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { Backdrop } from "src/theme/Backdrop/Backdrop";
import CustomRating from "src/feedback/overallFeedback/feedbackForm/components/customRating/CustomRating";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";
import questions from "src/feedback/overallFeedback/feedbackForm/questions-en-gb.json";
import OverallFeedbackService from "src/feedback/overallFeedback/overallFeedbackService/OverallFeedback.service";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { FeedbackError } from "src/error/commonErrors";

interface CustomerSatisfactionRatingProps {
  notifyOnCustomerSatisfactionRatingSubmitted: () => void;
}

const uniqueId = "67447419-12c3-401d-a78f-00b5ea8f8d1f";

export const DATA_TEST_ID = {
  CUSTOMER_SATISFACTION_RATING_CONTAINER: `customer-satisfaction-rating-container-${uniqueId}`,
};

// Provide a flexible typing for questions to allow indexing with our string keys
type QuestionEntry = { question_text: string; description?: string; comment_placeholder?: string; options?: Record<string, string> };
const QUESTIONS = questions as unknown as Record<string, QuestionEntry>;

export const UI_TEXT = {
  // NOTE: These values are kept for backward-compat in tests that import the symbol,
  // but they're no longer used directly. Translations come from i18n at render time.
  CUSTOMER_SATISFACTION_QUESTION_TEXT: "",
  RATING_LABEL_LOW: "",
  RATING_LABEL_HIGH: "",
};
const CustomerSatisfactionRating: React.FC<CustomerSatisfactionRatingProps> = ({
                                                                                 notifyOnCustomerSatisfactionRatingSubmitted,
                                                                               }) => {
  const { enqueueSnackbar } = useSnackbar();
  const isOnline = useContext(IsOnlineContext);
  const { t } = useTranslation();

  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [isSubmittingRating, setIsSubmittingRating] = useState<boolean>(false);

  const handleInputChange = async (questionId: string, value: SimplifiedAnswer) => {
    const formattedData: FeedbackItem = {
      question_id: questionId,
      simplified_answer: value,
    };

    setSelectedRating(value.rating_numeric ?? null);
    setIsSubmittingRating(true);

    try {
      const sessionId = UserPreferencesStateService.getInstance().getActiveSessionId();
      if (sessionId === null) {
        throw new Error("User has no sessions");
      }
      const feedbackService = OverallFeedbackService.getInstance();
      await feedbackService.sendFeedback(sessionId, [formattedData]);

      notifyOnCustomerSatisfactionRatingSubmitted();
      enqueueSnackbar(t("customerSatisfactionRating_submit_success", { defaultValue: "Rating Feedback submitted successfully!" }), { variant: "success" });
    } catch (error) {
      console.error(new FeedbackError("Feedback submission failed:", error));
      enqueueSnackbar(t("customerSatisfactionRating_submit_error", { defaultValue: "Failed to submit feedback. Please try again later." }), { variant: "error" });
    } finally {
      setIsSubmittingRating(false);
      setSelectedRating(null);
    }
  };

  return (
    <div data-testid={DATA_TEST_ID.CUSTOMER_SATISFACTION_RATING_CONTAINER}>
      <Backdrop isShown={isSubmittingRating} />
      <CustomRating
        type={QuestionType.Rating}
        questionId={QUESTION_KEYS.CUSTOMER_SATISFACTION}
        questionText={t("customerSatisfactionRating_question_text", {
          question: QUESTIONS[QUESTION_KEYS.CUSTOMER_SATISFACTION]?.question_text ?? "",
          defaultValue:
            "Finally, we'd love to hear your thoughts on your experience so far! {{question}}",
        })}
        ratingValue={selectedRating}
        notifyChange={(value, comments) =>
          handleInputChange(QUESTION_KEYS.CUSTOMER_SATISFACTION, { rating_numeric: value, comment: comments })
        }
        lowRatingLabel={t("customerSatisfactionRating_rating_label_low", { defaultValue: "Unsatisfied" })}
        highRatingLabel={t("customerSatisfactionRating_rating_label_high", { defaultValue: "Satisfied" })}
        maxRating={5}
        disabled={!isOnline || isSubmittingRating}
      />
    </div>
  );
};

export default CustomerSatisfactionRating;
