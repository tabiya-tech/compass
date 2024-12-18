// mute the console
import "src/_test_utilities/consoleMock";

import CustomRating, {
  CustomRatingProps,
  DATA_TEST_ID,
} from "src/feedback/overallFeedback/feedbackForm/components/customRating/CustomRating";
import { render, screen } from "src/_test_utilities/test-utils";
import { fireEvent } from "@testing-library/react";
import { QuestionType } from "src/feedback/overallFeedback/feedbackForm/feedbackForm.types";
import { DATA_TEST_ID as QUESTION_TEXT_DATA_TEST_ID } from "src/feedback/overallFeedback/feedbackForm/components/questionText/QuestionText";
import { DATA_TEST_ID as COMMENT_TEXT_FIELD_TEST_ID } from "src/feedback/overallFeedback/feedbackForm/components/commentTextField/CommentTextField";

describe("CustomRating", () => {
  // mock question
  const mockQuestion: CustomRatingProps = {
    type: QuestionType.Rating,
    questionText: "How would you rate the overall experience?",
    questionId: "overall_experience",
    placeholder: "Please provide your feedback here",
    ratingValue: 6,
    displayRating: true,
    lowRatingLabel: "Very Difficult",
    highRatingLabel: "Very Easy",
    notifyChange: jest.fn(),
    maxRating: 5,
  };

  test("should render component successfully", () => {
    // GIVEN the component
    const givenCustomRating = <CustomRating {...mockQuestion} />;

    // WHEN the component is rendered
    render(givenCustomRating);

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    // AND the custom rating container to be in the document
    const customRatingContainer = screen.getByTestId(DATA_TEST_ID.CUSTOM_RATING_CONTAINER);
    expect(customRatingContainer).toBeInTheDocument();
    // AND the custom rating label to be in the document
    expect(screen.getByTestId(QUESTION_TEXT_DATA_TEST_ID.QUESTION_TEXT)).toBeInTheDocument();
    // AND the custom rating comments to be in the document
    expect(screen.getByTestId(COMMENT_TEXT_FIELD_TEST_ID.COMMENT_TEXT_FIELD)).toBeInTheDocument();
    // AND the custom rating low label to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.CUSTOM_RATING_LOW_LABEL)).toBeInTheDocument();
    // AND the custom rating high label to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.CUSTOM_RATING_HIGH_LABEL)).toBeInTheDocument();
    // AND to match the snapshot
    expect(customRatingContainer).toMatchSnapshot();
  });

  test("should call handleCommentChange when comment is changed", () => {
    // GIVEN the component
    const mockNotifyChange = jest.fn();
    const givenCustomRating = <CustomRating {...mockQuestion} notifyChange={mockNotifyChange} />;
    // AND the component is rendered
    render(givenCustomRating);

    // WHEN the comment text field is changed
    const commentTextField = screen.getByTestId(COMMENT_TEXT_FIELD_TEST_ID.COMMENT_TEXT_FIELD);
    fireEvent.change(commentTextField, { target: { value: "This is a comment" } });

    // THEN expect the notifyChange function to have been called
    expect(mockNotifyChange).toHaveBeenCalled();
  });

  test("should call handleRatingChange when rating value is changed", () => {
    // GIVEN the component
    const mockNotifyChange = jest.fn();
    const givenCustomRating = <CustomRating {...mockQuestion} notifyChange={mockNotifyChange} />;
    // AND the component is rendered
    render(givenCustomRating);

    // WHEN the rating is changed
    const stars = screen.getAllByTestId(DATA_TEST_ID.CUSTOM_RATING_ICON);
    fireEvent.click(stars[2]);

    // THEN expect the notifyChange function to have been called
    expect(mockNotifyChange).toHaveBeenCalled();
  });

  test.each([20, 5, 1])("should show the expected number of stars for a max rating of %s", (givenMaxRating: number) => {
    // GIVEN the component
    const mockNotifyChange = jest.fn();
    const givenQuestion = {
      ...mockQuestion,
      maxRating: givenMaxRating,
    };
    const givenCustomRating = <CustomRating {...givenQuestion} notifyChange={mockNotifyChange} />;
    // AND the component is rendered
    render(givenCustomRating);

    // WHEN the rating is changed
    const stars = screen.getAllByTestId(DATA_TEST_ID.CUSTOM_RATING_ICON);

    // THEN expect the number of stars to match the max rating
    expect(stars).toHaveLength(givenMaxRating);
  });

  test("should show no stars when max rating is 0", () => {
    // GIVEN the component
    const mockNotifyChange = jest.fn();
    const givenQuestion = {
      ...mockQuestion,
      maxRating: 0,
    };
    const givenCustomRating = <CustomRating {...givenQuestion} notifyChange={mockNotifyChange} />;
    // AND the component is rendered
    render(givenCustomRating);

    // WHEN the rating is changed
    const stars = screen.queryAllByTestId(DATA_TEST_ID.CUSTOM_RATING_ICON);

    // THEN expect no stars to be rendered
    expect(stars).toHaveLength(0);
  });
});
