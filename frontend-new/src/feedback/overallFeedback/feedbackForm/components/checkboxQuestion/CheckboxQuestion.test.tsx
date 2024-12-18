// mute the console
import "src/_test_utilities/consoleMock";
import { render, screen } from "src/_test_utilities/test-utils";
import { fireEvent } from "@testing-library/react";
import { QuestionType } from "src/feedback/overallFeedback/feedbackForm/feedbackForm.types";
import CheckboxQuestion, {
  CheckboxQuestionProps,
  DATA_TEST_ID,
} from "src/feedback/overallFeedback/feedbackForm/components/checkboxQuestion/CheckboxQuestion";
import { DATA_TEST_ID as COMMENT_TEXT_FIELD_TEST_ID } from "src/feedback/overallFeedback/feedbackForm/components/commentTextField/CommentTextField";

describe("CheckboxQuestion", () => {
  // mock question
  const mockQuestion: CheckboxQuestionProps = {
    type: QuestionType.Checkbox,
    questionId: "skills_experience",
    questionText: "What are your skills and experiences?",
    selectedOptions: ["javascript", "react"],
    notifyChange: jest.fn(),
    options: [
      { key: "javascript", value: "JavaScript" },
      { key: "react", value: "React" },
      { key: "typescript", value: "TypeScript" },
      { key: "nodejs", value: "Node.js" },
    ],
    comments: "I have experience with JavaScript and React",
  };

  test("should render component successfully", () => {
    // GIVEN the component
    const givenCheckboxQuestion = <CheckboxQuestion {...mockQuestion} />;

    // WHEN the component is rendered
    render(givenCheckboxQuestion);

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    // AND the checkbox question container to be in the document
    const checkboxQuestionContainer = screen.getByTestId(DATA_TEST_ID.FORM_CONTROL);
    expect(checkboxQuestionContainer).toBeInTheDocument();
    // AND the checkbox question text to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.FORM_LABEL)).toBeInTheDocument();
    // AND the checkbox question checkbox option to be in the document
    expect(screen.getAllByTestId(DATA_TEST_ID.CHECKBOX_OPTION)).toHaveLength(4);
    // AND the checkbox question text field to be in the document
    expect(screen.getByTestId(COMMENT_TEXT_FIELD_TEST_ID.COMMENT_TEXT_FIELD)).toBeInTheDocument();
    // AND to match the snapshot
    expect(checkboxQuestionContainer).toMatchSnapshot();
  });

  test("should call handleCheckboxChange when checkbox is changed", () => {
    // GIVEN the component
    const mockNotifyChange = jest.fn();
    const givenCheckboxQuestion = <CheckboxQuestion {...mockQuestion} notifyChange={mockNotifyChange} />;
    // AND the component is rendered
    render(givenCheckboxQuestion);

    // WHEN the checkbox is changed
    const checkboxOption = screen.getAllByTestId(DATA_TEST_ID.CHECKBOX_OPTION)[2];
    fireEvent.click(checkboxOption);

    // THEN expect the notifyChange function to have been called
    expect(mockNotifyChange).toHaveBeenCalled();
  });

  test("should call handleCommentChange when comment is changed", () => {
    // GIVEN the component
    const mockNotifyChange = jest.fn();
    const givenCheckboxQuestion = <CheckboxQuestion {...mockQuestion} notifyChange={mockNotifyChange} />;
    // AND the component is rendered
    render(givenCheckboxQuestion);

    // WHEN the comment text field is changed
    const commentTextField = screen.getByTestId(COMMENT_TEXT_FIELD_TEST_ID.COMMENT_TEXT_FIELD);
    fireEvent.change(commentTextField, { target: { value: "I have experience with  React and TypeScript" } });

    // THEN expect the notifyChange function to have been called
    expect(mockNotifyChange).toHaveBeenCalled();
  });

  test("should remove option from checkedOptions when checkbox is unchecked", () => {
    // GIVEN the component
    const mockNotifyChange = jest.fn();
    const givenCheckboxQuestion = <CheckboxQuestion {...mockQuestion} notifyChange={mockNotifyChange} />;
    // AND the component is rendered
    render(givenCheckboxQuestion);

    // WHEN the checkbox is checked
    const checkboxOption = screen.getAllByTestId(DATA_TEST_ID.CHECKBOX_OPTION)[1] as HTMLInputElement;
    checkboxOption.checked = true;
    // AND the checkbox is unchecked
    fireEvent.click(checkboxOption);

    // THEN expect the notifyChange function to have been called with the updated options
    expect(mockNotifyChange).toHaveBeenCalledWith(["javascript"], "I have experience with JavaScript and React");
  });
});
