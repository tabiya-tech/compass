// mute the console
import "src/_test_utilities/consoleMock";
import React from "react";
import { render, screen, act, waitFor} from "src/_test_utilities/test-utils";
import CustomerSatisfactionRating, { UI_TEXT, DATA_TEST_ID } from "./CustomerSatisfaction";
import CustomRating, { DATA_TEST_ID as CUSTOM_RATING_DATA_TEST_ID } from "src/feedback/overallFeedback/overallFeedbackForm/components/formContent/questionTypes/customRating/CustomRating";
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
import { FeedbackResponse } from "src/feedback/overallFeedback/overallFeedbackService/OverallFeedback.service.types";
import { QuestionType } from "src/feedback/overallFeedback/overallFeedbackForm/overallFeedbackForm.types";
import { FeedbackProvider } from "src/feedback/overallFeedback/feedbackContext/FeedbackContext";
import { mockQuestionsConfig } from "src/feedback/overallFeedback/overallFeedbackForm/overallFeedbackForm.test.utils";
import { CUSTOMER_SATISFACTION_QUESTION_KEY } from "./constants";

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
jest.mock("src/feedback/overallFeedback/overallFeedbackForm/components/formContent/questionTypes/customRating/CustomRating", () => {
  const actual = jest.requireActual("src/feedback/overallFeedback/overallFeedbackForm/components/formContent/questionTypes/customRating/CustomRating");
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

// Helper function to wrap components with FeedbackProvider
const renderWithFeedbackProvider = (ui: React.ReactElement) => {
  return render(
    <FeedbackProvider>
      {ui}
    </FeedbackProvider>
  );
};

describe("CustomerSatisfactionRating", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBrowserIsOnLine(true);

    UserPreferencesStateService.getInstance().clearUserPreferences();
    // Reset all method mocks on the singletons that may have been mocked
    resetAllMethodMocks(OverallFeedbackService.getInstance());

    // Reset all method mocks on the user preferences service
    resetAllMethodMocks(UserPreferencesStateService.getInstance());

    // Mock the useFeedback hook to return our mockQuestionsConfig
    jest.spyOn(require("src/feedback/overallFeedback/feedbackContext/FeedbackContext"), "useFeedback").mockReturnValue({
      questionsConfig: mockQuestionsConfig,
      setQuestionsConfig: jest.fn(),
      isLoading: false,
      error: null,
      answers: [],
      handleAnswerChange: jest.fn(),
      clearAnswers: jest.fn(),
    });

    // Mock the active session ID
    jest.spyOn(UserPreferencesStateService.getInstance(), "getActiveSessionId").mockReturnValue(1);

    // Mock the getQuestionsConfig to return our mock config
    jest.spyOn(OverallFeedbackService.getInstance(), "getQuestionsConfig").mockResolvedValue(mockQuestionsConfig);
  });

  test("should render component successfully", () => {
    // GIVEN the component
    const givenCustomerSatisfactionRating = (
      <CustomerSatisfactionRating notifyOnCustomerSatisfactionRatingSubmitted={jest.fn()} />
    );

    // WHEN the component is rendered
    renderWithFeedbackProvider(givenCustomerSatisfactionRating);

    // THEN the customer satisfaction rating container should be in the document
    expect(screen.getByTestId(DATA_TEST_ID.CUSTOMER_SATISFACTION_RATING_CONTAINER)).toBeInTheDocument();

    // AND the custom rating component should be called with the correct props
    expect(CustomRating).toHaveBeenCalledWith({
      question_id: CUSTOMER_SATISFACTION_QUESTION_KEY,
      question_text: expect.stringContaining("Finally, we'd love to hear your thoughts"),
      ratingValue: null,
      notifyChange: expect.any(Function),
      lowRatingLabel: UI_TEXT.RATING_LABEL_LOW,
      highRatingLabel: UI_TEXT.RATING_LABEL_HIGH,
      maxRating: 5,
      disabled: false,
      type: QuestionType.Rating,
      description: expect.any(String),
      comment_placeholder: expect.any(String),
    }, {});
    // AND the custom rating container to be in the document
    expect(screen.getByTestId(CUSTOM_RATING_DATA_TEST_ID.CUSTOM_RATING_CONTAINER)).toBeInTheDocument();
    // AND expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should submit rating successfully", async () => {
    // GIVEN the user has a valid session
    UserPreferencesStateService.getInstance().setUserPreferences(mockUserPreferences);
    // AND the feedback service will send a feedback for the session successfully
    jest.spyOn(OverallFeedbackService.getInstance(), "sendFeedback").mockResolvedValueOnce(mockFeedbackResponse);
    // AND component is rendered
    const givenNotifyOnSubmitted = jest.fn();
    renderWithFeedbackProvider(<CustomerSatisfactionRating notifyOnCustomerSatisfactionRatingSubmitted={givenNotifyOnSubmitted} />);

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
    expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith("Rating Feedback submitted successfully!", {
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
    renderWithFeedbackProvider(<CustomerSatisfactionRating notifyOnCustomerSatisfactionRatingSubmitted={givenNotifyOnSubmitted} />);

    // WHEN a rating is selected
    const ratingChangeCallback = (CustomRating as jest.Mock).mock.calls.at(-1)[0].notifyChange;
    act(() => {
      ratingChangeCallback(4);
    });

    // THEN expect the error snackbar to be shown
    await waitFor(() => {
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith("Failed to submit feedback. Please try again later.", {
        variant: "error",
      });
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
    jest.spyOn(UserPreferencesStateService.getInstance(), "getActiveSessionId").mockReturnValue(null);
    // AND the component is rendered
    const givenNotifyOnSubmitted = jest.fn();
    renderWithFeedbackProvider(<CustomerSatisfactionRating notifyOnCustomerSatisfactionRatingSubmitted={givenNotifyOnSubmitted} />);

    // WHEN a rating is selected
    const ratingChangeCallback = (CustomRating as jest.Mock).mock.calls.at(-1)[0].notifyChange;
    act(() => {
      ratingChangeCallback(4);
    });

    // THEN expect the error snackbar to be shown
    await waitFor(() => {
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith("Failed to submit feedback. Please try again later.", {
        variant: "error",
      });
    });
    // AND the given callback to not have been called
    expect(givenNotifyOnSubmitted).not.toHaveBeenCalled();
    // AND the error to be logged
    expect(console.error).toHaveBeenCalledWith("Feedback submission failed:", expect.any(Error));
    // AND expect no warning to have occurred
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should handle offline", async () => {
    // GIVEN the user has a valid session
    UserPreferencesStateService.getInstance().setUserPreferences(mockUserPreferences);

    // AND the browser is offline
    mockBrowserIsOnLine(false);

    // WHEN the component is rendered
    jest.spyOn(OverallFeedbackService.getInstance(), "sendFeedback")
    const givenNotifyOnSubmitted = jest.fn();
    renderWithFeedbackProvider(<CustomerSatisfactionRating notifyOnCustomerSatisfactionRatingSubmitted={givenNotifyOnSubmitted} />);

    // THEN expect the rating to be disabled
    expect((CustomRating as jest.Mock).mock.calls.at(-1)[0].disabled).toBe(true);
  });
});