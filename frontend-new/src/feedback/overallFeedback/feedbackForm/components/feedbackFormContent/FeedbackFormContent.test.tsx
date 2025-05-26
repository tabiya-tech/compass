// mute the console
import "src/_test_utilities/consoleMock";

import React from "react";
import { render, screen, act, fireEvent } from "src/_test_utilities/test-utils";
import { DATA_TEST_ID as CUSTOM_RATING_DATA_TEST_ID } from "src/feedback/overallFeedback/feedbackForm/components/customRating/CustomRating";
import { DATA_TEST_ID as YES_NO_DATA_TEST_ID } from "src/feedback/overallFeedback/feedbackForm/components/yesNoQuestion/YesNoQuestion";
import FeedbackFormContent, {
  DATA_TEST_ID,
} from "src/feedback/overallFeedback/feedbackForm/components/feedbackFormContent/FeedbackFormContent";
import { DATA_TEST_ID as COMMENT_TEXT_FIELD_TEST_ID } from "src/feedback/overallFeedback/feedbackForm/components/commentTextField/CommentTextField";
import { useSwipeable } from "react-swipeable";
import { mockBrowserIsOnLine } from "src/_test_utilities/mockBrowserIsOnline";
import { FeedbackItem } from "src/feedback/overallFeedback/overallFeedbackService/OverallFeedback.service.types";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import { FeedbackProvider } from "src/feedback/overallFeedback/context/FeedbackContext";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";

// Import DATA_TEST_IDs for all question components
import { DATA_TEST_ID as PERCEIVED_BIAS_DATA_TEST_ID } from "src/feedback/overallFeedback/feedbackForm/components/feedbackFormContent/questionComponents/PerceivedBiasQuestion";
import { DATA_TEST_ID as WORK_EXPERIENCE_ACCURACY_DATA_TEST_ID } from "src/feedback/overallFeedback/feedbackForm/components/feedbackFormContent/questionComponents/WorkExperienceAccuracyQuestion";
import { DATA_TEST_ID as CLARITY_OF_SKILLS_DATA_TEST_ID } from "src/feedback/overallFeedback/feedbackForm/components/feedbackFormContent/questionComponents/ClarityOfSkillsQuestion";
import { DATA_TEST_ID as INCORRECT_SKILLS_DATA_TEST_ID } from "src/feedback/overallFeedback/feedbackForm/components/feedbackFormContent/questionComponents/IncorrectSkillsQuestion";
import { DATA_TEST_ID as MISSING_SKILLS_DATA_TEST_ID } from "src/feedback/overallFeedback/feedbackForm/components/feedbackFormContent/questionComponents/MissingSkillsQuestion";
import { DATA_TEST_ID as INTERACTION_EASE_DATA_TEST_ID } from "src/feedback/overallFeedback/feedbackForm/components/feedbackFormContent/questionComponents/InteractionEaseQuestion";
import { DATA_TEST_ID as RECOMMENDATION_DATA_TEST_ID } from "src/feedback/overallFeedback/feedbackForm/components/feedbackFormContent/questionComponents/RecommendationQuestion";
import { DATA_TEST_ID as ADDITIONAL_FEEDBACK_DATA_TEST_ID } from "src/feedback/overallFeedback/feedbackForm/components/feedbackFormContent/questionComponents/AdditionalFeedbackQuestion";

// mock the swipeable hook
jest.mock("react-swipeable");

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
jest.mock("src/feedback/overallFeedback/feedbackForm/components/feedbackFormContent/questionComponents/PerceivedBiasQuestion", () => {
  const actual = jest.requireActual("src/feedback/overallFeedback/feedbackForm/components/feedbackFormContent/questionComponents/PerceivedBiasQuestion");
  return {
    ...actual,
    __esModule: true,
    default: jest.fn().mockImplementation(() => <div data-testid={actual.DATA_TEST_ID.PERCEIVED_BIAS} />),
  };
});

jest.mock("src/feedback/overallFeedback/feedbackForm/components/feedbackFormContent/questionComponents/WorkExperienceAccuracyQuestion", () => {
  const actual = jest.requireActual("src/feedback/overallFeedback/feedbackForm/components/feedbackFormContent/questionComponents/WorkExperienceAccuracyQuestion");
  return {
    ...actual,
    __esModule: true,
    default: jest.fn().mockImplementation(() => <div data-testid={actual.DATA_TEST_ID.WORK_EXPERIENCE_ACCURACY} />),
  };
});

jest.mock("src/feedback/overallFeedback/feedbackForm/components/feedbackFormContent/questionComponents/ClarityOfSkillsQuestion", () => {
  const actual = jest.requireActual("src/feedback/overallFeedback/feedbackForm/components/feedbackFormContent/questionComponents/ClarityOfSkillsQuestion");
  return {
    ...actual,
    __esModule: true,
    default: jest.fn().mockImplementation(() => <div data-testid={actual.DATA_TEST_ID.CLARITY_OF_SKILLS} />),
  };
});

jest.mock("src/feedback/overallFeedback/feedbackForm/components/feedbackFormContent/questionComponents/IncorrectSkillsQuestion", () => {
  const actual = jest.requireActual("src/feedback/overallFeedback/feedbackForm/components/feedbackFormContent/questionComponents/IncorrectSkillsQuestion");
  return {
    ...actual,
    __esModule: true,
    default: jest.fn().mockImplementation(() => <div data-testid={actual.DATA_TEST_ID.INCORRECT_SKILLS} />),
  };
});

jest.mock("src/feedback/overallFeedback/feedbackForm/components/feedbackFormContent/questionComponents/MissingSkillsQuestion", () => {
  const actual = jest.requireActual("src/feedback/overallFeedback/feedbackForm/components/feedbackFormContent/questionComponents/MissingSkillsQuestion");
  return {
    ...actual,
    __esModule: true,
    default: jest.fn().mockImplementation(() => <div data-testid={actual.DATA_TEST_ID.MISSING_SKILLS} />),
  };
});

jest.mock("src/feedback/overallFeedback/feedbackForm/components/feedbackFormContent/questionComponents/InteractionEaseQuestion", () => {
  const actual = jest.requireActual("src/feedback/overallFeedback/feedbackForm/components/feedbackFormContent/questionComponents/InteractionEaseQuestion");
  return {
    ...actual,
    __esModule: true,
    default: jest.fn().mockImplementation(() => <div data-testid={actual.DATA_TEST_ID.INTERACTION_EASE} />),
  };
});

jest.mock("src/feedback/overallFeedback/feedbackForm/components/feedbackFormContent/questionComponents/RecommendationQuestion", () => {
  const actual = jest.requireActual("src/feedback/overallFeedback/feedbackForm/components/feedbackFormContent/questionComponents/RecommendationQuestion");
  return {
    ...actual,
    __esModule: true,
    default: jest.fn().mockImplementation(() => <div data-testid={actual.DATA_TEST_ID.RECOMMENDATION} />),
  };
});

jest.mock("src/feedback/overallFeedback/feedbackForm/components/feedbackFormContent/questionComponents/AdditionalFeedbackQuestion", () => {
  const actual = jest.requireActual("src/feedback/overallFeedback/feedbackForm/components/feedbackFormContent/questionComponents/AdditionalFeedbackQuestion");
  return {
    ...actual,
    __esModule: true,
    default: jest.fn().mockImplementation(() => <div data-testid={actual.DATA_TEST_ID.ADDITIONAL_FEEDBACK} />),
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

describe.skip("FeedbackFormContent", () => {
  // GIVEN the component is rendered with a mock notify submit function
  const mockNotifySubmit = jest.fn();
  const renderComponent = () => {
    return renderWithFeedbackProvider(<FeedbackFormContent notifySubmit={mockNotifySubmit} />);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (PersistentStorageService.getOverallFeedback as jest.Mock).mockReturnValue([]);
    // Mock the active session ID
    jest.spyOn(UserPreferencesStateService.getInstance(), "getActiveSessionId").mockReturnValue(1);
  });

  test("should render component successfully", () => {
    // GIVEN the component
    const givenFeedbackFormContent = <FeedbackFormContent notifySubmit={jest.fn()} />;

    // WHEN the component is rendered
    renderWithFeedbackProvider(givenFeedbackFormContent);

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    // AND the feedback form content to be in the document
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
      const givenFeedbackFormContent = <FeedbackFormContent notifySubmit={jest.fn()} />;
      // AND the component is rendered
      renderWithFeedbackProvider(givenFeedbackFormContent);

      // WHEN the next button is clicked
      const nextButton = screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_NEXT_BUTTON);
      fireEvent.click(nextButton);

      // THEN expect to go to the next step
      expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_CONTENT_TITLE)).toHaveTextContent("Skill Accuracy");

      // AND no errors or warnings to be shown
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });

    test("should call handlePrevious when back button is clicked", () => {
      // GIVEN the component
      const givenFeedbackFormContent = <FeedbackFormContent notifySubmit={jest.fn()} />;
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

      // AND no errors or warnings to be shown
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });

    test("should call handleSubmit with exact answer data when answering each step", () => {
      // GIVEN the FeedbackFormContent component
      const mockHandleSubmit = jest.fn();
      const givenFeedbackFormContent = <FeedbackFormContent notifySubmit={mockHandleSubmit} />;
      // AND the component is rendered
      renderWithFeedbackProvider(givenFeedbackFormContent);

      // WHEN we interact with the first step's questions
      const perceivedBiasQuestion = screen.getByTestId(PERCEIVED_BIAS_DATA_TEST_ID.PERCEIVED_BIAS);
      const workExperienceAccuracyQuestion = screen.getByTestId(WORK_EXPERIENCE_ACCURACY_DATA_TEST_ID.WORK_EXPERIENCE_ACCURACY);
      fireEvent.click(perceivedBiasQuestion);
      fireEvent.click(workExperienceAccuracyQuestion);

      // AND move to next step
      const nextButton = screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_NEXT_BUTTON);
      fireEvent.click(nextButton);

      // AND we interact with the second step's questions
      const clarityOfSkillsQuestion = screen.getByTestId(CLARITY_OF_SKILLS_DATA_TEST_ID.CLARITY_OF_SKILLS);
      const incorrectSkillsQuestion = screen.getByTestId(INCORRECT_SKILLS_DATA_TEST_ID.INCORRECT_SKILLS);
      const missingSkillsQuestion = screen.getByTestId(MISSING_SKILLS_DATA_TEST_ID.MISSING_SKILLS);
      fireEvent.click(clarityOfSkillsQuestion);
      fireEvent.click(incorrectSkillsQuestion);
      fireEvent.click(missingSkillsQuestion);

      // AND move to next step
      fireEvent.click(nextButton);

      // AND we interact with the final step's questions
      const interactionEaseQuestion = screen.getByTestId(INTERACTION_EASE_DATA_TEST_ID.INTERACTION_EASE);
      const recommendationQuestion = screen.getByTestId(RECOMMENDATION_DATA_TEST_ID.RECOMMENDATION);
      const additionalFeedbackQuestion = screen.getByTestId(ADDITIONAL_FEEDBACK_DATA_TEST_ID.ADDITIONAL_FEEDBACK);
      fireEvent.click(interactionEaseQuestion);
      fireEvent.click(recommendationQuestion);
      fireEvent.click(additionalFeedbackQuestion);

      // AND submit the form
      fireEvent.click(nextButton);

      // THEN expect mockHandleSubmit to have been called exactly once
      expect(mockHandleSubmit).toHaveBeenCalledTimes(1);

      // AND expect the submitted answers to contain all questions
      const submittedAnswers = mockHandleSubmit.mock.calls[0][0];
      expect(submittedAnswers).toHaveLength(9); // Total number of questions across all steps

      // AND expect each question to have the correct structure
      submittedAnswers.forEach((answer: { question_id: string; simplified_answer: { comment: string | null; rating_boolean: boolean | null; rating_numeric: number | null; selected_options_keys: string[] | null } }) => {
        expect(answer).toHaveProperty('question_id');
        expect(answer).toHaveProperty('simplified_answer');
        expect(answer.simplified_answer).toHaveProperty('comment');
        expect(answer.simplified_answer).toHaveProperty('rating_boolean');
        expect(answer.simplified_answer).toHaveProperty('rating_numeric');
        expect(answer.simplified_answer).toHaveProperty('selected_options_keys');
      });

      // AND no errors or warnings to be shown
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });

    test("should call handleAnswerChange when a question is answered", () => {
      // GIVEN the FeedbackFormContent component
      const givenFeedbackFormContent = <FeedbackFormContent notifySubmit={jest.fn()} />;
      // AND the component is rendered
      renderWithFeedbackProvider(givenFeedbackFormContent);

      // WHEN question is answered
      const yesNoInput = screen.getByTestId(YES_NO_DATA_TEST_ID.RADIO_YES);
      fireEvent.click(yesNoInput);
      const input = screen.getByTestId(COMMENT_TEXT_FIELD_TEST_ID.COMMENT_TEXT_FIELD);
      fireEvent.change(input, { target: { value: "This is a comment" } });

      // THEN expect the answer to be saved
      expect(input).toHaveValue("This is a comment");

      // AND no errors or warnings to be shown
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });

    test("should go to the next step when swiping left", () => {
      // GIVEN the component is rendered
      renderWithFeedbackProvider(<FeedbackFormContent notifySubmit={jest.fn()} />);
      // AND the swipe handlers
      const swipeHandlers = (useSwipeable as jest.Mock).mock.calls[0][0];

      // WHEN the component is swiped left
      act(() => {
        swipeHandlers.onSwipedLeft();
      });

      // THEN expect to go to the next step
      expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_CONTENT_TITLE)).toHaveTextContent("Skill Accuracy");

      // AND WHEN the component is swiped left for again
      act(() => {
        swipeHandlers.onSwipedLeft();
      });

      // THEN expect to go to the next step
      expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_CONTENT_TITLE)).toHaveTextContent("Final feedback");

      // AND no errors or warnings to be shown
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });

    test("should go to the previous step when swiping right", () => {
      // GIVEN the component is rendered
      renderWithFeedbackProvider(<FeedbackFormContent notifySubmit={jest.fn()} />);

      // WHEN the component is swiped left twice
      act(() => {
        (useSwipeable as jest.Mock).mock.calls[0][0].onSwipedLeft();
        (useSwipeable as jest.Mock).mock.calls[0][0].onSwipedLeft();
      });

      // THEN expect to go to the third
      expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_CONTENT_TITLE)).toHaveTextContent("Final feedback");

      // WHEN the component is swiped right
      act(() => {
        (useSwipeable as jest.Mock).mock.calls.at(-1)[0].onSwipedRight();
      });

      // THEN expect to go to the previous step
      expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_CONTENT_TITLE)).toHaveTextContent("Skill Accuracy");

      // AND WHEN the component is swiped right again
      act(() => {
        (useSwipeable as jest.Mock).mock.calls.at(-1)[0].onSwipedRight();
      });

      // THEN expect to go to the previous step
      expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_CONTENT_TITLE)).toHaveTextContent("Bias & Experience Accuracy");

      // AND no errors or warnings to be shown
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });

    test("should do nothing when swiping right on the first step", () => {
      // GIVEN the component is rendered
      renderWithFeedbackProvider(<FeedbackFormContent notifySubmit={jest.fn()} />);

      // WHEN the component is swiped right on the first step
      act(() => {
        (useSwipeable as jest.Mock).mock.calls[0][0].onSwipedRight();
      });

      // THEN expect to stay on the first step
      expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_CONTENT_TITLE)).toHaveTextContent("Bias & Experience Accuracy");
    });

    test("should do nothing when swiping left on the last step", () => {
      // GIVEN the component is rendered
      renderWithFeedbackProvider(<FeedbackFormContent notifySubmit={jest.fn()} />);

      // WHEN the component is swiped left to reach the last step
      act(() => {
        (useSwipeable as jest.Mock).mock.calls[0][0].onSwipedLeft();
      });
      act(() => {
        (useSwipeable as jest.Mock).mock.calls[1][0].onSwipedLeft();
      });

      // THEN expect to reach the last step
      const lastStepTitle = "Final feedback";
      const lastStepTitleElement = screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_CONTENT_TITLE);
      expect(lastStepTitleElement).toHaveTextContent(lastStepTitle);

      // WHEN the component is swiped left on the last step
      act(() => {
        (useSwipeable as jest.Mock).mock.calls[2][0].onSwipedLeft();
      });

      // THEN expect to stay on the last step
      expect(lastStepTitleElement).toHaveTextContent(lastStepTitle);

      // AND no errors or warnings to be shown
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });

    test("should enable/disable the submit button when the browser online status changes", async () => {
      // GIVEN the browser is offline
      mockBrowserIsOnLine(false);

      // WHEN the component is rendered
      renderWithFeedbackProvider(<FeedbackFormContent notifySubmit={jest.fn()} />);
      // AND we are on the last step
      act(() => {
        (useSwipeable as jest.Mock).mock.calls[0][0].onSwipedLeft();
        (useSwipeable as jest.Mock).mock.calls[0][0].onSwipedLeft();
      });
      // AND a question is answered
      const customRating = screen.getAllByTestId(CUSTOM_RATING_DATA_TEST_ID.CUSTOM_RATING_ICON)[4];
      fireEvent.click(customRating);

      // THEN expect the submit button to be disabled
      const submitButton = screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_NEXT_BUTTON);
      expect(submitButton).toBeDisabled();

      // WHEN the browser goes online
      mockBrowserIsOnLine(true);

      // THEN expect the submit button to be enabled
      expect(submitButton).toBeEnabled();
      // AND expect no errors or warnings to be logged
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });
  });

  test("should render the first step with bias and experience accuracy questions", () => {
    // WHEN the component is rendered
    renderComponent();

    // THEN expect the title to be correct
    expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_CONTENT_TITLE)).toHaveTextContent("Bias & Experience Accuracy");
    
    // AND expect the questions to be present
    expect(screen.getByTestId(PERCEIVED_BIAS_DATA_TEST_ID.PERCEIVED_BIAS)).toBeInTheDocument();
    expect(screen.getByTestId(WORK_EXPERIENCE_ACCURACY_DATA_TEST_ID.WORK_EXPERIENCE_ACCURACY)).toBeInTheDocument();
  });

  test("should navigate to the second step when clicking next", () => {
    // WHEN the component is rendered
    renderComponent();

    // AND the next button is clicked
    fireEvent.click(screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_NEXT_BUTTON));

    // THEN expect the title to be correct
    expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_CONTENT_TITLE)).toHaveTextContent("Skill Accuracy");
    
    // AND expect the questions to be present
    expect(screen.getByTestId(CLARITY_OF_SKILLS_DATA_TEST_ID.CLARITY_OF_SKILLS)).toBeInTheDocument();
    expect(screen.getByTestId(INCORRECT_SKILLS_DATA_TEST_ID.INCORRECT_SKILLS)).toBeInTheDocument();
    expect(screen.getByTestId(MISSING_SKILLS_DATA_TEST_ID.MISSING_SKILLS)).toBeInTheDocument();
  });

  test("should navigate to the final step when clicking next twice", () => {
    // WHEN the component is rendered
    renderComponent();

    // AND the next button is clicked twice
    fireEvent.click(screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_NEXT_BUTTON));
    fireEvent.click(screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_NEXT_BUTTON));

    // THEN expect the title to be correct
    expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_CONTENT_TITLE)).toHaveTextContent("Final feedback");
    
    // AND expect the questions to be present
    expect(screen.getByTestId(INTERACTION_EASE_DATA_TEST_ID.INTERACTION_EASE)).toBeInTheDocument();
    expect(screen.getByTestId(RECOMMENDATION_DATA_TEST_ID.RECOMMENDATION)).toBeInTheDocument();
    expect(screen.getByTestId(ADDITIONAL_FEEDBACK_DATA_TEST_ID.ADDITIONAL_FEEDBACK)).toBeInTheDocument();
  });

  test("should be able to go back to previous steps", () => {
    // WHEN the component is rendered
    renderComponent();

    // AND we navigate to the second step
    fireEvent.click(screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_NEXT_BUTTON));

    // AND we click the back button
    fireEvent.click(screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_BACK_BUTTON));

    // THEN expect to be back at the first step
    expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_CONTENT_TITLE)).toHaveTextContent("Bias & Experience Accuracy");
  });

  test("should submit feedback when on last step and next is clicked", () => {
    // GIVEN there is some feedback data
    const mockFeedback: FeedbackItem[] = [
      {
        question_id: "test_question",
        simplified_answer: { rating_numeric: 5 }
      }
    ];
    (PersistentStorageService.getOverallFeedback as jest.Mock).mockReturnValue(mockFeedback);

    // WHEN the component is rendered
    renderComponent();

    // AND we navigate to the last step
    fireEvent.click(screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_NEXT_BUTTON));
    fireEvent.click(screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_NEXT_BUTTON));

    // AND we click next (which is now submit)
    fireEvent.click(screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_NEXT_BUTTON));

    // THEN expect the feedback to be submitted
    expect(mockNotifySubmit).toHaveBeenCalledWith(mockFeedback);
    // AND the persistent storage to be cleared
    expect(PersistentStorageService.clearOverallFeedback).toHaveBeenCalled();
  });

  test("should not allow submission without any feedback", () => {
    // WHEN the component is rendered
    renderComponent();

    // AND we navigate to the last step
    fireEvent.click(screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_NEXT_BUTTON));
    fireEvent.click(screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_NEXT_BUTTON));

    // THEN expect the submit button to be disabled
    expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_NEXT_BUTTON)).toBeDisabled();
  });

  test("should save feedback to persistent storage when answers change", () => {
    // WHEN the component is rendered
    renderComponent();

    // AND we answer a question
    const question = screen.getByTestId(PERCEIVED_BIAS_DATA_TEST_ID.PERCEIVED_BIAS);
    fireEvent.click(question);

    // THEN expect the feedback to be saved to persistent storage
    expect(PersistentStorageService.setOverallFeedback).toHaveBeenCalled();
  });

  test("should collect and submit answers from all steps", () => {
    // GIVEN the FeedbackFormContent component
    const mockHandleSubmit = jest.fn();
    const givenFeedbackFormContent = <FeedbackFormContent notifySubmit={mockHandleSubmit} />;
    // AND the component is rendered
    renderWithFeedbackProvider(givenFeedbackFormContent);

    // WHEN we navigate through all steps
    const nextButton = screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_NEXT_BUTTON);
    fireEvent.click(nextButton); // Move to step 2
    fireEvent.click(nextButton); // Move to step 3
    fireEvent.click(nextButton); // Submit

    // THEN expect mockHandleSubmit to have been called exactly once
    expect(mockHandleSubmit).toHaveBeenCalledTimes(1);

    // AND expect the submitted answers to contain all questions
    const submittedAnswers = mockHandleSubmit.mock.calls[0][0];
    expect(submittedAnswers).toHaveLength(9); // Total number of questions across all steps

    // AND expect each question to have the correct structure
    submittedAnswers.forEach((answer: { question_id: string; simplified_answer: { comment: string | null; rating_boolean: boolean | null; rating_numeric: number | null; selected_options_keys: string[] | null } }) => {
      expect(answer).toHaveProperty('question_id');
      expect(answer).toHaveProperty('simplified_answer');
      expect(answer.simplified_answer).toHaveProperty('comment');
      expect(answer.simplified_answer).toHaveProperty('rating_boolean');
      expect(answer.simplified_answer).toHaveProperty('rating_numeric');
      expect(answer.simplified_answer).toHaveProperty('selected_options_keys');
    });

    // AND no errors or warnings to be shown
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });
});
