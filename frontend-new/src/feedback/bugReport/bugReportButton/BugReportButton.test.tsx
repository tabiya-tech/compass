// standard sentry mock
import "src/_test_utilities/sentryMock"
// mute the console
import "src/_test_utilities/consoleMock";

import { fireEvent, render, screen, waitFor } from "src/_test_utilities/test-utils";
import BugReportButton, { DATA_TEST_ID } from "src/feedback/bugReport/bugReportButton/BugReportButton";
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
    // GIVEN sentry is initialized
    (Sentry.isInitialized as jest.Mock).mockReturnValue(true);
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
    // GIVEN sentry is initialized
    (Sentry.isInitialized as jest.Mock).mockReturnValue(true);

    // WHEN the component is rendered on a mobile device
    render(<BugReportButton />);

    // THEN expect the button container to be in the document
    const buttonContainer = screen.getByTestId(DATA_TEST_ID.BUG_REPORT_BUTTON_CONTAINER);
    expect(buttonContainer).toBeInTheDocument();
    // AND expect the icon to be in the document
    const bugReportIcon = screen.getByTestId(DATA_TEST_ID.BUG_REPORT_ICON);
    expect(bugReportIcon).toBeInTheDocument();
  });

  test("should not show anything when Sentry is not initialized", () => {
    // GIVEN Sentry is not initialized
    (Sentry.isInitialized as jest.Mock).mockReturnValue(false);

    // WHEN the component is rendered
    render(<BugReportButton />);

    // THEN expect Sentry.isInitialized to have been called
    expect(Sentry.isInitialized).toHaveBeenCalled();

    // AND expect the component to render without errors
    const buttonContainer = screen.queryByTestId(DATA_TEST_ID.BUG_REPORT_BUTTON_CONTAINER);
    expect(buttonContainer).not.toBeInTheDocument();

    // AND expect no errors or warnings to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should attach Sentry bugReport when available", async () => {
    // GIVEN a mock implementation of Sentry.getFeedback and createForm
    const mockOpen = jest.fn();
    const mockAppendToDom = jest.fn();
    const mockCreateForm = jest.fn().mockResolvedValue({
      appendToDom: mockAppendToDom,
      open: mockOpen,
    });
    (Sentry.getFeedback as jest.Mock).mockReturnValue({
      createForm: mockCreateForm,
    });
    // AND sentry is initialized
    (Sentry.isInitialized as jest.Mock).mockReturnValue(true);

    // WHEN the component is rendered
    render(<BugReportButton />);

    // AND the user clicks the button
    const button = screen.getByTestId(DATA_TEST_ID.BUG_REPORT_BUTTON);
    fireEvent.click(button);

    // THEN expect Sentry.getFeedback to have been called
    expect(Sentry.getFeedback).toHaveBeenCalled();

    // AND expect the form to be created and opened with translations
    await waitFor(() => expect(mockCreateForm).toHaveBeenCalled());
    await waitFor(() => expect(mockAppendToDom).toHaveBeenCalled());
    await waitFor(() => expect(mockOpen).toHaveBeenCalled());

    // AND expect no errors or warnings to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should not attach Sentry bugReport when not available", () => {
    // GIVEN Sentry.getFeedback returns undefined
    (Sentry.getFeedback as jest.Mock).mockReturnValue(undefined);
    // AND sentry is initialized
    (Sentry.isInitialized as jest.Mock).mockReturnValue(true);

    // WHEN the component is rendered
    render(<BugReportButton />);

    // AND the user clicks the button
    const button = screen.getByTestId(DATA_TEST_ID.BUG_REPORT_BUTTON);
    fireEvent.click(button);

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
