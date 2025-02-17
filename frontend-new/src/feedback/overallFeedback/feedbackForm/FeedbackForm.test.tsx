// mute the console
import "src/_test_utilities/consoleMock";

import FeedbackForm, { DATA_TEST_ID, FeedbackCloseEvent } from "src/feedback/overallFeedback/feedbackForm/FeedbackForm";
import { render, screen } from "src/_test_utilities/test-utils";
import { fireEvent, waitFor } from "@testing-library/react";
import { DATA_TEST_ID as FEEDBACK_FORM_CONTENT_DATA_TEST_ID } from "src/feedback/overallFeedback/feedbackForm/components/feedbackFormContent/FeedbackFormContent";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import {
  SensitivePersonalDataRequirement,
  Language,
} from "src/userPreferences/UserPreferencesService/userPreferences.types";
import OverallFeedbackService from "src/feedback/overallFeedback/overallFeedbackService/OverallFeedback.service";
import feedbackFormContentSteps from "src/feedback/overallFeedback/feedbackForm/components/feedbackFormContent/feedbackFormContentSteps";
import { FeedbackError } from "src/error/commonErrors";
import { DATA_TEST_ID as COMMENT_TEXT_FIELD_TEST_ID } from "src/feedback/overallFeedback/feedbackForm/components/commentTextField/CommentTextField";

// mock the feedback service
jest.mock("src/feedback/overallFeedback/overallFeedbackService/OverallFeedback.service");

// mock the snackbar provider
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

// mock the user preferences state service
jest.mock("src/userPreferences/UserPreferencesStateService", () => ({
  getInstance: jest.fn().mockReturnValue({
    getUserPreferences: jest.fn().mockReturnValue({
      sessions: [1234],
    }),
  }),
}));

describe("FeedbackForm", () => {
  test("should render component successfully", () => {
    // GIVEN the component
    const givenFeedbackForm = <FeedbackForm isOpen={true} notifyOnClose={jest.fn()} />;

    // WHEN the component is rendered
    render(givenFeedbackForm);

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    // AND the feedback form dialog to be in the document
    const feedbackFormContainer = screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_DIALOG);
    expect(feedbackFormContainer).toBeInTheDocument();
    // AND the feedback form dialog title to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_DIALOG_TITLE)).toBeInTheDocument();
    // AND the feedback form dialog button to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_DIALOG_BUTTON)).toBeInTheDocument();
    // AND the feedback form dialog icon button to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_DIALOG_ICON_BUTTON)).toBeInTheDocument();
    // AND the feedback form dialog content to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_DIALOG_CONTENT)).toBeInTheDocument();
    // AND to match the snapshot
    expect(feedbackFormContainer).toMatchSnapshot();
  });

  test("should call handleClose when close button is clicked", () => {
    // GIVEN the component
    const mockHandleClose = jest.fn();
    const givenFeedbackForm = (
      <FeedbackForm isOpen={true} notifyOnClose={mockHandleClose} />
    );
    // AND the component is rendered
    render(givenFeedbackForm);

    // WHEN the close button is clicked
    const closeButton = screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_DIALOG_ICON_BUTTON);
    fireEvent.click(closeButton);

    // THEN expect the notifyOnClose function to have been called
    expect(mockHandleClose).toHaveBeenCalled();
  });

  describe("FeedbackForm handleFeedbackSubmit", () => {
    const mockSendFeedback = jest.fn();

    beforeEach(() => {
      jest.clearAllMocks();
      (OverallFeedbackService as jest.Mocked<typeof OverallFeedbackService>).prototype.sendFeedback = mockSendFeedback;
    });

    test("should call handleFeedbackSubmit when submit button is clicked", async () => {
      // GIVEN the component
      const mockHandleClose = jest.fn();
      const givenFeedbackForm = (
        <FeedbackForm isOpen={true} notifyOnClose={mockHandleClose} />
      );
      // AND the component is rendered
      render(givenFeedbackForm);
      // AND there is at least one answer
      const input = screen.getAllByTestId(COMMENT_TEXT_FIELD_TEST_ID.COMMENT_TEXT_FIELD);
      fireEvent.change(input[0], { target: { value: "This is a comment" } });

      // WHEN the submit button is clicked
      const nextButton = screen.getByTestId(FEEDBACK_FORM_CONTENT_DATA_TEST_ID.FEEDBACK_FORM_NEXT_BUTTON);
      for (let i = 0; i < feedbackFormContentSteps.length; i++) {
        fireEvent.click(nextButton);
      }

      // THEN expect the notifyOnClose to have been called
      await waitFor(() => expect(mockHandleClose).toHaveBeenCalledWith(FeedbackCloseEvent.SUBMIT));
      // AND the sendFeedback function to have been called
      expect(mockSendFeedback).toHaveBeenCalled();
      // AND the snackbar to have been called
      await waitFor(() =>
        expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith("Feedback submitted successfully!", {
          variant: "success",
        })
      );
    });

    test("should call handleFeedbackSubmit when submit button is clicked and handle error", async () => {
      (console.error as jest.Mock).mockClear();

      // GIVEN getUserPreferences returns a user without any session
      jest.spyOn(UserPreferencesStateService.getInstance(), "getUserPreferences").mockReturnValue({
        accepted_tc: new Date(),
        user_id: "0001",
        language: Language.en,
        sessions: [],
        sessions_with_feedback: [],
        has_sensitive_personal_data: false,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
      });

      // WHEN the component is rendered
      render(<FeedbackForm isOpen={true} notifyOnClose={jest.fn()} />);
      // AND there is at least one answer
      const input = screen.getAllByTestId(COMMENT_TEXT_FIELD_TEST_ID.COMMENT_TEXT_FIELD);
      fireEvent.change(input[0], { target: { value: "This is a comment" } });
      // AND the submit button is clicked
      const nextButton = screen.getByTestId(FEEDBACK_FORM_CONTENT_DATA_TEST_ID.FEEDBACK_FORM_NEXT_BUTTON);
      for (let i = 0; i < feedbackFormContentSteps.length; i++) {
        fireEvent.click(nextButton);
      }

      // THEN expect an error message to be shown
      await waitFor(() => {
        expect(console.error).toHaveBeenCalledWith(
          new FeedbackError("Failed to submit feedback", new Error("User has no sessions"))
        );
      });
      // AND the snackbar to have been called
      await waitFor(() =>
        expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith(
          "Failed to submit feedback. Please try again later.",
          { variant: "error" }
        )
      );
    });
  });
});
