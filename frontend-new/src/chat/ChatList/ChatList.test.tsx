// mute the console
import "src/_test_utilities/consoleMock";

import ChatList, { DATA_TEST_ID } from "./ChatList";
import { render, screen } from "src/_test_utilities/test-utils";
import { ChatMessageOrigin } from "src/chat/Chat.types";
import ChatMessage from "src/chat/ChatMessage/ChatMessage";

// mock the chat message component
jest.mock("src/chat/ChatMessage/ChatMessage", () => {
  const originalModule = jest.requireActual("src/chat/ChatMessage/ChatMessage");
  return {
    __esModule: true,
    ...originalModule,
    default: jest.fn(() => <div data-testid={originalModule.DATA_TEST_ID.CHAT_MESSAGE_CONTAINER}></div>),
  };
});

describe("ChatList", () => {
  beforeAll(() => {
    window.HTMLElement.prototype.scrollIntoView = jest.fn();
  });
  afterAll(() => {
    jest.clearAllMocks();
  });

  test("should render the Chat Header", () => {
    // GIVEN a message list, a clear message function, a send message function, and a typing status
    const givenMessages = [
      {
        id: 1,
        origin: ChatMessageOrigin.ME,
        message: "Hello",
        timestamp: Date.now(),
      },
      {
        id: 2,
        origin: ChatMessageOrigin.COMPASS,
        message: "Hi",
        timestamp: Date.now(),
      },
    ];
    const givenClearMessages = jest.fn();
    const givenSendMessage = jest.fn();
    const givenIsTyping = true; // Simulate typing state

    // WHEN the chat header is rendered
    render(
      <ChatList
        messages={givenMessages}
        sendMessage={givenSendMessage}
        clearMessages={givenClearMessages}
        isTyping={givenIsTyping}
      />
    );

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
          id: -1,
          message: "Typing...",
          origin: ChatMessageOrigin.COMPASS,
          timestamp: expect.any(Number),
        },
        isTyping: true,
      },
      {}
    );
  });
});
