// mute the console
import "src/_test_utilities/consoleMock";

import ChatMessage, { ChatMessageFooterType, DATA_TEST_ID } from "./ChatMessage";
import { render, screen } from "src/_test_utilities/test-utils";
import * as GetDurationFromNow from "src/utils/getDurationFromNow/getDurationFromNow";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import { nanoid } from "nanoid";
import { DATA_TEST_ID as CHAT_MESSAGE_FOOTER_BUTTON_DATA_TEST_ID } from "src/feedback/overallFeedback/feedbackForm/components/feedbackFormButton/FeedbackFormButton";
import { IChatMessage } from "src/chat/Chat.types";

jest.mock("src/auth/services/FirebaseAuthenticationService/socialAuth/FirebaseSocialAuthentication.service", () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => {
      return {
        logout: jest.fn(),
      };
    }),
  };
});

describe("render tests", () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2020, 3, 1));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  test("should render the Chat message with sent_at when the message is not a typing message", () => {
    // WHEN the chat header is rendered
    const givenDate = new Date(2024, 6, 25).toISOString();
    const givenMessage: IChatMessage = {
      id: nanoid(),
      sender: ConversationMessageSender.COMPASS,
      message: "Hello, I'm Compass",
      sent_at: givenDate,
      isTypingMessage: false,
    };
    const givenNotifyOpenFeedbackForm = jest.fn();
    const givenOnReactionChange = jest.fn();

    jest.spyOn(GetDurationFromNow, "getDurationFromNow").mockReturnValue("Some Date");

    render(<ChatMessage chatMessage={givenMessage} notifyOpenFeedbackForm={givenNotifyOpenFeedbackForm} notifyReactionChange={givenOnReactionChange} />);

    // THEN expect the chat header to be visible
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_CONTAINER)).toBeInTheDocument();
    // AND expect the timestamp to be visible
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_TIMESTAMP)).toBeInTheDocument();

    // AND the getDurationBetweenDates to have been called with the given date
    expect(GetDurationFromNow.getDurationFromNow).toHaveBeenCalledWith(new Date(givenDate));
    // AND the correct date to have been displayed
    expect(screen.getByText("sent Some Date", { exact: false })).toBeInTheDocument();
    // AND expect the message to be visible
    expect(screen.getByText(givenMessage.message)).toBeInTheDocument();

    // AND expect the component to match the snapshot
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_CONTAINER)).toMatchSnapshot();
  });

  test("should render the Chat message without a sent_at when the message is a typing message", () => {
    // WHEN the chat header is rendered
    const givenMessage: IChatMessage = {
      id: nanoid(),
      sender: ConversationMessageSender.COMPASS,
      message: "Hello, I'm Compass",
      sent_at: new Date().toISOString(),
      isTypingMessage: true,
    };
    const givenNotifyOpenFeedbackForm = jest.fn();
    const givenOnReactionChange = jest.fn();

    render(<ChatMessage chatMessage={givenMessage} notifyOpenFeedbackForm={givenNotifyOpenFeedbackForm} notifyReactionChange={givenOnReactionChange} />);

    // THEN expect the chat header to be visible
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_CONTAINER)).toBeInTheDocument();

    // AND expect the timeout to not be visible
    expect(screen.queryByTestId(DATA_TEST_ID.CHAT_MESSAGE_TIMESTAMP)).not.toBeInTheDocument();
  });

  test("should render ChatMessageFooter when the footer type is FEEDBACK_FORM_BUTTON", () => {
    // GIVEN a chat message
    const givenMessage = {
      id: nanoid(),
      sender: ConversationMessageSender.COMPASS,
      message: "Hello, I'm Compass",
      sent_at: new Date().toISOString(),
      footerType: ChatMessageFooterType.FEEDBACK_FORM_BUTTON,
    };
    const givenNotifyOpenFeedbackForm = jest.fn();
    const givenOnReactionChange = jest.fn();

    // WHEN the component is rendered
    render(<ChatMessage chatMessage={givenMessage} notifyOpenFeedbackForm={givenNotifyOpenFeedbackForm} notifyReactionChange={givenOnReactionChange} />);

    // THEN expect the divider to be displayed
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FOOTER_DIVIDER)).toBeInTheDocument();
    // AND the feedback form button to be displayed
    expect(screen.getByTestId(CHAT_MESSAGE_FOOTER_BUTTON_DATA_TEST_ID.FEEDBACK_FORM_BUTTON)).toBeInTheDocument();
  });
});
