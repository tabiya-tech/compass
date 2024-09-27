// mute the console
import "src/_test_utilities/consoleMock";

import ChatList, { DATA_TEST_ID } from "./ChatList";
import { render, screen } from "src/_test_utilities/test-utils";
import ChatMessage from "src/chat/ChatMessage/ChatMessage";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import { nanoid } from "nanoid";

// mock the chat message component
jest.mock("src/chat/ChatMessage/ChatMessage", () => {
  const originalModule = jest.requireActual("src/chat/ChatMessage/ChatMessage");
  return {
    __esModule: true,
    ...originalModule,
    default: jest.fn(() => <div data-testid={originalModule.DATA_TEST_ID.CHAT_MESSAGE_CONTAINER}></div>),
  };
});

jest.mock("src/auth/services/socialAuth/SocialAuth.service", () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => {
      return {
        logout: jest.fn(),
      };
    }),
  };
});

describe("ChatList", () => {
  beforeAll(() => {
    window.HTMLElement.prototype.scrollIntoView = jest.fn();
  });
  afterAll(() => {
    jest.clearAllMocks();
  });

  test("should render the Chat List", () => {
    // GIVEN a message list, a clear message function, a send message function, and a typing status
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
    ];
    const givenIsTyping = true; // Simulate typing state

    // WHEN the chat header is rendered
    render(<ChatList messages={givenMessages} isTyping={givenIsTyping} />);

    // THEN expect the chat header to be visible
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_LIST_CONTAINER)).toBeInTheDocument();

    // THEN expect the ChatMessage component to be rendered for each message
    expect(ChatMessage).toHaveBeenNthCalledWith(
      1,
      {
        chatMessage: givenMessages[0],
        isTyping: false,
      },
      {}
    );
    expect(ChatMessage).toHaveBeenNthCalledWith(
      2,
      {
        chatMessage: givenMessages[1],
        isTyping: false,
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
        },
        isTyping: true,
      },
      {}
    );

    // AND expect the scrollIntoView function to be called
    expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();

    // AND expect the component to match the snapshot
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_LIST_CONTAINER)).toMatchSnapshot();
  });
});
