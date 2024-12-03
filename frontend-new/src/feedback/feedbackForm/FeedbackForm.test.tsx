// mute the console
import "src/_test_utilities/consoleMock";

import FeedbackForm, { DATA_TEST_ID } from "src/feedback/feedbackForm/FeedbackForm";
import { render, screen } from "src/_test_utilities/test-utils";
import { fireEvent, waitFor } from "@testing-library/react";
import { DATA_TEST_ID as FEEDBACK_FORM_CONTENT_DATA_TEST_ID } from "src/feedback/feedbackForm/components/feedbackFormContent/FeedbackFormContent";
import { DATA_TEST_ID as CUSTOM_RATING_DATA_TEST_ID } from "src/feedback/feedbackForm/components/customRating/CustomRating";
import { userPreferencesStateService } from "src/userPreferences/UserPreferencesStateService";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { Language } from "src/userPreferences/UserPreferencesService/userPreferences.types";
import FeedbackService from "src/feedback/feedbackForm/feedbackFormService/feedbackFormService";
import stepsContent from "src/feedback/feedbackForm/stepsContent";

// mock the feedback service
jest.mock("src/feedback/feedbackForm/feedbackFormService/feedbackFormService");

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
  userPreferencesStateService: {
    getUserPreferences: jest.fn().mockReturnValue({
      sessions: [1234],
    }),
  },
}));

describe("FeedbackForm", () => {
  test("should render component successfully", () => {
    // GIVEN the component
    const givenFeedbackForm = <FeedbackForm isOpen={true} notifyOnClose={jest.fn()} onFeedbackSubmit={jest.fn()} />;

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
      <FeedbackForm isOpen={true} notifyOnClose={mockHandleClose} onFeedbackSubmit={jest.fn()} />
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
      (FeedbackService as jest.Mocked<typeof FeedbackService>).prototype.sendFeedback = mockSendFeedback;
    });

    test("should call handleFeedbackSubmit when submit button is clicked", async () => {
      // GIVEN the component
      const mockHandleClose = jest.fn();
      const givenFeedbackForm = (
        <FeedbackForm isOpen={true} notifyOnClose={mockHandleClose} onFeedbackSubmit={jest.fn()} />
      );
      // AND the component is rendered
      render(givenFeedbackForm);
      // AND there is at least one answer
      const input = screen.getAllByTestId(CUSTOM_RATING_DATA_TEST_ID.CUSTOM_RATING_FIELD);
      fireEvent.change(input[0], { target: { value: "This is a comment" } });

      // WHEN the submit button is clicked
      const nextButton = screen.getByTestId(FEEDBACK_FORM_CONTENT_DATA_TEST_ID.FEEDBACK_FORM_NEXT_BUTTON);
      for (let i = 0; i < stepsContent.length; i++) {
        fireEvent.click(nextButton);
      }

      // THEN expect the notifyOnClose to have been called
      expect(mockHandleClose).toHaveBeenCalled();
      // AND the sendFeedback function to have been called
      await waitFor(() => expect(mockSendFeedback).toHaveBeenCalled());
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
      jest.spyOn(userPreferencesStateService, "getUserPreferences").mockReturnValue({
        accepted_tc: new Date(),
        user_id: "0001",
        language: Language.en,
        sessions: [],
      });

      // WHEN the component is rendered
      render(<FeedbackForm isOpen={true} notifyOnClose={jest.fn()} onFeedbackSubmit={jest.fn()} />);
      // AND there is at least one answer
      const input = screen.getAllByTestId(CUSTOM_RATING_DATA_TEST_ID.CUSTOM_RATING_FIELD);
      fireEvent.change(input[0], { target: { value: "This is a comment" } });
      // AND the submit button is clicked
      const nextButton = screen.getByTestId(FEEDBACK_FORM_CONTENT_DATA_TEST_ID.FEEDBACK_FORM_NEXT_BUTTON);
      for (let i = 0; i < stepsContent.length; i++) {
        fireEvent.click(nextButton);
      }

      // THEN expect an error message to be shown
      await waitFor(() => {
        expect(console.error).toHaveBeenCalledWith("Failed to submit feedback", new Error("User has no sessions"));
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
