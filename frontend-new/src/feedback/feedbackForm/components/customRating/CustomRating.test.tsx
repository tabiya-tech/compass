// mute the console
import "src/_test_utilities/consoleMock";

import CustomRating, {
  CustomRatingProps,
  DATA_TEST_ID,
} from "src/feedback/feedbackForm/components/customRating/CustomRating";
import { render, screen } from "src/_test_utilities/test-utils";
import { fireEvent } from "@testing-library/react";
import { QuestionType } from "src/feedback/feedbackForm/feedback.types";

describe("CustomRating", () => {
  // mock question
  const mockQuestion: CustomRatingProps = {
    type: QuestionType.Rating,
    questionText: "How would you rate the overall experience?",
    questionId: "overall_experience",
    ratingValue: 6,
    displayRating: true,
    lowRatingLabel: "Very Difficult",
    highRatingLabel: "Very Easy",
    notifyChange: jest.fn(),
  }

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
    expect(screen.getByTestId(DATA_TEST_ID.CUSTOM_RATING_TEXT)).toBeInTheDocument();
    // AND the custom rating comments to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.CUSTOM_RATING_FIELD)).toBeInTheDocument();
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
    const commentTextField = screen.getByTestId(DATA_TEST_ID.CUSTOM_RATING_FIELD);
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
    const stars = screen.getAllByTestId(DATA_TEST_ID.CUSTOM_RATING_ICON)
    fireEvent.click(stars[2])

    // THEN expect the notifyChange function to have been called
    expect(mockNotifyChange).toHaveBeenCalled();
  });
});