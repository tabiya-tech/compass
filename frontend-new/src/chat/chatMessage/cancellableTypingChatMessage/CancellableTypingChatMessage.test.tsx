// mute the console
import "src/_test_utilities/consoleMock";

import { render, screen, fireEvent, act } from "src/_test_utilities/test-utils";
import CancellableTypingChatMessage, { DATA_TEST_ID, UI_TEXT } from "./CancellableTypingChatMessage";
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

describe("CancellableTypingChatMessage", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("should render the Cancellable Typing Chat message correctly with default text", () => {
    // GIVEN a Cancellable Typing Chat message component with a cancel handler
    const mockOnCancel = jest.fn();
    const givenComponent = <CancellableTypingChatMessage onCancel={mockOnCancel} />;

    // WHEN the Cancellable Typing Chat message is rendered
    render(givenComponent);

    // THEN expect the message container to be visible
    const cancellableTypingChatMessageContainer = screen.getByTestId(
      DATA_TEST_ID.CANCELLABLE_TYPING_CHAT_MESSAGE_CONTAINER
    );
    expect(cancellableTypingChatMessageContainer).toBeInTheDocument();
    // AND expect the message bubble to be visible
    expect(screen.getByTestId(CHAT_BUBBLE_DATA_TEST_ID.CHAT_MESSAGE_BUBBLE_CONTAINER)).toBeInTheDocument();
    // AND expect the default typing text to be displayed
    expect(screen.getByText(UI_TEXT.TYPING)).toBeInTheDocument();
    // AND expect to find 3 dots (periods)
    const dots = screen.getAllByText(".");
    expect(dots).toHaveLength(3);
    // AND expect the cancel button to be visible with correct text
    const cancelButton = screen.getByTestId(DATA_TEST_ID.CANCEL_BUTTON);
    expect(cancelButton).toBeInTheDocument();
    expect(cancelButton).toHaveTextContent(UI_TEXT.CANCEL);
    // AND the component to match the snapshot
    expect(cancellableTypingChatMessageContainer).toMatchSnapshot();
    // THEN expect no errors or warnings to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should render with custom typing and thinking messages", () => {
    // GIVEN custom messages
    const customTypingMessage = "Custom typing message";
    const customThinkingMessage = "Custom thinking message";
    const mockOnCancel = jest.fn();
    const givenComponent = (
      <CancellableTypingChatMessage
        message={customTypingMessage}
        thinkingMessage={customThinkingMessage}
        onCancel={mockOnCancel}
      />
    );

    // WHEN the component is rendered
    render(givenComponent);

    // THEN expect the custom typing message to be displayed
    expect(screen.getByText(customTypingMessage)).toBeInTheDocument();
    // AND the custom thinking message should not be displayed yet
    expect(screen.queryByText(customThinkingMessage)).not.toBeInTheDocument();

    // WHEN advancing time past the waitBeforeThinking time
    act(() => {
      jest.runAllTimers();
    });

    // THEN expect the custom thinking message to be displayed
    expect(screen.getByText(customThinkingMessage)).toBeInTheDocument();
    // AND the custom typing message should not be displayed anymore
    expect(screen.queryByText(customTypingMessage)).not.toBeInTheDocument();
    // AND expect no errors or warnings to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should call onCancel when cancel button is clicked", () => {
    // GIVEN a Cancellable Typing Chat message component with a cancel handler
    const mockOnCancel = jest.fn();
    const givenComponent = <CancellableTypingChatMessage onCancel={mockOnCancel} />;

    // WHEN the Cancellable Typing Chat message is rendered
    render(givenComponent);
    // AND the cancel button is clicked
    const cancelButton = screen.getByTestId(DATA_TEST_ID.CANCEL_BUTTON);
    fireEvent.click(cancelButton);

    // THEN expect the onCancel handler to have been called
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
    // AND expect no errors or warnings to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should change from typing to thinking text after waitBeforeThinking period", () => {
    // GIVEN a specific wait time in milliseconds
    const waitTime = 1000;
    const mockOnCancel = jest.fn();
    const givenComponent = <CancellableTypingChatMessage waitBeforeThinking={waitTime} onCancel={mockOnCancel} />;

    // WHEN the component is rendered
    render(givenComponent);

    // THEN initially it should display the typing text
    expect(screen.getByText(UI_TEXT.TYPING)).toBeInTheDocument();
    // AND the thinking text should not be displayed
    expect(screen.queryByText(UI_TEXT.THINKING)).not.toBeInTheDocument();

    // WHEN advancing time past the waitBeforeThinking time
    act(() => {
      jest.runAllTimers();
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
