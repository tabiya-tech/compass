// mute the console
import "src/_test_utilities/consoleMock";

import ChatList, { DATA_TEST_ID } from "./ChatList";
import { render, screen } from "src/_test_utilities/test-utils";
import ChatMessage from "src/chat/ChatMessage/ChatMessage";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import { nanoid } from "nanoid";
import { IChatMessage } from "src/chat/Chat.types";

// mock the chat message component
jest.mock("src/chat/ChatMessage/ChatMessage", () => {
  const originalModule = jest.requireActual("src/chat/ChatMessage/ChatMessage");
  return {
    __esModule: true,
    ...originalModule,
    default: jest.fn(() => <div data-testid={originalModule.DATA_TEST_ID.CHAT_MESSAGE_CONTAINER}></div>),
  };
});

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

jest.mock("src/feedback/overallFeedback/feedbackForm/components/feedbackFormButton/FeedbackFormButton", () => {
  return {
    __esModule: true,
    default: jest.fn(() => <div data-testid="feedback-form-button"></div>),
  };
});

describe("ChatList", () => {
  beforeAll(() => {
    window.HTMLElement.prototype.scrollIntoView = jest.fn();
  });
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("should render the Chat List", () => {
    // GIVEN a message list
    const givenMessages = [
      {
        id: nanoid(),
        sender: ConversationMessageSender.USER,
        message: "Hello",
        sent_at: new Date().toISOString(),
      },
      {
        id: nanoid(),
        sender: ConversationMessageSender.COMPASS,
        message: "Hi",
        sent_at: new Date().toISOString(),
      },
      {
        id: nanoid(),
        sender: ConversationMessageSender.COMPASS,
        message: "Typing...",
        sent_at: new Date().toString(),
        isTypingMessage: true,
      }, // Simulate typing state
    ];
    // AND a mock function to open the feedback form
    const givenNotifyOpenFeedbackForm = jest.fn();

    // WHEN the chat header is rendered
    render(<ChatList messages={givenMessages} notifyOpenFeedbackForm={givenNotifyOpenFeedbackForm} />);

    // THEN expect the chat header to be visible
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_LIST_CONTAINER)).toBeInTheDocument();

    // THEN expect the ChatMessage component to be rendered for each message
    expect(ChatMessage).toHaveBeenNthCalledWith(
      1,
      {
        chatMessage: givenMessages[0],
        notifyOpenFeedbackForm: givenNotifyOpenFeedbackForm,
      },
      {}
    );
    expect(ChatMessage).toHaveBeenNthCalledWith(
      2,
      {
        chatMessage: givenMessages[1],
        notifyOpenFeedbackForm: givenNotifyOpenFeedbackForm,
      },
      {}
    );
    // AND expect the ChatMessage component to be rendered for the typing message
    expect(ChatMessage).toHaveBeenNthCalledWith(
      3,
      {
        chatMessage: {
          id: expect.any(String),
          message: "Typing...",
          sender: ConversationMessageSender.COMPASS,
          sent_at: expect.any(String),
          isTypingMessage: true,
        },
        notifyOpenFeedbackForm: givenNotifyOpenFeedbackForm,
      },
      {}
    );

    // AND expect the scrollIntoView function to be called
    expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();

    // AND expect the component to match the snapshot
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_LIST_CONTAINER)).toMatchSnapshot();
  });

  test("should render the Chat List with typing message", () => {
    // GIVEN no messages and no typing status
    const givenMessages: IChatMessage[] = [
      {
        id: nanoid(),
        sender: ConversationMessageSender.COMPASS,
        message: "Typing...",
        sent_at: new Date().toString(),
        isTypingMessage: true,
      },
      // Simulate typing state
    ];
    // AND a mock function to open the feedback form
    const givenNotifyOpenFeedbackForm = jest.fn();

    // WHEN the chat header is rendered
    render(<ChatList messages={givenMessages} notifyOpenFeedbackForm={givenNotifyOpenFeedbackForm} />);

    // THEN expect the chat header to be visible
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_LIST_CONTAINER)).toBeInTheDocument();

    // THEN expect the ChatMessage component to be rendered for the typing message
    expect(ChatMessage).toHaveBeenNthCalledWith(
      1,
      {
        chatMessage: {
          id: expect.any(String),
          message: "Typing...",
          sender: ConversationMessageSender.COMPASS,
          sent_at: expect.any(String),
          isTypingMessage: true,
        },
        notifyOpenFeedbackForm: givenNotifyOpenFeedbackForm,
      },
      {}
    );

    // AND expect the scrollIntoView function to be called
    expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();

    // AND expect the component to match the snapshot
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_LIST_CONTAINER)).toMatchSnapshot();
  });

  test("should render the chat list for messages with feedback form", () => {
    // GIVEN a message list with a feedback message
    const givenMessages = [
      {
        id: nanoid(),
        sender: ConversationMessageSender.COMPASS,
        message: "Hi",
        sent_at: new Date().toISOString(),
        isFeedbackMessage: true,
      },
    ];
    const givenNotifyOpenFeedbackForm = jest.fn();

    // WHEN the chat header is rendered
    render(<ChatList messages={givenMessages} notifyOpenFeedbackForm={givenNotifyOpenFeedbackForm} />);

    // THEN expect the chat header to be visible
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_LIST_CONTAINER)).toBeInTheDocument();

    // THEN expect the first message to be rendered with feedback form
    expect(ChatMessage).toHaveBeenNthCalledWith(
      1,
      {
        chatMessage: {
          id: expect.any(String),
          message: givenMessages[0].message,
          sender: givenMessages[0].sender,
          sent_at: expect.any(String),
          isFeedbackMessage: true,
        },
        notifyOpenFeedbackForm: givenNotifyOpenFeedbackForm,
      },
      {}
    );

    // AND expect the scrollIntoView function to be called
    expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();

    // AND expect the component to match the snapshot
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_LIST_CONTAINER)).toMatchSnapshot();
  });
});
