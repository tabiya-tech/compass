// mute the console
import "src/_test_utilities/consoleMock";

import React from "react";
import { render, screen, act, fireEvent } from "src/_test_utilities/test-utils";
import { DATA_TEST_ID as CUSTOM_RATING_DATA_TEST_ID } from "src/feedback/overallFeedback/feedbackForm/components/customRating/CustomRating";
import { DATA_TEST_ID as YES_NO_DATA_TEST_ID } from "src/feedback/overallFeedback/feedbackForm/components/yesNoQuestion/YesNoQuestion";
import FeedbackFormContent, {
  DATA_TEST_ID,
} from "src/feedback/overallFeedback/feedbackForm/components/feedbackFormContent/FeedbackFormContent";
import { DATA_TEST_ID as CHECKBOX_DATA_TEST_ID } from "src/feedback/overallFeedback/feedbackForm/components/checkboxQuestion/CheckboxQuestion";
import { DATA_TEST_ID as COMMENT_TEXT_FIELD_TEST_ID } from "src/feedback/overallFeedback/feedbackForm/components/commentTextField/CommentTextField";
import { useSwipeable } from "react-swipeable";
import { mockBrowserIsOnLine } from "src/_test_utilities/mockBrowserIsOnline";
// We need to import DetailedQuestion to perform the type assertion later.
import { QuestionType, YesNoEnum, DetailedQuestion } from "src/feedback/overallFeedback/feedbackForm/feedbackForm.types";

// 1. DEFINE MOCK STEPS DATA (Must include enough detail for assertions)
const mockFeedbackFormContentSteps = [
  {
    label: "Bias & Experience Accuracy",
    questions: [
      { questionId: "perceived_bias", type: QuestionType.YesNo, showCommentsOn: YesNoEnum.Yes },
      {
        questionId: "work_experience_accuracy",
        type: QuestionType.Checkbox,
        options: [{ key: "opt1", value: "Option 1" }, { key: "opt2", value: "Option 2" }],
      },
    ],
  },
  {
    label: "Skill Accuracy",
    questions: [
      { questionId: "clarity_of_skills", type: QuestionType.YesNo, showCommentsOn: YesNoEnum.No },
      { questionId: "incorrect_skills", type: QuestionType.YesNo, showCommentsOn: YesNoEnum.Yes },
      { questionId: "missing_skills", type: QuestionType.YesNo, showCommentsOn: YesNoEnum.Yes },
    ],
  },
  {
    label: "Final feedback",
    questions: [
      { questionId: "interaction_ease", type: QuestionType.Rating, maxRating: 5 },
      { questionId: "recommendation", type: QuestionType.Rating, maxRating: 5 },
      { questionId: "additional_feedback", type: QuestionType.Rating, displayRating: false },
    ],
  },
];

// 2. MOCK THE useFeedbackFormContentSteps HOOK
jest.mock(
  "src/feedback/overallFeedback/feedbackForm/components/feedbackFormContent/feedbackFormContentSteps",
  () => ({
    useFeedbackFormContentSteps: jest.fn(() => ({
      feedbackFormContentSteps: mockFeedbackFormContentSteps,
      loading: false, // Ensure loading is false for initial render tests
    })),
  })
);

// mock the swipeable hook
jest.mock("react-swipeable");

// mock the framer-motion library
jest.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: { children: React.ReactElement }) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactElement }) => <>{children}</>,
}));

describe("FeedbackFormContent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  // Helper to mock the useSwipeable handlers
  const getSwipeHandlers = (callIndex: number) => {
    // The useSwipeable hook is called once per component mount.
    // However, if the component re-renders (like when state changes), 
    // a new instance might be created. We use .at(-1) for the latest call.
    // For the initial render, the index is 0.
    const calls = (useSwipeable as jest.Mock).mock.calls;
    if (callIndex >= 0) return calls[callIndex][0];
    return calls.at(-1)[0];
  };

  test("should render component successfully", () => {
    // GIVEN the component
    const givenFeedbackFormContent = <FeedbackFormContent notifySubmit={jest.fn()} />;

    // WHEN the component is rendered
    render(givenFeedbackFormContent);

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
      render(givenFeedbackFormContent);

      // WHEN the next button is clicked
      const nextButton = screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_NEXT_BUTTON);
      fireEvent.click(nextButton);

      // THEN expect to go to the next step
      expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_CONTENT_TITLE)).toHaveTextContent(
        mockFeedbackFormContentSteps[1].label
      );

      // AND no errors or warnings to be shown
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });

    test("should call handlePrevious when back button is clicked", () => {
      // GIVEN the component
      const givenFeedbackFormContent = <FeedbackFormContent notifySubmit={jest.fn()} />;
      // AND the component is rendered
      render(givenFeedbackFormContent);

      // WHEN the next button is clicked to move to the next step
      const nextButton = screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_NEXT_BUTTON);
      fireEvent.click(nextButton);
      // AND the back button is clicked
      const backButton = screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_BACK_BUTTON);
      fireEvent.click(backButton);

      // THEN expect to go to the previous step
      expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_CONTENT_TITLE)).toHaveTextContent(
        mockFeedbackFormContentSteps[0].label
      );

      // AND no errors or warnings to be shown
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });

    test("should call handleSubmit with exact answer data when answering each step", () => {
      // GIVEN the FeedbackFormContent component
      const mockHandleSubmit = jest.fn();
      const givenFeedbackFormContent = <FeedbackFormContent notifySubmit={mockHandleSubmit} />;
      // AND the component is rendered
      render(givenFeedbackFormContent);

      // WHEN on the first step, select a checkbox option
      // The Checkbox is the second question in the first step (index 1)
      
      // 🚀 FIX 1: Use getAllByTestId for the specific checkbox option directly.
      // Since the Checkbox is the first question element using this Test ID on the page (though there could be multiple options),
      // we target the first option of the Checkbox component.
      const checkboxInput = screen.getAllByTestId(CHECKBOX_DATA_TEST_ID.CHECKBOX_OPTION)[0];
      fireEvent.click(checkboxInput);

      // AND move to next step
      const nextButton = screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_NEXT_BUTTON);
      fireEvent.click(nextButton);

      // AND on the second step, answer the yes/no question
      // The Yes/No is the second question in the second step (index 1)
      const yesNoInput = screen.getAllByTestId(YES_NO_DATA_TEST_ID.RADIO_YES)[1]; // second yes/no question's yes button
      fireEvent.click(yesNoInput);

      // AND move to next step
      fireEvent.click(nextButton);

      // AND on the last step, provide a custom rating comment
      // The Custom Rating is the first question in the last step (index 0)
      const customRatingInput = screen.getAllByTestId(CUSTOM_RATING_DATA_TEST_ID.CUSTOM_RATING_ICON)[4]; // 5th icon (rating 5)
      fireEvent.click(customRatingInput);

      // AND submit the form
      fireEvent.click(nextButton);

      // THEN expect mockHandleSubmit to have been called exactly once
      expect(mockHandleSubmit).toHaveBeenCalledTimes(1);

      // AND expect the exact answer data structure
      const submittedAnswers = mockHandleSubmit.mock.calls[0][0];
      expect(submittedAnswers).toHaveLength(3);

      // 🚀 FIX 2: Apply type assertion once for safety/clarity in assertions.
      const checkboxQuestion = mockFeedbackFormContentSteps[0].questions[1] as DetailedQuestion;

      // First step answer (checkbox)
      expect(submittedAnswers[0]).toEqual({
        question_id: checkboxQuestion.questionId,
        simplified_answer: {
          comment: "",
          rating_boolean: undefined,
          rating_numeric: undefined,
          // Access is now safe due to the type assertion above
          selected_options_keys: [checkboxQuestion.options![0].key],
        },
      });

      // Second step answer (yes/no)
      expect(submittedAnswers[1]).toEqual({
        question_id: mockFeedbackFormContentSteps[1].questions[1].questionId,
        simplified_answer: {
          comment: "",
          rating_boolean: true,
          rating_numeric: undefined,
          selected_options_keys: undefined,
        },
      });

      // Last step answer (custom rating)
      expect(submittedAnswers[2]).toEqual({
        question_id: mockFeedbackFormContentSteps[2].questions[0].questionId,
        simplified_answer: {
          comment: "",
          rating_boolean: undefined,
          rating_numeric: 5,
          selected_options_keys: undefined,
        }
      });

      // AND no errors or warnings to be shown
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });

    test("should call handleAnswerChange when a question is answered", () => {
      // GIVEN the FeedbackFormContent component
      const givenFeedbackFormContent = <FeedbackFormContent notifySubmit={jest.fn()} />;
      // AND the component is rendered
      render(givenFeedbackFormContent);

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
      render(<FeedbackFormContent notifySubmit={jest.fn()} />);
      // AND the swipe handlers
      const swipeHandlers = getSwipeHandlers(0);

      // WHEN the component is swiped left
      act(() => {
        swipeHandlers.onSwipedLeft();
      });

      // THEN expect to go to the next step
      expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_CONTENT_TITLE)).toHaveTextContent(
        mockFeedbackFormContentSteps[1].label
      );

      // AND WHEN the component is swiped left for again
      act(() => {
        // Must get the latest handler instance after state update
        getSwipeHandlers(-1).onSwipedLeft(); 
      });

      // THEN expect to go to the next step
      expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_CONTENT_TITLE)).toHaveTextContent(
        mockFeedbackFormContentSteps[2].label
      );

      // AND no errors or warnings to be shown
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });

    test("should go to the previous step when swiping right", () => {
      // GIVEN the component is rendered
      render(<FeedbackFormContent notifySubmit={jest.fn()} />);

      // WHEN the component is swiped left twice
      act(() => {
        getSwipeHandlers(0).onSwipedLeft();
      });
      act(() => {
        getSwipeHandlers(-1).onSwipedLeft();
      });

      // THEN expect to go to the third step
      expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_CONTENT_TITLE)).toHaveTextContent(
        mockFeedbackFormContentSteps[2].label
      );

      // WHEN the component is swiped right
      act(() => {
        getSwipeHandlers(-1).onSwipedRight();
      });

      // THEN expect to go to the previous step
      expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_CONTENT_TITLE)).toHaveTextContent(
        mockFeedbackFormContentSteps[1].label
      );

      // AND WHEN the component is swiped right again
      act(() => {
        getSwipeHandlers(-1).onSwipedRight();
      });

      // THEN expect to go to the previous step
      expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_CONTENT_TITLE)).toHaveTextContent(
        mockFeedbackFormContentSteps[0].label
      );

      // AND no errors or warnings to be shown
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });

    test("should do nothing when swiping right on the first step", () => {
      // GIVEN the component is rendered
      render(<FeedbackFormContent notifySubmit={jest.fn()} />);

      // WHEN the component is swiped right on the first step
      act(() => {
        getSwipeHandlers(0).onSwipedRight();
      });

      // THEN expect to stay on the first step
      expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_CONTENT_TITLE)).toHaveTextContent(
        mockFeedbackFormContentSteps[0].label
      );
    });

    test("should do nothing when swiping left on the last step", () => {
      // GIVEN the component is rendered
      render(<FeedbackFormContent notifySubmit={jest.fn()} />);

      // WHEN the component is swiped left to reach the last step
      act(() => {
        getSwipeHandlers(0).onSwipedLeft();
      });
      act(() => {
        getSwipeHandlers(-1).onSwipedLeft();
      });

      // THEN expect to reach the last step
      const lastStepTitle = mockFeedbackFormContentSteps[2].label;
      const lastStepTitleElement = screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_CONTENT_TITLE);
      expect(lastStepTitleElement).toHaveTextContent(lastStepTitle);

      // WHEN the component is swiped left on the last step
      act(() => {
        getSwipeHandlers(-1).onSwipedLeft();
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
      render(<FeedbackFormContent notifySubmit={jest.fn()} />);
      // AND we are on the last step
      act(() => {
        getSwipeHandlers(0).onSwipedLeft();
      });
      act(() => {
        getSwipeHandlers(-1).onSwipedLeft();
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
});