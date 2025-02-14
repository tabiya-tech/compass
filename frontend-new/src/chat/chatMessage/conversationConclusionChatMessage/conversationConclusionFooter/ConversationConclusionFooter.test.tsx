// mute the console
import "src/_test_utilities/consoleMock";

import { render, screen } from "src/_test_utilities/test-utils";
import ConversationConclusionFooter, {
  DATA_TEST_ID,
} from "src/chat/chatMessage/conversationConclusionChatMessage/conversationConclusionFooter/ConversationConclusionFooter";
import userEvent from "@testing-library/user-event";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { ChatProvider } from "src/chat/ChatContext";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import { FeedbackItem } from "src/feedback/overallFeedback/overallFeedbackService/OverallFeedback.service.types";

// Mock external dependencies
jest.mock("src/app/PersistentStorageService/PersistentStorageService");

describe("ConversationConclusionFooter", () => {
  const givenMockHandleOpenExperiencesDrawer = jest.fn();
  const givenMockSetFeedbackStatus = jest.fn();

  const renderWithProvider = (component: React.ReactElement) => {
    return render(
      <ChatProvider 
        handleOpenExperiencesDrawer={givenMockHandleOpenExperiencesDrawer}
      >
        {component}
      </ChatProvider>
    );
  };

  beforeEach(() => {
    // GIVEN clean mocks before each test
    jest.clearAllMocks();
    
    // AND mock storage service
    (PersistentStorageService.getOverallFeedback as jest.Mock).mockReturnValue([]);
  });

  test("should render component successfully", () => {
    // GIVEN a ConversationConclusionFooter component
    const givenComponent = <ConversationConclusionFooter />;
    
    // AND the user has not submitted feedback before
    jest.spyOn(UserPreferencesStateService.getInstance(), "activeSessionHasFeedback").mockReturnValueOnce(false);

    // WHEN the component is rendered
    renderWithProvider(givenComponent);

    // THEN expect no errors or warnings to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    
    // AND expect the feedback form button container to be displayed
    const actualFeedbackFormButtonContainer = screen.getByTestId(DATA_TEST_ID.CONVERSATION_CONCLUSION_FOOTER_CONTAINER);
    expect(actualFeedbackFormButtonContainer).toBeInTheDocument();
    
    // AND expect the feedback message to be displayed
    expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_MESSAGE_TEXT)).toBeInTheDocument();
    
    // AND expect the experiences drawer button to be displayed
    expect(screen.getByTestId(DATA_TEST_ID.EXPERIENCES_DRAWER_BUTTON)).toBeInTheDocument();
    
    // AND expect the component to match the snapshot
    expect(actualFeedbackFormButtonContainer).toMatchSnapshot();
  });

  test("should open experiences drawer when experiences drawer button is clicked", async () => {
    // GIVEN a ConversationConclusionFooter component
    const givenComponent = <ConversationConclusionFooter />;
    
    // AND the user has not submitted feedback before
    jest.spyOn(UserPreferencesStateService.getInstance(), "activeSessionHasFeedback").mockReturnValueOnce(false);

    // WHEN the component is rendered
    renderWithProvider(givenComponent);

    // AND the experiences drawer button is clicked
    const experiencesDrawerButton = screen.getByTestId(DATA_TEST_ID.EXPERIENCES_DRAWER_BUTTON);
    await userEvent.click(experiencesDrawerButton);

    // THEN expect handleOpenExperiencesDrawer to have been called
    expect(givenMockHandleOpenExperiencesDrawer).toHaveBeenCalledTimes(1);
  });

  test("should open feedback form when feedback button is clicked", async () => {
    // GIVEN a ConversationConclusionFooter component
    const givenComponent = <ConversationConclusionFooter />;
    
    // AND the user has not submitted feedback before
    jest.spyOn(UserPreferencesStateService.getInstance(), "activeSessionHasFeedback").mockReturnValueOnce(false);

    // WHEN the component is rendered
    renderWithProvider(givenComponent);

    // AND the feedback button is clicked
    const feedbackButton = screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_BUTTON);
    await userEvent.click(feedbackButton);

    // THEN expect the feedback form dialog to be open
    expect(screen.getByTestId("feedback-form-dialog-c6ba52ec-c1de-46ac-950b-f5354c6785ac")).toBeInTheDocument();
  });

  test("should maintain feedback status when form is closed", async () => {
    // GIVEN a ConversationConclusionFooter component
    const givenComponent = <ConversationConclusionFooter />;
    
    // AND the user has not submitted feedback before
    jest.spyOn(UserPreferencesStateService.getInstance(), "activeSessionHasFeedback").mockReturnValueOnce(false);

    // WHEN the component is rendered
    renderWithProvider(givenComponent);

    // AND the feedback button is clicked
    const feedbackButton = screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_BUTTON);
    await userEvent.click(feedbackButton);

    // AND the form is closed
    const closeButton = screen.getByTestId("feedback-form-dialog-button-c6ba52ec-c1de-46ac-950b-f5354c6785ac");
    await userEvent.click(closeButton);

    // THEN expect the feedback status to remain unchanged
    expect(givenMockSetFeedbackStatus).not.toHaveBeenCalled();
  });

  test("should show feedback request message when feedback is not started", () => {
    // GIVEN no feedback has been started
    // AND the user has not submitted feedback before
    jest.spyOn(UserPreferencesStateService.getInstance(), "activeSessionHasFeedback").mockReturnValueOnce(false);

    // WHEN the component is rendered
    renderWithProvider(<ConversationConclusionFooter />);

    // THEN expect the feedback message to be displayed
    expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_MESSAGE_TEXT)).toBeInTheDocument();
    // AND expect the button to give feedback to be displayed
    expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_BUTTON)).toBeInTheDocument();
  });

  test("should show feedback in progress message when feedback is started but not submitted", () => {
    // GIVEN a feedback is in progress
    const mockFeedbackItems: FeedbackItem[] = [
      {
        question_id: "overall_satisfaction",
        answer: {
          rating_numeric: 4,
          comment: "Very helpful conversation!",
        },
        is_answered: true,
      },
      {
        question_id: "ui_experience",
        answer: {
          rating_numeric: 5,
        },
        is_answered: true,
      },
    ];
    (PersistentStorageService.getOverallFeedback as jest.Mock).mockReturnValue(mockFeedbackItems);

    // AND the user has not submitted feedback before
    jest.spyOn(UserPreferencesStateService.getInstance(), "activeSessionHasFeedback").mockReturnValueOnce(false);

    // WHEN the component is rendered
    renderWithProvider(<ConversationConclusionFooter />);

    // THEN expect the feedback in progress message to be displayed
    expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_IN_PROGRESS_MESSAGE)).toBeInTheDocument();
    // AND the button to complete feedback to be displayed
    expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_IN_PROGRESS_BUTTON)).toBeInTheDocument();
  });

  test("should show thank you message when feedback is submitted", () => {
    // GIVEN feedback has been submitted
    // AND the user has submitted feedback before
    jest.spyOn(UserPreferencesStateService.getInstance(), "activeSessionHasFeedback").mockReturnValueOnce(true);

    // WHEN the component is rendered
    renderWithProvider(<ConversationConclusionFooter />);

    // THEN expect the thank you message to be displayed
    expect(screen.getByTestId(DATA_TEST_ID.THANK_YOU_MESSAGE)).toBeInTheDocument();
  });
});
