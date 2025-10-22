// mute the console
import "src/_test_utilities/consoleMock";

import React from "react";
import { render, screen, act, waitFor} from "src/_test_utilities/test-utils";
import CustomerSatisfactionRating, { DATA_TEST_ID } from "./CustomerSatisfaction";
import CustomRating, { DATA_TEST_ID as CUSTOM_RATING_DATA_TEST_ID } from "src/feedback/overallFeedback/feedbackForm/components/customRating/CustomRating";
import { DATA_TEST_ID as BACKDROP_DATA_TEST_ID } from "src/theme/Backdrop/Backdrop";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import OverallFeedbackService from "src/feedback/overallFeedback/overallFeedbackService/OverallFeedback.service";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import {
  Language,
  SensitivePersonalDataRequirement,
  UserPreference,
} from "src/userPreferences/UserPreferencesService/userPreferences.types";
import { mockBrowserIsOnLine } from "src/_test_utilities/mockBrowserIsOnline";
import { resetAllMethodMocks } from "src/_test_utilities/resetAllMethodMocks";
import { FeedbackResponse, QUESTION_KEYS } from "src/feedback/overallFeedback/overallFeedbackService/OverallFeedback.service.types";
import { QuestionType } from "src/feedback/overallFeedback/feedbackForm/feedbackForm.types";
import i18n from "src/i18n/i18n";
import questions from "src/feedback/overallFeedback/feedbackForm/questions-en-gb.json";

// mock the snackbar provider
jest.mock("src/theme/SnackbarProvider/SnackbarProvider", () => {
  const actual = jest.requireActual("src/theme/SnackbarProvider/SnackbarProvider");
  return {
    ...actual,
    __esModule: true,
    useSnackbar: jest.fn().mockReturnValue({
      enqueueSnackbar: jest.fn(),
      closeSnackbar: jest.fn(),
    }),
  };
});

// mock the custom rating component
jest.mock("src/feedback/overallFeedback/feedbackForm/components/customRating/CustomRating", () => {
  const actual = jest.requireActual("src/feedback/overallFeedback/feedbackForm/components/customRating/CustomRating");
  return {
    ...actual,
    __esModule: true,
    default: jest.fn(() => <div data-testid={actual.DATA_TEST_ID.CUSTOM_RATING_CONTAINER} />),
  };
});

const mockUserPreferences: UserPreference = {
  sessions: [123],
  user_id: "test-user",
  language: Language.en,
  user_feedback_answered_questions: {},
  sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
  has_sensitive_personal_data: false,
  accepted_tc: new Date(),
  experiments: {},
};

const mockFeedbackResponse: FeedbackResponse = {
  id: "foo",
  version: {
    frontend: "foo-frontend",
    backend: "foo-backend",
  },
  feedback_items: [{
    question_id: "foo-question_id",
    simplified_answer: {
      rating_numeric: 5,
    },
  }],
  created_at: new Date().toISOString(),
};

describe("CustomerSatisfactionRating", () => {

  beforeEach(() => {
    jest.clearAllMocks();
    mockBrowserIsOnLine(true);

    UserPreferencesStateService.getInstance().clearUserPreferences();
    // Reset all method mocks on the singletons that may have been mocked
    // As a good practice, we should the mock*Once() methods to avoid side effects between tests
    // As a precaution, we reset all method mocks to ensure that no side effects are carried over between tests
    resetAllMethodMocks(OverallFeedbackService.getInstance());
  });

  test("should render component successfully", () => {
    // GIVEN the component
    const givenCustomerSatisfactionRating = (
      <CustomerSatisfactionRating notifyOnCustomerSatisfactionRatingSubmitted={jest.fn()} />
    );

    // WHEN the component is rendered
    render(givenCustomerSatisfactionRating);

    // THEN the customer satisfaction rating container should be in the document
    expect(screen.getByTestId(DATA_TEST_ID.CUSTOMER_SATISFACTION_RATING_CONTAINER)).toBeInTheDocument();

    // AND the custom rating component should be called with the correct props
    const expectedQuestion = i18n.t("customerSatisfactionRating_question_text", {
      question: (questions as any)[QUESTION_KEYS.CUSTOMER_SATISFACTION]?.question_text ?? "",
      defaultValue: "Finally, we'd love to hear your thoughts on your experience so far! ",
    });

    expect(CustomRating).toHaveBeenCalledWith({
      questionId: QUESTION_KEYS.CUSTOMER_SATISFACTION,
      questionText: expectedQuestion,
      ratingValue: null,
      notifyChange: expect.any(Function),
      lowRatingLabel: i18n.t("customerSatisfactionRating_rating_label_low", { defaultValue: "Unsatisfied" }),
      highRatingLabel: i18n.t("customerSatisfactionRating_rating_label_high", { defaultValue: "Satisfied" }),
      maxRating: 5,
      disabled: false,
      type: QuestionType.Rating
    }, {});
    // AND the custom rating container to be in the document
    expect(screen.getByTestId(CUSTOM_RATING_DATA_TEST_ID.CUSTOM_RATING_CONTAINER)).toBeInTheDocument();
    // AND expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    // AND the component to match the snapshot
    expect(givenCustomerSatisfactionRating).toMatchSnapshot();
  });

  test("should submit rating successfully", async () => {
    // GIVEN the user has a valid session
    UserPreferencesStateService.getInstance().setUserPreferences(mockUserPreferences);
    // AND the feedback service will send a feedback for the session successfully
    jest.spyOn(OverallFeedbackService.getInstance(), "sendFeedback").mockResolvedValueOnce(mockFeedbackResponse);
    // AND component is rendered
    const givenNotifyOnSubmitted = jest.fn();
    render(<CustomerSatisfactionRating notifyOnCustomerSatisfactionRatingSubmitted={givenNotifyOnSubmitted} />);

    // WHEN a rating is selected
    const ratingChangeCallback = (CustomRating as jest.Mock).mock.calls.at(-1)[0].notifyChange;
    act(() => {
      ratingChangeCallback(4);
    });

    // THEN expect the feedback service to be called with correct data
    await waitFor(() => {
      expect(givenNotifyOnSubmitted).toHaveBeenCalled();
    });

    // AND a backdrop to have been shown while the rating is being submitted
    expect(screen.getByTestId(BACKDROP_DATA_TEST_ID.BACKDROP_CONTAINER)).toBeInTheDocument();
    // AND the success snackbar to be shown
    expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith(
      i18n.t("customerSatisfactionRating_submit_success", { defaultValue: "Rating Feedback submitted successfully!" }), {
      variant: "success",
    });
    // AND expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should handle submission error", async () => {
    // GIVEN the user has a valid session
    UserPreferencesStateService.getInstance().setUserPreferences(mockUserPreferences);
    // AND the feedback service will throw an error
    const givenError = new Error("Failed to send feedback");
    jest.spyOn(OverallFeedbackService.getInstance(), "sendFeedback").mockRejectedValueOnce(givenError);
    // AND the component is rendered
    const givenNotifyOnSubmitted = jest.fn();
    render(<CustomerSatisfactionRating notifyOnCustomerSatisfactionRatingSubmitted={givenNotifyOnSubmitted} />);

    // WHEN a rating is selected
    const ratingChangeCallback = (CustomRating as jest.Mock).mock.calls.at(-1)[0].notifyChange;
    act(() => {
      ratingChangeCallback(4);
    });

    // THEN expect the error snackbar to be shown
    await waitFor(() => {
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith(
        i18n.t("customerSatisfactionRating_submit_error", { defaultValue: "Failed to submit feedback. Please try again later." }),
        {
          variant: "error",
        }
      );
    });
    // AND the given callback to not have been called
    expect(givenNotifyOnSubmitted).not.toHaveBeenCalled();
    // AND the error to be logged
    expect(console.error).toHaveBeenCalledWith("Feedback submission failed:", expect.any(Error));
    // AND expect no warning to have occurred
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should handle missing user session", async () => {
    // GIVEN the user has no valid sessions
    UserPreferencesStateService.getInstance().setUserPreferences({
      ...mockUserPreferences,
      sessions: [],
    });
    // AND the component is rendered
    const givenNotifyOnSubmitted = jest.fn();
    render(<CustomerSatisfactionRating notifyOnCustomerSatisfactionRatingSubmitted={givenNotifyOnSubmitted} />);

    // WHEN a rating is selected
    const ratingChangeCallback = (CustomRating as jest.Mock).mock.calls.at(-1)[0].notifyChange;
    act(() => {
      ratingChangeCallback(4);
    });

    // THEN expect the error snackbar to be shown
    await waitFor(() => {
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith(
        i18n.t("customerSatisfactionRating_submit_error", { defaultValue: "Failed to submit feedback. Please try again later." }),
        {
          variant: "error",
        }
      );
    });
    // AND the given callback to not have been called
    expect(givenNotifyOnSubmitted).not.toHaveBeenCalled();
    // AND the error to be logged
    expect(console.error).toHaveBeenCalledWith("Feedback submission failed:", expect.any(Error));
    // AND expect no warning to have occurred
    expect(console.warn).not.toHaveBeenCalled();
  });

  // test should handle offline
  test("should handle offline", async () => {
    // GIVEN the user has a valid session
    UserPreferencesStateService.getInstance().setUserPreferences(mockUserPreferences);

    // AND the browser is offline
    mockBrowserIsOnLine(false);

    // WHEN the component is rendered
    jest.spyOn(OverallFeedbackService.getInstance(), "sendFeedback")
    const givenNotifyOnSubmitted = jest.fn();
    render(<CustomerSatisfactionRating notifyOnCustomerSatisfactionRatingSubmitted={givenNotifyOnSubmitted} />);

    // THEN expect the rating to be disabled
    expect((CustomRating as jest.Mock).mock.calls.at(-1)[0].disabled).toBe(true);
  });
}); 