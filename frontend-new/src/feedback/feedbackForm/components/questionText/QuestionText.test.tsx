// mute the console
import "src/_test_utilities/consoleMock";

import QuestionText, { DATA_TEST_ID } from "src/feedback/feedbackForm/components/questionText/QuestionText";
import { render, screen } from "src/_test_utilities/test-utils";

describe("QuestionText", () => {
  test("should render component successfully", () => {
    // GIVEN the component
    const givenQuestionText = <QuestionText questionText="This is a random question text" />;

    // WHEN the component is rendered
    render(givenQuestionText);

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    // AND the question text to be in the document
    const questionText = screen.getByTestId(DATA_TEST_ID.QUESTION_TEXT);
    expect(questionText).toBeInTheDocument();
    // AND to match the snapshot
    expect(questionText).toMatchSnapshot();
  });
});
