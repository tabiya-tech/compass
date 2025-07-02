// mute the console
import "src/_test_utilities/consoleMock";

import React from "react";
import { render, screen, act, fireEvent } from "src/_test_utilities/test-utils";
import FormContent, {
  DATA_TEST_ID,
} from "src/feedback/overallFeedback/overallFeedbackForm/components/formContent/FormContent";
import { useSwipeable } from "react-swipeable";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import { FeedbackProvider } from "src/feedback/overallFeedback/feedbackContext/FeedbackContext";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import OverallFeedbackService from "src/feedback/overallFeedback/overallFeedbackService/OverallFeedback.service";
import { mockQuestionsConfig } from "src/feedback/overallFeedback/overallFeedbackForm/overallFeedbackForm.test.utils";
import { resetAllMethodMocks } from "src/_test_utilities/resetAllMethodMocks";

// mock the swipeable hook
jest.mock("react-swipeable", () => ({
  useSwipeable: jest.fn().mockReturnValue({
    onSwipedLeft: jest.fn(),
    onSwipedRight: jest.fn(),
  }),
}));

// mock the framer-motion library
jest.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: { children: React.ReactElement }) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactElement }) => <>{children}</>,
}));

// Mock the persistent storage service
jest.mock("src/app/PersistentStorageService/PersistentStorageService", () => ({
  PersistentStorageService: {
    getOverallFeedback: jest.fn(),
    setOverallFeedback: jest.fn(),
    clearOverallFeedback: jest.fn(),
  },
}));

// Mock all question components
jest.mock("src/feedback/overallFeedback/overallFeedbackForm/components/formContent/questionComponents/perceivedBias/PerceivedBiasQuestion", () => {
  const actual = jest.requireActual("src/feedback/overallFeedback/overallFeedbackForm/components/formContent/questionComponents/perceivedBias/PerceivedBiasQuestion");
  return {
    ...actual,
    __esModule: true,
    default: ({ onChange }: any) => (
      <div
        data-testid={actual.DATA_TEST_ID.PERCEIVED_BIAS}
        onClick={() => onChange({
          question_id: "perceived_bias",
          simplified_answer: { rating_boolean: true, comment: "No bias perceived" }
        })}
      />
    ),
  };
});

jest.mock("src/feedback/overallFeedback/overallFeedbackForm/components/formContent/questionComponents/workExperienceAccuracy/WorkExperienceAccuracyQuestion", () => {
  const actual = jest.requireActual("src/feedback/overallFeedback/overallFeedbackForm/components/formContent/questionComponents/workExperienceAccuracy/WorkExperienceAccuracyQuestion");
  return {
    ...actual,
    __esModule: true,
    default: ({ onChange }: any) => (
      <div
        data-testid={actual.DATA_TEST_ID.WORK_EXPERIENCE_ACCURACY}
        onClick={() => onChange({
          question_id: "work_experience_accuracy",
          simplified_answer: { rating_boolean: true, comment: "Experience was accurate" }
        })}
      />
    ),
  };
});

jest.mock("src/feedback/overallFeedback/overallFeedbackForm/components/formContent/questionComponents/clarityOfSkills/ClarityOfSkillsQuestion", () => {
  const actual = jest.requireActual("src/feedback/overallFeedback/overallFeedbackForm/components/formContent/questionComponents/clarityOfSkills/ClarityOfSkillsQuestion");
  return {
    ...actual,
    __esModule: true,
    default: ({ onChange }: any) => (
      <div
        data-testid={actual.DATA_TEST_ID.CLARITY_OF_SKILLS}
        onClick={() => onChange({
          question_id: "clarity_of_skills",
          simplified_answer: { rating_boolean: true, comment: "Skills were clear" }
        })}
      />
    ),
  };
});

jest.mock("src/feedback/overallFeedback/overallFeedbackForm/components/formContent/questionComponents/incorrectSkills/IncorrectSkillsQuestion", () => {
  const actual = jest.requireActual("src/feedback/overallFeedback/overallFeedbackForm/components/formContent/questionComponents/incorrectSkills/IncorrectSkillsQuestion");
  return {
    ...actual,
    __esModule: true,
    default: ({ onChange }: any) => (
      <div
        data-testid={actual.DATA_TEST_ID.INCORRECT_SKILLS}
        onClick={() => onChange({
          question_id: "incorrect_skills",
          simplified_answer: { rating_boolean: false, comment: "No incorrect skills" }
        })}
      />
    ),
  };
});

jest.mock("src/feedback/overallFeedback/overallFeedbackForm/components/formContent/questionComponents/missingSkills/MissingSkillsQuestion", () => {
  const actual = jest.requireActual("src/feedback/overallFeedback/overallFeedbackForm/components/formContent/questionComponents/missingSkills/MissingSkillsQuestion");
  return {
    ...actual,
    __esModule: true,
    default: ({ onChange }: any) => (
      <div
        data-testid={actual.DATA_TEST_ID.MISSING_SKILLS}
        onClick={() => onChange({
          question_id: "missing_skills",
          simplified_answer: { rating_boolean: true, comment: "Some skills were missing" }
        })}
      />
    ),
  };
});

jest.mock("src/feedback/overallFeedback/overallFeedbackForm/components/formContent/questionComponents/interactionEase/InteractionEaseQuestion", () => {
  const actual = jest.requireActual("src/feedback/overallFeedback/overallFeedbackForm/components/formContent/questionComponents/interactionEase/InteractionEaseQuestion");
  return {
    ...actual,
    __esModule: true,
    default: ({ onChange }: any) => (
      <div
        data-testid={actual.DATA_TEST_ID.INTERACTION_EASE}
        onClick={() => onChange({
          question_id: "interaction_ease",
          simplified_answer: { rating_numeric: 4, comment: "Easy to use" }
        })}
      />
    ),
  };
});

jest.mock("src/feedback/overallFeedback/overallFeedbackForm/components/formContent/questionComponents/recommendation/RecommendationQuestion", () => {
  const actual = jest.requireActual("src/feedback/overallFeedback/overallFeedbackForm/components/formContent/questionComponents/recommendation/RecommendationQuestion");
  return {
    ...actual,
    __esModule: true,
    default: ({ onChange }: any) => (
      <div
        data-testid={actual.DATA_TEST_ID.RECOMMENDATION}
        onClick={() => onChange({
          question_id: "recommendation",
          simplified_answer: { rating_numeric: 5, comment: "Would recommend" }
        })}
      />
    ),
  };
});

jest.mock("src/feedback/overallFeedback/overallFeedbackForm/components/formContent/questionComponents/additionalFeedback/AdditionalFeedbackQuestion", () => {
  const actual = jest.requireActual("src/feedback/overallFeedback/overallFeedbackForm/components/formContent/questionComponents/additionalFeedback/AdditionalFeedbackQuestion");
  return {
    ...actual,
    __esModule: true,
    default: ({ onChange }: any) => (
      <div
        data-testid={actual.DATA_TEST_ID.ADDITIONAL_FEEDBACK}
        onClick={() => onChange({
          question_id: "additional_feedback",
          simplified_answer: { rating_numeric: 4, comment: "Overall good experience" }
        })}
      />
    ),
  };
});

// Helper function to wrap components with FeedbackProvider
const renderWithFeedbackProvider = (ui: React.ReactElement) => {
  return render(
    <FeedbackProvider>
      {ui}
    </FeedbackProvider>
  );
};

describe("FormContent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetAllMethodMocks(UserPreferencesStateService.getInstance());
    resetAllMethodMocks(OverallFeedbackService.getInstance());
    (PersistentStorageService.getOverallFeedback as jest.Mock).mockReturnValue([]);
    // Mock the active session ID
    jest.spyOn(UserPreferencesStateService.getInstance(), "getActiveSessionId").mockReturnValue(1);
    // Mock the questions config
    jest.spyOn(OverallFeedbackService.getInstance(), "getQuestionsConfig").mockResolvedValue(mockQuestionsConfig);
  });

  test("should render component successfully", () => {
    // GIVEN the component
    const givenFeedbackFormContent = <FormContent notifySubmit={jest.fn()} />;

    // WHEN the component is rendered
    renderWithFeedbackProvider(givenFeedbackFormContent);

    // THEN the feedback form content to be in the document
    const feedbackFormContent = screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_CONTENT);
    expect(feedbackFormContent).toBeInTheDocument();
    // AND the feedback form content title to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_CONTENT_TITLE)).toBeInTheDocument();
    // AND the feedback form content divider to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_CONTENT_DIVIDER)).toBeInTheDocument();
    // AND the feedback form content questions to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_CONTENT_QUESTIONS)).toBeInTheDocument();
    // AND the feedback form next button to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_NEXT_BUTTON)).toBeInTheDocument();
    // AND the feedback form back button to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_BACK_BUTTON)).toBeInTheDocument();
    // AND to match the snapshot
    expect(feedbackFormContent).toMatchSnapshot();
  });

  describe("action tests", () => {
    test("should call handleNext when next button is clicked", () => {
      // GIVEN the component
      const givenFeedbackFormContent = <FormContent notifySubmit={jest.fn()} />;
      // AND the component is rendered
      renderWithFeedbackProvider(givenFeedbackFormContent);

      // WHEN the next button is clicked
      const nextButton = screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_NEXT_BUTTON);
      fireEvent.click(nextButton);

      // THEN expect to go to the next step
      expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_CONTENT_TITLE)).toHaveTextContent("Skill Accuracy");
    });

    test("should call handlePrevious when back button is clicked", () => {
      // GIVEN the component
      const givenFeedbackFormContent = <FormContent notifySubmit={jest.fn()} />;
      // AND the component is rendered
      renderWithFeedbackProvider(givenFeedbackFormContent);

      // WHEN the next button is clicked to move to the next step
      const nextButton = screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_NEXT_BUTTON);
      fireEvent.click(nextButton);
      // AND the back button is clicked
      const backButton = screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_BACK_BUTTON);
      fireEvent.click(backButton);

      // THEN expect to go to the previous step
      expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_CONTENT_TITLE)).toHaveTextContent("Bias & Experience Accuracy");
    });

    test.todo("should call handleSubmit with exact answer data when answering each step");

    test.todo("should handle swipe navigation");

    test("should not allow to swipe past the last step", () => {
      // GIVEN the FormContent component
      const givenFeedbackFormContent = <FormContent notifySubmit={jest.fn()} />;
      // AND the component is rendered
      renderWithFeedbackProvider(givenFeedbackFormContent);

      // WHEN we move to the last step
      const nextButton = screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_NEXT_BUTTON);
      fireEvent.click(nextButton);
      fireEvent.click(nextButton);

      // AND try to swipe left
      const swipeHandlers = (useSwipeable as jest.Mock).mock.results[0].value;
      act(() => {
        swipeHandlers.onSwipedLeft();
      });

      // THEN expect to stay on the last step
      expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_CONTENT_TITLE)).toHaveTextContent("Final feedback");
    });

    test("should not allow to swipe before the first step", () => {
      // GIVEN the FormContent component
      const givenFeedbackFormContent = <FormContent notifySubmit={jest.fn()} />;
      // AND the component is rendered
      renderWithFeedbackProvider(givenFeedbackFormContent);

      // WHEN we try to swipe right
      const swipeHandlers = (useSwipeable as jest.Mock).mock.results[0].value;
      act(() => {
        swipeHandlers.onSwipedRight();
      });

      // THEN expect to stay on the first step
      expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_CONTENT_TITLE)).toHaveTextContent("Bias & Experience Accuracy");
    });
  });
});
