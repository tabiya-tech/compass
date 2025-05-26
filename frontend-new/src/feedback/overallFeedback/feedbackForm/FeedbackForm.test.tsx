// mute the console
import "src/_test_utilities/consoleMock";

import FeedbackForm, { DATA_TEST_ID, FeedbackCloseEvent } from "src/feedback/overallFeedback/feedbackForm/FeedbackForm";
import { render, screen } from "src/_test_utilities/test-utils";
import { act, fireEvent, waitFor } from "@testing-library/react";
import FeedbackFormContent from "./components/feedbackFormContent/FeedbackFormContent";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import {
  SensitivePersonalDataRequirement,
  Language,
} from "src/userPreferences/UserPreferencesService/userPreferences.types";
import OverallFeedbackService from "src/feedback/overallFeedback/overallFeedbackService/OverallFeedback.service";
import { FeedbackError } from "src/error/commonErrors";
import { FeedbackResponse } from "src/feedback/overallFeedback/overallFeedbackService/OverallFeedback.service.types";
import { FeedbackProvider } from "src/feedback/overallFeedback/context/FeedbackContext";
import { QuestionType, YesNoEnum } from "./feedbackForm.types";
import React from "react";

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

// mock the feedback form content
jest.mock("src/feedback/overallFeedback/feedbackForm/components/feedbackFormContent/FeedbackFormContent", () => {
  const actual = jest.requireActual("src/feedback/overallFeedback/feedbackForm/components/feedbackFormContent/FeedbackFormContent");
  return {
    ...actual,
    __esModule: true,
    default: jest.fn(() => <div data-testid={actual.DATA_TEST_ID.FEEDBACK_FORM_CONTENT}/>),
  };
});

// Mock OverallFeedbackService.getQuestionsConfig
jest.spyOn(OverallFeedbackService.getInstance(), "getQuestionsConfig").mockResolvedValue({
  perceived_bias: {
    questionId: "perceived_bias",
    question_text: "Did you perceive any bias in the conversation?",
    description: "We want to ensure our AI is fair and unbiased",
    comment_placeholder: "Please share your thoughts",
    type: QuestionType.YesNo,
    show_comments_on: YesNoEnum.No,
  },
  work_experience_accuracy: {
    questionId: "work_experience_accuracy",
    question_text: "How accurate was the AI in understanding your work experience?",
    description: "We want to improve our understanding of work experience",
    comment_placeholder: "Please share your thoughts",
    type: QuestionType.Checkbox,
    options: {
      option1: "Very accurate",
      option2: "Somewhat accurate",
      option3: "Not accurate",
    },
  },
  clarity_of_skills: {
    questionId: "clarity_of_skills",
    question_text: "Was the AI clear about the skills needed for the role?",
    description: "We want to ensure we're clear about required skills",
    comment_placeholder: "Please share your thoughts",
    type: QuestionType.YesNo,
    show_comments_on: YesNoEnum.No,
  },
  incorrect_skills: {
    questionId: "incorrect_skills",
    question_text: "Were there any skills mentioned that don't apply to the role?",
    description: "We want to improve our understanding of role requirements",
    comment_placeholder: "Please share your thoughts",
    type: QuestionType.YesNo,
    show_comments_on: YesNoEnum.Yes,
  },
  missing_skills: {
    questionId: "missing_skills",
    question_text: "Were there any important skills missing from the conversation?",
    description: "We want to ensure we cover all relevant skills",
    comment_placeholder: "Please share your thoughts",
    type: QuestionType.YesNo,
    show_comments_on: YesNoEnum.Yes,
  },
  interaction_ease: {
    questionId: "interaction_ease",
    question_text: "How easy was it to interact with the AI?",
    description: "We want to improve the user experience",
    comment_placeholder: "Please share your thoughts",
    type: QuestionType.Rating,
    low_rating_label: "Very difficult",
    high_rating_label: "Very easy",
    max_rating: 5,
    display_rating: true,
  },
  recommendation: {
    questionId: "recommendation",
    question_text: "Would you recommend this AI assistant to others?",
    description: "We want to know if you found the experience valuable",
    comment_placeholder: "Please share your thoughts",
    type: QuestionType.Rating,
    low_rating_label: "Not at all",
    high_rating_label: "Definitely",
    max_rating: 5,
    display_rating: true,
  },
  additional_feedback: {
    questionId: "additional_feedback",
    question_text: "Do you have any additional feedback?",
    description: "We value your input to improve our service",
    comment_placeholder: "Please share any other thoughts or suggestions",
    type: QuestionType.YesNo,
    show_comments_on: YesNoEnum.Yes,
  },
});

// Helper to wrap in FeedbackProvider
const renderWithFeedbackProvider = (ui: React.ReactElement) => {
  return render(<FeedbackProvider>{ui}</FeedbackProvider>);
};

const mockFeedbackResponse: FeedbackResponse = {
  id: "foo",
  version: {
    frontend: "foo-frontend",
    backend: "foo-backend"
  },
  feedback_items: [{
    question_id: "foo-question_id",
    simplified_answer: {
      rating_numeric: 5
    }
  }],
  created_at: new Date().toISOString()
}

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
    const givenFeedbackForm = <FeedbackForm isOpen={true} notifyOnClose={mockHandleClose} />;
    // AND the component is rendered
    renderWithFeedbackProvider(givenFeedbackForm);

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
      // GIVEN the feedback service will successfully send a feedback
      jest.spyOn(OverallFeedbackService.getInstance(), "sendFeedback").mockResolvedValueOnce(mockFeedbackResponse)
      // AND the component is rendered
      const mockHandleClose = jest.fn();
      const givenFeedbackForm = <FeedbackForm isOpen={true} notifyOnClose={mockHandleClose} />;
      renderWithFeedbackProvider(givenFeedbackForm);
      // AND when the submit button is clicked
      const submitCallback = (FeedbackFormContent as jest.Mock).mock.calls.at(-1)[0].notifySubmit;
      await act(async () => {
        submitCallback([
          {
            question_id: "foo-question",
            answer: {
              comment: "foo-comment"
            },
            is_answered: false,
          }
        ]);
      });

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

    test("should call handleFeedbackSubmit when submit button is clicked and handle nonexistent session", async () => {
      (console.error as jest.Mock).mockClear();

      // GIVEN getUserPreferences returns a user without any session
      jest.spyOn(UserPreferencesStateService.getInstance(), "getUserPreferences").mockReturnValue({
        accepted_tc: new Date(),
        user_id: "0001",
        language: Language.en,
        sessions: [],
        user_feedback_answered_questions: {},
        has_sensitive_personal_data: false,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
        experiments: {},
      });

      // WHEN the component is rendered
      renderWithFeedbackProvider(<FeedbackForm isOpen={true} notifyOnClose={jest.fn()} />);
      // AND when the submit button is clicked
      const submitCallback = (FeedbackFormContent as jest.Mock).mock.calls.at(-1)[0].notifySubmit;
      await act(async () => {
        submitCallback([
          {
            question_id: "foo-question",
            answer: {
              comment: "foo-comment"
            },
            is_answered: false,
          }
        ]);
      });

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
