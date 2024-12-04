// mute the console
import "src/_test_utilities/consoleMock";

import YesNoQuestion, {
  DATA_TEST_ID,
  YesNoQuestionProps,
} from "src/feedback/feedbackForm/components/yesNoQuestion/YesNoQuestion";
import { render, screen } from "src/_test_utilities/test-utils";
import { fireEvent } from "@testing-library/react";
import { QuestionType, YesNoEnum } from "src/feedback/feedbackForm/feedback.types";
import  {DATA_TEST_ID as COMMENT_TEXT_FIELD_TEST_ID} from "src/feedback/feedbackForm/components/commentTextField/CommentTextField";

describe("YesNoQuestion", () => {
  // mock question
  const mockQuestion: YesNoQuestionProps = {
    type: QuestionType.YesNo,
    questionText: "Do you like the product?",
    questionId: "like_product",
    ratingValue: true,
    showCommentsOn: YesNoEnum.Yes,
    notifyChange: jest.fn(),
  };

  test("should render component successfully", () => {
    // GIVEN the component
    const givenYesNoQuestion = <YesNoQuestion {...mockQuestion} />;

    // WHEN the component is rendered
    render(givenYesNoQuestion);

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    // AND the yes no question container to be in the document
    const yesNoQuestionContainer = screen.getByTestId(DATA_TEST_ID.FORM_CONTROL);
    expect(yesNoQuestionContainer).toBeInTheDocument();
    // AND the yes no question label to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.FORM_LABEL)).toBeInTheDocument();
    // AND the yes no question radio yes to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.RADIO_YES)).toBeInTheDocument();
    // AND the yes no question radio no to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.RADIO_NO)).toBeInTheDocument();
    // AND the yes no question text field to be in the document
    expect(screen.getByTestId(COMMENT_TEXT_FIELD_TEST_ID.COMMENT_TEXT_FIELD)).toBeInTheDocument();
    // AND to match the snapshot
    expect(yesNoQuestionContainer).toMatchSnapshot();
  });

  test("should call handleCommentChange when comment is changed", () => {
    // GIVEN the component
    const mockNotifyChange = jest.fn();
    const givenYesNoQuestion = <YesNoQuestion {...mockQuestion} notifyChange={mockNotifyChange} />;
    // AND the component is rendered
    render(givenYesNoQuestion);

    // WHEN the comment text field is changed
    const commentTextField = screen.getByTestId(COMMENT_TEXT_FIELD_TEST_ID.COMMENT_TEXT_FIELD);
    fireEvent.change(commentTextField, { target: { value: "This is a comment" } });

    // THEN expect the notifyChange function to have been called
    expect(mockNotifyChange).toHaveBeenCalled();
  });

  test("should call handleChange when radio button is clicked", () => {
    // GIVEN the component
    const mockNotifyChange = jest.fn();
    const givenYesNoQuestion = <YesNoQuestion {...mockQuestion} notifyChange={mockNotifyChange} />;
    // AND the component is rendered
    render(givenYesNoQuestion);

    // WHEN the radio button is changed
    const radioNo = screen.getByTestId(DATA_TEST_ID.RADIO_NO);
    fireEvent.click(radioNo);

    // THEN expect the notifyChange function to have been called
    expect(mockNotifyChange).toHaveBeenCalled();
  });
});
