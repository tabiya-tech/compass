// mute the console
import "src/_test_utilities/consoleMock";

import { render, screen } from "src/_test_utilities/test-utils";
import { FeedbackItem } from "src/feedback/overallFeedback/overallFeedbackService/OverallFeedback.service.types";
import ConversationConclusionFooter, {
  DATA_TEST_ID,
} from "src/chat/chatMessage/conversationConclusionChatMessage/conversationConclusionFooter/ConversationConclusionFooter";
import userEvent from "@testing-library/user-event";

// mock the PersistentStorageService
jest.mock("src/app/PersistentStorageService/PersistentStorageService", () => {
  const mockUserFeedback: FeedbackItem = {
    question_id: "recommendation",
    answer: {
      rating_numeric: 7,
    },
    is_answered: true,
  };
  return {
    __esModule: true,
    PersistentStorageService: {
      getOverallFeedback: () => [mockUserFeedback],
    },
  };
});

describe("FeedbackFormButton", () => {
  test("should render component successfully", () => {
    // GIVEN a FeedbackFormButton component
    const givenComponent = (
      <ConversationConclusionFooter
        notifyOnFeedbackFormOpen={jest.fn()}
        notifyOnExperiencesDrawerOpen={jest.fn()}
        isFeedbackSubmitted={false}
        isFeedbackStarted={false}
      />
    );

    // WHEN the component is rendered
    render(givenComponent);

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    // AND the feedback form button container to be displayed
    const feedbackFormButtonContainer = screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_BUTTON);
    expect(feedbackFormButtonContainer).toBeInTheDocument();
    // AND the feedback form button to be displayed
    expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_BUTTON)).toBeInTheDocument();
    // AND the feedback message to be displayed
    expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_MESSAGE_TEXT)).toBeInTheDocument();
    // AND the experiences drawer button to be displayed
    expect(screen.getByTestId(DATA_TEST_ID.EXPERIENCES_DRAWER_BUTTON)).toBeInTheDocument();
    // AND the component to match the snapshot
    expect(feedbackFormButtonContainer).toMatchSnapshot();
  });

  test("should call notifyOnExperiencesDrawerOpen when experiences drawer button is clicked", async () => {
    // GIVEN a FeedbackFormButton component
    const notifyOnExperiencesDrawerOpen = jest.fn();
    const givenComponent = (
      <ConversationConclusionFooter
        notifyOnFeedbackFormOpen={jest.fn()}
        notifyOnExperiencesDrawerOpen={notifyOnExperiencesDrawerOpen}
        isFeedbackSubmitted={false}
        isFeedbackStarted={false}
      />
    );

    // WHEN the component is rendered
    render(givenComponent);

    // WHEN the experiences drawer button is clicked
    const experiencesDrawerButton = screen.getByTestId(DATA_TEST_ID.EXPERIENCES_DRAWER_BUTTON);
    await userEvent.click(experiencesDrawerButton);

    // THEN expect notifyOnExperiencesDrawerOpen to have been called
    expect(notifyOnExperiencesDrawerOpen).toHaveBeenCalled();
  });

  test("should call notifyOpenFeedbackForm when feedback button is clicked", async () => {
    // GIVEN a FeedbackFormButton component
    const notifyOpenFeedbackForm = jest.fn();
    const givenComponent = (
      <ConversationConclusionFooter
        notifyOnFeedbackFormOpen={notifyOpenFeedbackForm}
        notifyOnExperiencesDrawerOpen={jest.fn()}
        isFeedbackSubmitted={false}
        isFeedbackStarted={false}
      />
    );

    // WHEN the component is rendered
    render(givenComponent);

    // WHEN the feedback button is clicked
    const feedbackButton = screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_BUTTON);
    await userEvent.click(feedbackButton);

    // THEN expect notifyOpenFeedbackForm to have been called
    expect(notifyOpenFeedbackForm).toHaveBeenCalled();
  });

  test("should show feedback request message when feedback is not started or submitted", () => {
    // GIVEN no feedback has been started or submitted
    const mockIsFeedbackSubmitted = false;
    const mockIsFeedbackInProgress = false;

    // WHEN the component is rendered
    render(
      <ConversationConclusionFooter
        notifyOnFeedbackFormOpen={jest.fn()}
        notifyOnExperiencesDrawerOpen={jest.fn()}
        isFeedbackSubmitted={mockIsFeedbackSubmitted}
        isFeedbackStarted={mockIsFeedbackInProgress}
      />
    );

    // THEN expect the feedback message to be displayed
    expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_MESSAGE_TEXT)).toBeInTheDocument();
    // AND the button to give feedback to be displayed
    expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_BUTTON)).toBeInTheDocument();
  });

  test("should show feedback in progress message when feedback is started but not submitted", () => {
    // GIVEN a feedback is in progress
    const mockIsFeedbackInProgress = true;

    // WHEN the component is rendered
    render(
      <ConversationConclusionFooter
        notifyOnFeedbackFormOpen={jest.fn()}
        notifyOnExperiencesDrawerOpen={jest.fn()}
        isFeedbackSubmitted={false}
        isFeedbackStarted={mockIsFeedbackInProgress}
      />
    );

    // THEN expect the feedback in progress message to be displayed
    expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_IN_PROGRESS_MESSAGE)).toBeInTheDocument();
    // AND the button to complete feedback to be displayed
    expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_IN_PROGRESS_BUTTON)).toBeInTheDocument();
  });

  test("should show thank you message when the user has submitted feedback", () => {
    // GIVEN the user has submitted feedback
    const mockIsFeedbackSubmitted = true;

    // WHEN the component is rendered
    render(
      <ConversationConclusionFooter
        notifyOnFeedbackFormOpen={jest.fn()}
        notifyOnExperiencesDrawerOpen={jest.fn()}
        isFeedbackSubmitted={mockIsFeedbackSubmitted}
        isFeedbackStarted={false}
      />
    );

    // THEN expect the thank you message to be displayed
    expect(screen.getByTestId(DATA_TEST_ID.THANK_YOU_MESSAGE)).toBeInTheDocument();
  });
});
