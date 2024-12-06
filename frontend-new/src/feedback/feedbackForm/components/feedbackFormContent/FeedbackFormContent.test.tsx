// mute the console
import "src/_test_utilities/consoleMock";

import { render, screen } from "src/_test_utilities/test-utils";
import { fireEvent } from "@testing-library/react";
import { DATA_TEST_ID as CUSTOM_RATING_DATA_TEST_ID } from "src/feedback/feedbackForm/components/customRating/CustomRating";
import { DATA_TEST_ID as YES_NO_DATA_TEST_ID } from "src/feedback/feedbackForm/components/yesNoQuestion/YesNoQuestion";
import FeedbackFormContent, {
  DATA_TEST_ID,
} from "src/feedback/feedbackForm/components/feedbackFormContent/FeedbackFormContent";
import { DATA_TEST_ID as CHECKBOX_DATA_TEST_ID } from "src/feedback/feedbackForm/components/checkboxQuestion/CheckboxQuestion";
import stepsContent from "src/feedback/feedbackForm/stepsContent";
import { DATA_TEST_ID as COMMENT_TEXT_FIELD_TEST_ID } from "src/feedback/feedbackForm/components/commentTextField/CommentTextField";

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
      expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_CONTENT_TITLE)).toHaveTextContent(stepsContent[1].label);
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
      expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_CONTENT_TITLE)).toHaveTextContent(stepsContent[0].label);
    });

    test("should call handleSubmit with exact answer data when answering each step", () => {
      // GIVEN the FeedbackFormContent component
      const mockHandleSubmit = jest.fn();
      const givenFeedbackFormContent = <FeedbackFormContent notifySubmit={mockHandleSubmit} />;
      // AND the component is rendered
      render(givenFeedbackFormContent);

      // WHEN on the first step, answer rating question
      const starRating = screen.getAllByTestId(CUSTOM_RATING_DATA_TEST_ID.CUSTOM_RATING_ICON)[4];
      fireEvent.click(starRating);

      // AND move to next step
      const nextButton = screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_NEXT_BUTTON);
      fireEvent.click(nextButton);

      // AND on the second step, select a checkbox option
      const checkboxInput = screen.getAllByTestId(CHECKBOX_DATA_TEST_ID.CHECKBOX_OPTION)[0];
      fireEvent.click(checkboxInput);

      // AND move to next step
      fireEvent.click(nextButton);

      // AND on the third step, answer the yes/no question
      const yesNoInput = screen.getAllByTestId(YES_NO_DATA_TEST_ID.RADIO_YES)[1];
      fireEvent.click(yesNoInput);

      // AND move to next step
      fireEvent.click(nextButton);

      // AND on the last step, provide a custom rating comment
      const customRatingInput = screen.getAllByTestId(CUSTOM_RATING_DATA_TEST_ID.CUSTOM_RATING_ICON)[8];
      fireEvent.click(customRatingInput);


      // AND submit the form
      fireEvent.click(nextButton);

      // THEN expect mockHandleSubmit to have been called exactly once
      expect(mockHandleSubmit).toHaveBeenCalledTimes(1);

      // AND expect the exact answer data structure
      const submittedAnswers = mockHandleSubmit.mock.calls[0][0];
      expect(submittedAnswers).toHaveLength(4);

      // First step answer (custom rating)
      expect(submittedAnswers[0]).toEqual({
        question_id: stepsContent[0].questions[0].questionId,
        answer: {
          comment: "",
          rating_boolean: undefined,
          rating_numeric: 5,
          selected_options: undefined,
        },
        is_answered: true,
      });

      // Second step answer (checkbox)
      expect(submittedAnswers[1]).toEqual({
        question_id: stepsContent[1].questions[1].questionId,
        answer: {
          comment: "",
          rating_boolean: undefined,
          rating_numeric: undefined,
          selected_options: [stepsContent[1].questions[1].options![0].key],
        },
        is_answered: true,
      });

      // Third step answer (yes/no)
      expect(submittedAnswers[2]).toEqual({
        question_id: stepsContent[2].questions[1].questionId,
        answer: {
          comment: "",
          rating_boolean: true,
          rating_numeric: undefined,
          selected_options: undefined,
        },
        is_answered: true,
      });

      // Last step answer (custom rating)
      expect(submittedAnswers[3]).toEqual({
        question_id: stepsContent[3].questions[0].questionId,
        answer: {
          comment: "",
          rating_boolean: undefined,
          rating_numeric: 9,
          selected_options: undefined,
        },
        is_answered: true,
      });
    });

    test("should call handleAnswerChange when a question is answered", () => {
      // GIVEN the FeedbackFormContent component
      const givenFeedbackFormContent = <FeedbackFormContent notifySubmit={jest.fn()} />;
      // AND the component is rendered
      render(givenFeedbackFormContent);

      // WHEN question is answered
      const customRating = screen.getAllByTestId(CUSTOM_RATING_DATA_TEST_ID.CUSTOM_RATING_ICON)[4];
      fireEvent.click(customRating);

      const input = screen.getByTestId(COMMENT_TEXT_FIELD_TEST_ID.COMMENT_TEXT_FIELD);
      fireEvent.change(input, { target: { value: "This is a comment" } });

      // THEN expect the answer to be saved
      expect(input).toHaveValue("This is a comment");
    });
  });
});
