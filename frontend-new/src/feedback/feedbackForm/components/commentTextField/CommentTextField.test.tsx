// mute the console
import "src/_test_utilities/consoleMock";

import CommentTextField, { DATA_TEST_ID } from "src/feedback/feedbackForm/components/commentTextField/CommentTextField";
import { render, screen } from "src/_test_utilities/test-utils";

describe("CommentTextField", () => {
  test("should render component successfully", () => {
    // GIVEN the component
    const givenCommentTextField = <CommentTextField placeholder="bar" value="foo" onChange={jest.fn()} />;

    // WHEN the component is rendered
    render(givenCommentTextField);

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    // AND the comment text field to be in the document
    const commentTextField = screen.getByTestId(DATA_TEST_ID.COMMENT_TEXT_FIELD);
    expect(commentTextField).toBeInTheDocument();
    // AND to match the snapshot
    expect(commentTextField).toMatchSnapshot();
  });
});