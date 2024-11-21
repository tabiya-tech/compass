// mute the console
import "src/_test_utilities/consoleMock";

import { render, screen, waitFor } from "src/_test_utilities/test-utils";
import BugReportButton, { DATA_TEST_ID } from "src/feedback/bugReportButton/BugReportButton";
import * as Sentry from "@sentry/react";
import { useMediaQuery } from "@mui/material";

// Mock useMediaQuery
jest.mock("@mui/material", () => ({
  ...jest.requireActual("@mui/material"),
  useMediaQuery: jest.fn(),
}));

describe("BugReportButton component", () => {
  beforeEach(() => {
    (console.error as jest.Mock).mockClear();
    (console.warn as jest.Mock).mockClear();
    jest.clearAllMocks();
  });

  test("should render the bugReport button", () => {
    // GIVEN a BugReportButton component
    // WHEN the component is rendered
    render(<BugReportButton />);

    // THEN expect no errors or warnings to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();

    // AND expect the button container to be in the document
    const buttonContainer = screen.getByTestId(DATA_TEST_ID.BUG_REPORT_BUTTON_CONTAINER);
    expect(buttonContainer).toBeInTheDocument();

    // AND expect the button to be in the document
    const button = screen.getByTestId(DATA_TEST_ID.BUG_REPORT_BUTTON);
    expect(button).toBeInTheDocument();

    // AND expect the BugReport icon to be present
    const bugReportIcon = screen.getByTestId(DATA_TEST_ID.BUG_REPORT_ICON);
    expect(bugReportIcon).toBeInTheDocument();

    // AND expect the component to match the snapshot
    expect(buttonContainer).toMatchSnapshot();
  });

  test("should render the bugReport icon on mobile devices", () => {
    // Mock useMediaQuery to return true for mobile
    (useMediaQuery as jest.Mock).mockReturnValue(true);

    // GIVEN a BugReportButton component
    const givenComponent = <BugReportButton />;

    // WHEN the component is rendered on a mobile device
    render(givenComponent);

    // THEN expect the button container to be in the document
    const buttonContainer = screen.getByTestId(DATA_TEST_ID.BUG_REPORT_BUTTON_CONTAINER);
    expect(buttonContainer).toBeInTheDocument();
    // AND expect the icon to be in the document
    const bugReportIcon = screen.getByTestId(DATA_TEST_ID.BUG_REPORT_ICON);
    expect(bugReportIcon).toBeInTheDocument();
  });

  test("should attach Sentry bugReport when available", async () => {
    // GIVEN a mock implementation of Sentry.getFeedback
    const mockAttachTo = jest.fn();
    (Sentry.getFeedback as jest.Mock).mockReturnValue({
      attachTo: mockAttachTo,
    });

    // WHEN the component is rendered
    render(<BugReportButton />);

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

  test("should not attach Sentry bugReport when not available", () => {
    // GIVEN Sentry.getFeedback returns undefined
    (Sentry.getFeedback as jest.Mock).mockReturnValue(undefined);

    // WHEN the component is rendered
    render(<BugReportButton />);

    // THEN expect Sentry.getFeedback to have been called
    expect(Sentry.getFeedback).toHaveBeenCalled();

    // AND expect the component to render without errors
    const buttonContainer = screen.getByTestId(DATA_TEST_ID.BUG_REPORT_BUTTON_CONTAINER);
    expect(buttonContainer).toBeInTheDocument();

    // AND expect no errors or warnings to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });
});
