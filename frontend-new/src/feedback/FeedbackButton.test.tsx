// mute the console
import "src/_test_utilities/consoleMock";

import { render, screen, waitFor } from "src/_test_utilities/test-utils";
import FeedbackButton, { DATA_TEST_ID } from "./FeedbackButton";
import * as Sentry from "@sentry/react";

describe("FeedbackButton component", () => {
  beforeEach(() => {
    (console.error as jest.Mock).mockClear();
    (console.warn as jest.Mock).mockClear();
    jest.clearAllMocks();
  });

  test("should render the feedback button", () => {
    // GIVEN a FeedbackButton component
    // WHEN the component is rendered
    render(<FeedbackButton />);

    // THEN expect no errors or warnings to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();

    // AND expect the button container to be in the document
    const buttonContainer = screen.getByTestId(DATA_TEST_ID.FEEDBACK_BUTTON_CONTAINER);
    expect(buttonContainer).toBeInTheDocument();

    // AND expect the button to be in the document
    const button = screen.getByTestId(DATA_TEST_ID.FEEDBACK_BUTTON);
    expect(button).toBeInTheDocument();

    // AND expect the BugReport icon to be present
    const bugReportIcon = screen.getByTestId(DATA_TEST_ID.FEEDBACK_ICON);
    expect(bugReportIcon).toBeInTheDocument();

    // AND expect the component to match the snapshot
    expect(buttonContainer).toMatchSnapshot();
  });

  test("should attach Sentry feedback when available", async () => {
    // GIVEN a mock implementation of Sentry.getFeedback
    const mockAttachTo = jest.fn();
    (Sentry.getFeedback as jest.Mock).mockReturnValue({
      attachTo: mockAttachTo,
    });

    // WHEN the component is rendered
    render(<FeedbackButton />);

    // THEN expect Sentry.getFeedback to have been called
    expect(Sentry.getFeedback).toHaveBeenCalled();

    // AND expect the attachTo method to have been called with the button container element
    await waitFor(() => {
      expect(mockAttachTo).toHaveBeenCalledWith(expect.any(HTMLDivElement));
    });

    // AND expect no errors or warnings to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should not attach Sentry feedback when not available", () => {
    // GIVEN Sentry.getFeedback returns undefined
    (Sentry.getFeedback as jest.Mock).mockReturnValue(undefined);

    // WHEN the component is rendered
    render(<FeedbackButton />);

    // THEN expect Sentry.getFeedback to have been called
    expect(Sentry.getFeedback).toHaveBeenCalled();

    // AND expect the component to render without errors
    const buttonContainer = screen.getByTestId(DATA_TEST_ID.FEEDBACK_BUTTON_CONTAINER);
    expect(buttonContainer).toBeInTheDocument();

    // AND expect no errors or warnings to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });
});
