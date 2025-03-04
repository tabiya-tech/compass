import { useContext, useState } from "react";
import { FeedbackItem, SimplifiedAnswer } from "../../../overallFeedbackService/OverallFeedback.service.types";
import { QuestionType } from "../../feedbackForm.types";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { Backdrop } from "src/theme/Backdrop/Backdrop";
import CustomRating from "src/feedback/overallFeedback/feedbackForm/components/customRating/CustomRating";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";
import questions from "src/feedback/overallFeedback/feedbackForm/questions-en.json";
import OverallFeedbackService from "src/feedback/overallFeedback/overallFeedbackService/OverallFeedback.service";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";

interface CustomerSatisfactionRatingProps {
  notifyOnCustomerSatisfactionRatingSubmitted: () => void;
}

const uniqueId = "67447419-12c3-401d-a78f-00b5ea8f8d1f";

export const DATA_TEST_ID = {
  CUSTOMER_SATISFACTION_RATING_CONTAINER: `customer-satisfaction-rating-container-${uniqueId}`,
};

const CustomerSatisfactionRating: React.FC<CustomerSatisfactionRatingProps> = ({
                                                                                 notifyOnCustomerSatisfactionRatingSubmitted,
                                                                               }) => {
  const { enqueueSnackbar } = useSnackbar();
  const isOnline = useContext(IsOnlineContext);

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
      enqueueSnackbar("Rating Feedback submitted successfully!", { variant: "success" });
    } catch (error) {
      console.error("Feedback submission failed:", error);
      enqueueSnackbar("Failed to submit feedback. Please try again later.", { variant: "error" });
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
        questionId="satisfaction_with_compass"
        questionText={questions["satisfaction_with_compass"].question_text}
        ratingValue={selectedRating}
        notifyChange={(value, comments) =>
          handleInputChange("satisfaction_with_compass", { rating_numeric: value, comment: comments })
        }
        lowRatingLabel="Unsatisfied"
        highRatingLabel="Satisfied"
        maxRating={5}
        disabled={!isOnline || isSubmittingRating}
      />
    </div>
  );
};

export default CustomerSatisfactionRating;
