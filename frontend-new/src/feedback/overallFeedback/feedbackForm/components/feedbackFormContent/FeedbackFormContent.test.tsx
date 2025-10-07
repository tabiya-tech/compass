import "src/_test_utilities/consoleMock";
import { render, screen, fireEvent, act } from "src/_test_utilities/test-utils";
import FeedbackFormContent, { DATA_TEST_ID } from "src/feedback/overallFeedback/feedbackForm/components/feedbackFormContent/FeedbackFormContent";
import getFeedbackFormContentSteps from "src/feedback/overallFeedback/feedbackForm/components/feedbackFormContent/feedbackFormContentSteps";
import { useSwipeable } from "react-swipeable";
import i18next from "i18next";
import { DATA_TEST_ID as CHECKBOX_DATA_TEST_ID } from "src/feedback/overallFeedback/feedbackForm/components/checkboxQuestion/CheckboxQuestion";
import { DATA_TEST_ID as YES_NO_DATA_TEST_ID } from "src/feedback/overallFeedback/feedbackForm/components/yesNoQuestion/YesNoQuestion";
import { DATA_TEST_ID as CUSTOM_RATING_DATA_TEST_ID } from "src/feedback/overallFeedback/feedbackForm/components/customRating/CustomRating";
import { DATA_TEST_ID as COMMENT_TEXT_FIELD_TEST_ID } from "src/feedback/overallFeedback/feedbackForm/components/commentTextField/CommentTextField";
import { mockBrowserIsOnLine } from "src/_test_utilities/mockBrowserIsOnline";

// mock the swipeable hook
jest.mock("react-swipeable");

// mock the framer-motion library
jest.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: { children: React.ReactElement }) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactElement }) => <>{children}</>,
}));

const feedbackFormContentSteps = getFeedbackFormContentSteps(i18next.t);

describe("FeedbackFormContent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

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
        feedbackFormContentSteps[1].label
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
        feedbackFormContentSteps[0].label
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
      const checkboxInput = screen.getAllByTestId(CHECKBOX_DATA_TEST_ID.CHECKBOX_OPTION)[0];
      fireEvent.click(checkboxInput);

      // AND move to next step
      const nextButton = screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_NEXT_BUTTON);
      fireEvent.click(nextButton);

      // AND on the second step, answer the yes/no question
      const yesNoInput = screen.getAllByTestId(YES_NO_DATA_TEST_ID.RADIO_YES)[1];
      fireEvent.click(yesNoInput);

      // AND move to next step
      fireEvent.click(nextButton);

      // AND on the last step, provide a custom rating comment
      const customRatingInput = screen.getAllByTestId(CUSTOM_RATING_DATA_TEST_ID.CUSTOM_RATING_ICON)[4];
      fireEvent.click(customRatingInput);

      // AND submit the form
      fireEvent.click(nextButton);

      // THEN expect mockHandleSubmit to have been called exactly once
      expect(mockHandleSubmit).toHaveBeenCalledTimes(1);

      // AND expect the exact answer data structure
      const submittedAnswers = mockHandleSubmit.mock.calls[0][0];
      expect(submittedAnswers).toHaveLength(3);

      // First step answer (checkbox)
      expect(submittedAnswers[0]).toEqual({
        question_id: feedbackFormContentSteps[0].questions[1].questionId,
        simplified_answer: {
          comment: "",
          rating_boolean: undefined,
          rating_numeric: undefined,
          selected_options_keys: [feedbackFormContentSteps[0].questions[1].options![0].key],
        },
      });

      // Second step answer (yes/no)
      expect(submittedAnswers[1]).toEqual({
        question_id: feedbackFormContentSteps[1].questions[1].questionId,
        simplified_answer: {
          comment: "",
          rating_boolean: true,
          rating_numeric: undefined,
          selected_options_keys: undefined,
        },
      });

      // Last step answer (custom rating)
      expect(submittedAnswers[2]).toEqual({
        question_id: feedbackFormContentSteps[2].questions[0].questionId,
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
      const swipeHandlers = (useSwipeable as jest.Mock).mock.calls[0][0];

      // WHEN the component is swiped left
      act(() => {
        swipeHandlers.onSwipedLeft();
      });

      // THEN expect to go to the next step
      expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_CONTENT_TITLE)).toHaveTextContent(
        feedbackFormContentSteps[1].label
      );

      // AND WHEN the component is swiped left for again
      act(() => {
        swipeHandlers.onSwipedLeft();
      });

      // THEN expect to go to the next step
      expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_CONTENT_TITLE)).toHaveTextContent(
        feedbackFormContentSteps[2].label
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
        (useSwipeable as jest.Mock).mock.calls[0][0].onSwipedLeft();
        (useSwipeable as jest.Mock).mock.calls[0][0].onSwipedLeft();
      });

      // THEN expect to go to the third
      expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_CONTENT_TITLE)).toHaveTextContent(
        feedbackFormContentSteps[2].label
      );

      // WHEN the component is swiped right
      act(() => {
        (useSwipeable as jest.Mock).mock.calls.at(-1)[0].onSwipedRight();
      });

      // THEN expect to go to the previous step
      expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_CONTENT_TITLE)).toHaveTextContent(
        feedbackFormContentSteps[1].label
      );

      // AND WHEN the component is swiped right again
      act(() => {
        (useSwipeable as jest.Mock).mock.calls.at(-1)[0].onSwipedRight();
      });

      // THEN expect to go to the previous step
      expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_CONTENT_TITLE)).toHaveTextContent(
        feedbackFormContentSteps[0].label
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
        (useSwipeable as jest.Mock).mock.calls[0][0].onSwipedRight();
      });

      // THEN expect to stay on the first step
      expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_CONTENT_TITLE)).toHaveTextContent(
        feedbackFormContentSteps[0].label
      );
    });

    test("should do nothing when swiping left on the last step", () => {
      // GIVEN the component is rendered
      render(<FeedbackFormContent notifySubmit={jest.fn()} />);

      // WHEN the component is swiped left to reach the last step
      act(() => {
        (useSwipeable as jest.Mock).mock.calls[0][0].onSwipedLeft();
      });
      act(() => {
        (useSwipeable as jest.Mock).mock.calls[1][0].onSwipedLeft();
      });

      // THEN expect to reach the last step
      const lastStepTitle = feedbackFormContentSteps[2].label;
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
      render(<FeedbackFormContent notifySubmit={jest.fn()} />);
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
});