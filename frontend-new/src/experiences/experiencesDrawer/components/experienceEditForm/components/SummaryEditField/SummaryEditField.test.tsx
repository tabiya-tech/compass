import "src/_test_utilities/consoleMock";
import React from "react";
import { render, screen, fireEvent, waitFor, act, within } from "src/_test_utilities/test-utils";
import userEvent from "@testing-library/user-event";
import SummaryEditField, { DATA_TEST_ID } from "src/experiences/experiencesDrawer/components/experienceEditForm/components/SummaryEditField/SummaryEditField";
import ExperienceService from "src/experiences/experienceService/experienceService";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { ExperienceError } from "src/error/commonErrors";
import { Experience, SUMMARY_MAX_LENGTH } from "src/experiences/experienceService/experiences.types";
import { mockBrowserIsOnLine } from "src/_test_utilities/mockBrowserIsOnline";
import { resetAllMethodMocks } from "src/_test_utilities/resetAllMethodMocks";

jest.mock("src/theme/SnackbarProvider/SnackbarProvider", () => {
  const actual = jest.requireActual("src/theme/SnackbarProvider/SnackbarProvider");
  return {
    ...actual,
    __esModule: true,
    useSnackbar: jest.fn().mockReturnValue({
      enqueueSnackbar: jest.fn(),
      closeSnackbar: jest.fn(),
    }),
  };
});

const mockNotifyOnChange = jest.fn();
const mockEnqueueSnackbar = require("src/theme/SnackbarProvider/SnackbarProvider").useSnackbar().enqueueSnackbar;

const defaultProps = {
  summary: "This is a summary of the experience.",
  experience_uuid: "exp-uuid-123",
  notifyOnChange: mockNotifyOnChange,
};

describe("SummaryEditField", () => {
  beforeEach(() => {
    mockBrowserIsOnLine(true);
    jest.clearAllMocks();
    // Mock session id
    UserPreferencesStateService.getInstance().setUserPreferences({
      sessions: [1234],
      user_feedback_answered_questions: {},
    } as any);
    resetAllMethodMocks(UserPreferencesStateService.getInstance())
  });

  test("should render with initial summary and no error", () => {
    // GIVEN default props
    render(<SummaryEditField {...defaultProps} />);
    // THEN summary field is present and has correct value
    const summaryContainer = screen.getByTestId(DATA_TEST_ID.FORM_SUMMARY);
    const textarea = within(summaryContainer).getByRole("textbox");
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveValue(defaultProps.summary);

    // AND restore button is present and enabled
    const restoreBtn = screen.getByTestId(DATA_TEST_ID.FORM_SUMMARY_RESTORE);
    expect(restoreBtn).toBeInTheDocument();
    expect(restoreBtn).not.toBeDisabled();
    // AND no error or success message is shown
    expect(screen.queryByTestId(DATA_TEST_ID.FORM_SUMMARY_HELPER)).not.toBeInTheDocument();
    // AND it should match the snapshot
    expect(screen.getByTestId(DATA_TEST_ID.FORM_SUMMARY)).toMatchSnapshot();
  });

  test("should render with error message if error prop is provided", () => {
    // GIVEN error prop
    render(<SummaryEditField {...defaultProps} error="Some error" />);
    // THEN error message is shown
    expect(screen.getByTestId(DATA_TEST_ID.FORM_SUMMARY_HELPER)).toHaveTextContent("Some error");
  });

  test("should call notifyOnChange and update value when summary is changed", () => {
    // GIVEN rendered component
    render(<SummaryEditField {...defaultProps} />);
    const summaryContainer = screen.getByTestId(DATA_TEST_ID.FORM_SUMMARY);
    const textarea = within(summaryContainer).getByRole("textbox");
    // THEN textarea is present
    expect(textarea).toBeInTheDocument();
    // WHEN user types in textarea
    userEvent.clear(textarea!);
    fireEvent.change(textarea!, { target: { value: "New summary" } });
    // THEN notifyOnChange is called
    expect(mockNotifyOnChange).toHaveBeenCalled();
    // AND value is updated
    expect(textarea).toHaveValue("New summary");
  });

  test("should restore summary to original when restore is clicked (success path)", async () => {
    jest.useFakeTimers()
    // GIVEN original summary from service
    const originalSummary = "Original summary from service.";
    jest.spyOn(ExperienceService.getInstance(), "getOriginalExperience").mockResolvedValue({ summary: originalSummary } as Experience);
    render(<SummaryEditField {...defaultProps} />);
    // WHEN restore is clicked
    const restoreBtn = screen.getByTestId(DATA_TEST_ID.FORM_SUMMARY_RESTORE);
    userEvent.click(restoreBtn);
    // THEN summary is updated
    await waitFor(() => {
      const summaryContainer = screen.getByTestId(DATA_TEST_ID.FORM_SUMMARY);
      expect(within(summaryContainer).getByRole("textbox")).toHaveValue(originalSummary);
    });
    // AND success message is shown
    expect(screen.getByTestId(DATA_TEST_ID.FORM_SUMMARY_HELPER)).toHaveTextContent("Summary restored to original version.");
    // AND notifyOnChange is called with original summary
    expect(mockNotifyOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ target: { value: originalSummary } }),
      "summary",
      SUMMARY_MAX_LENGTH
    );
    // AND success message disappears after timeout
    await act(async () => {
      jest.advanceTimersByTime(3010);
    });
    expect(screen.queryByTestId(DATA_TEST_ID.FORM_SUMMARY_HELPER)).not.toBeInTheDocument();
    // cleanup
    jest.useRealTimers();
  });

  test("should show error snackbar and log error if restore fails", async () => {
    // GIVEN service throws error
    const givenError = new Error("some error");
    jest.spyOn(ExperienceService.getInstance(), "getOriginalExperience").mockRejectedValueOnce(givenError);
    render(<SummaryEditField {...defaultProps} />);
    // WHEN restore is clicked
    const restoreBtn = screen.getByTestId(DATA_TEST_ID.FORM_SUMMARY_RESTORE);
    userEvent.click(restoreBtn);
    // THEN error is logged and snackbar is shown
    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith(new ExperienceError("Failed to restore original summary:", givenError));
    });
    expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
      "Failed to restore summary. Please try again later.",
      { variant: "error" }
    );
    // AND the notifyOnChange function is not called
    expect(mockNotifyOnChange).not.toHaveBeenCalled();
  });

  test("should disable restore button while restoring", async () => {
    // GIVEN slow service
    let resolvePromise: any;
    jest.spyOn(ExperienceService.getInstance(), "getOriginalExperience").mockReturnValueOnce(
      new Promise((res) => { resolvePromise = res; })
    );
    jest.spyOn(ExperienceService.getInstance(), "updateExperience").mockResolvedValue({ summary: "restored" } as Experience);
    // WHEN component is rendered
    render(<SummaryEditField {...defaultProps} />);
    const restoreBtn = screen.getByTestId(DATA_TEST_ID.FORM_SUMMARY_RESTORE);
    // WHEN restore is clicked
    userEvent.click(restoreBtn);
    // THEN button is disabled
    await waitFor(() => {
      expect(restoreBtn).toHaveAttribute("aria-disabled", "true");
    });
    // WHEN promise resolves
    act(() => {
      resolvePromise({ summary: "restored" });
    });
    // THEN button is enabled again
    await waitFor(() => expect(restoreBtn).not.toBeDisabled());
  });

  test("should disable restore button if offline", async () => {
    // GIVEN offline context
    mockBrowserIsOnLine(false)
    render(<SummaryEditField {...defaultProps} />);
    // THEN restore button is disabled
    await waitFor(() => {
      expect(screen.getByTestId(DATA_TEST_ID.FORM_SUMMARY_RESTORE)).toHaveAttribute("aria-disabled", "true");
    });
  });
}); 