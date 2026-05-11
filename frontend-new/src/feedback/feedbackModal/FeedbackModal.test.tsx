import "src/_test_utilities/consoleMock";

import { fireEvent, render, screen, waitFor } from "src/_test_utilities/test-utils";
import FeedbackModal, { DATA_TEST_ID } from "src/feedback/feedbackModal/FeedbackModal";

describe("FeedbackModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should not render dialog content when closed", () => {
    render(<FeedbackModal isOpen={false} onClose={jest.fn()} onSubmit={jest.fn()} />);
    expect(screen.queryByTestId(DATA_TEST_ID.FEEDBACK_MODAL_TITLE)).not.toBeInTheDocument();
  });

  test("should render the modal with default selections when open", () => {
    render(<FeedbackModal isOpen={true} onClose={jest.fn()} onSubmit={jest.fn()} />);

    // THEN expect title, subtitle, type pills, priority pills, message field, and buttons
    expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_MODAL_TITLE)).toBeInTheDocument();
    expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_MODAL_SUBTITLE)).toBeInTheDocument();
    expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_MODAL_TYPE_OPTION("bug"))).toBeInTheDocument();
    expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_MODAL_TYPE_OPTION("feedback"))).toBeInTheDocument();
    expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_MODAL_TYPE_OPTION("idea"))).toBeInTheDocument();
    expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_MODAL_PRIORITY_OPTION("low"))).toBeInTheDocument();
    expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_MODAL_PRIORITY_OPTION("medium"))).toBeInTheDocument();
    expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_MODAL_PRIORITY_OPTION("high"))).toBeInTheDocument();

    // AND expect default selections: bug + medium
    expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_MODAL_TYPE_OPTION("bug"))).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_MODAL_PRIORITY_OPTION("medium"))).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  test("should disable Send button when message is empty", () => {
    render(<FeedbackModal isOpen={true} onClose={jest.fn()} onSubmit={jest.fn()} />);

    expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_MODAL_SEND)).toBeDisabled();
  });

  test("should call onSubmit with the selected type, priority, and message when Send is clicked", async () => {
    const onSubmit = jest.fn();
    const onClose = jest.fn();
    render(<FeedbackModal isOpen={true} onClose={onClose} onSubmit={onSubmit} />);

    // Switch type to idea
    fireEvent.click(screen.getByTestId(DATA_TEST_ID.FEEDBACK_MODAL_TYPE_OPTION("idea")));
    // Switch priority to high
    fireEvent.click(screen.getByTestId(DATA_TEST_ID.FEEDBACK_MODAL_PRIORITY_OPTION("high")));

    // Enter a message
    const textarea = screen.getByTestId(DATA_TEST_ID.FEEDBACK_MODAL_MESSAGE).querySelector("textarea");
    expect(textarea).not.toBeNull();
    fireEvent.change(textarea!, { target: { value: "  My feedback  " } });

    // Click send
    fireEvent.click(screen.getByTestId(DATA_TEST_ID.FEEDBACK_MODAL_SEND));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        type: "idea",
        priority: "high",
        message: "My feedback",
      });
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  test("should call onClose when Cancel is clicked", () => {
    const onClose = jest.fn();
    render(<FeedbackModal isOpen={true} onClose={onClose} onSubmit={jest.fn()} />);

    fireEvent.click(screen.getByTestId(DATA_TEST_ID.FEEDBACK_MODAL_CANCEL));

    expect(onClose).toHaveBeenCalled();
  });
});
