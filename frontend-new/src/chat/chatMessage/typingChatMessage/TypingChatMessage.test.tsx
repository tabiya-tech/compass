// mute the console
import "src/_test_utilities/consoleMock";

import { render, screen, act } from "src/_test_utilities/test-utils";
import TypingChatMessage, { DATA_TEST_ID, UI_TEXT } from "src/chat/chatMessage/typingChatMessage/TypingChatMessage";
import { DATA_TEST_ID as CHAT_BUBBLE_DATA_TEST_ID } from "src/chat/chatMessage/components/chatBubble/ChatBubble";

// mock chat bubble component
jest.mock("src/chat/chatMessage/components/chatBubble/ChatBubble", () => {
  const originalModule = jest.requireActual("src/chat/chatMessage/components/chatBubble/ChatBubble");
  return {
    __esModule: true,
    ...originalModule,
    default: jest.fn(({ children }) => (
      <div data-testid={originalModule.DATA_TEST_ID.CHAT_MESSAGE_BUBBLE_CONTAINER}>{children}</div>
    )),
  };
});

// mock framer-motion
jest.mock("framer-motion", () => {
  return {
    AnimatePresence: jest.fn(({ children }) => <>{children}</>),
    motion: {
      div: jest.fn(({ children, ...props }) => <div {...props}>{children}</div>),
    },
  };
});

describe("TypingChatMessage", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("should render the Typing Chat message correctly when ai is typing", () => {
    // GIVEN a Typing Chat message component
    const givenComponent = <TypingChatMessage />;

    // WHEN the Typing Chat message is rendered
    render(givenComponent);

    // THEN expect the message container to be visible
    const typingChatMessageContainer = screen.getByTestId(DATA_TEST_ID.TYPING_CHAT_MESSAGE_CONTAINER);
    expect(typingChatMessageContainer).toBeInTheDocument();
    // AND expect the message bubble to be visible
    expect(screen.getByTestId(CHAT_BUBBLE_DATA_TEST_ID.CHAT_MESSAGE_BUBBLE_CONTAINER)).toBeInTheDocument();
    // AND expect the typing text to be displayed
    expect(screen.getByText(UI_TEXT.TYPING)).toBeInTheDocument();
    // AND expect to find 3 dots (periods)
    const dots = screen.getAllByText(".");
    expect(dots).toHaveLength(3);
    // AND the component to match the snapshot
    expect(typingChatMessageContainer).toMatchSnapshot();
    // THEN expect no errors or warnings to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should render the Typing Chat message correctly when ai is thinking", () => {
    // GIVEN a Typing Chat message component
    const givenComponent = <TypingChatMessage waitBeforeThinking={0} />;

    // WHEN the Typing Chat message is rendered
    render(givenComponent);

    // THEN expect the message container to be visible
    const typingChatMessageContainer = screen.getByTestId(DATA_TEST_ID.TYPING_CHAT_MESSAGE_CONTAINER);
    expect(typingChatMessageContainer).toBeInTheDocument();
    // AND expect the message bubble to be visible
    expect(screen.getByTestId(CHAT_BUBBLE_DATA_TEST_ID.CHAT_MESSAGE_BUBBLE_CONTAINER)).toBeInTheDocument();

    // WHEN timers advanced
    act(() => {
      jest.runAllTimers();
    });

    // THEN expect the thinking text to be displayed
    expect(screen.getByText(UI_TEXT.THINKING)).toBeInTheDocument();
    // AND expect to find 3 dots (periods)
    const dots = screen.getAllByText(".");
    expect(dots).toHaveLength(3);
    // AND the component to match the snapshot
    expect(typingChatMessageContainer).toMatchSnapshot();
    // THEN expect no errors or warnings to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should change from 'Typing' to 'Thinking' text after waitBeforeThinking period", () => {
    // GIVEN a specific wait time in milliseconds
    const waitTime = 1000;
    const givenComponent = <TypingChatMessage waitBeforeThinking={waitTime} />;

    // WHEN the component is rendered
    render(givenComponent);

    // THEN initially it should display the typing text
    expect(screen.getByText(UI_TEXT.TYPING)).toBeInTheDocument();
    // AND the thinking text should not be displayed
    expect(screen.queryByText(UI_TEXT.THINKING)).not.toBeInTheDocument();

    // WHEN advancing time past the waitBeforeThinking time
    act(() => {
      jest.advanceTimersByTime(waitTime + 100);
    });

    // THEN it should now display the thinking text
    expect(screen.getByText(UI_TEXT.THINKING)).toBeInTheDocument();
    // AND the typing text should not be displayed
    expect(screen.queryByText(UI_TEXT.TYPING)).not.toBeInTheDocument();
    // AND expect no errors or warnings to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });
});
