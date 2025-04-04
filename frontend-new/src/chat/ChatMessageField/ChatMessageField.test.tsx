// mute the console
import "src/_test_utilities/consoleMock";

import ChatMessageField, {
  DATA_TEST_ID,
  CHAT_MESSAGE_MAX_LENGTH,
  DISALLOWED_CHARACTERS,
  ERROR_MESSAGES,
  PLACEHOLDER_TEXTS,
} from "./ChatMessageField";
import { render, screen, fireEvent, act, userEvent, waitFor } from "src/_test_utilities/test-utils";
import { mockBrowserIsOnLine, unmockBrowserIsOnLine } from "src/_test_utilities/mockBrowserIsOnline";

describe("ChatMessageField", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    unmockBrowserIsOnLine();
  });

  test("should render correctly", () => {
    // WHEN ChatMessageField is rendered
    render(<ChatMessageField aiIsTyping={false} isChatFinished={false} handleSend={jest.fn()} />);

    //THEN expect no errors or warnings has occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    // AND the ChatMessageField container to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_CONTAINER)).toBeInTheDocument();
    // AND the ChatMessageField input to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD)).toBeInTheDocument();
    // AND the ChatMessageField button to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_BUTTON)).toBeInTheDocument();
    // AND the ChatMessageField icon to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_ICON)).toBeInTheDocument();
    // AND to match the snapshot
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_CONTAINER)).toMatchSnapshot();
  });

  test("should render correctly with error message when the message is too long", () => {
    // GIVEN a long message
    const message = "a".repeat(CHAT_MESSAGE_MAX_LENGTH + 2);

    // WHEN ChatMessageField is rendered
    render(<ChatMessageField aiIsTyping={false} isChatFinished={false} handleSend={jest.fn()} />);
    // AND the input is changed
    const ChatMessageFieldInput = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD);
    fireEvent.change(ChatMessageFieldInput, { target: { value: message } });

    // THEN expect the error message to be in the document
    expect(screen.getByText(`Message limit is ${CHAT_MESSAGE_MAX_LENGTH} characters.`)).toBeInTheDocument();
    // AND the send button to be disabled
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_BUTTON)).toBeDisabled();
    // AND the input field should be enabled
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD)).toBeEnabled();
    // AND no errors or warnings to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should render correctly with error message when the message contains invalid characters", () => {
    // WHEN a message that contains invalid characters
    const invalidMessage = "foobar{}&*";
    const invalidChar = invalidMessage.split("").filter((char) => DISALLOWED_CHARACTERS.test(char));

    // WHEN ChatMessageField is rendered
    render(<ChatMessageField aiIsTyping={false} isChatFinished={false} handleSend={jest.fn()} />);
    // AND the input is changed
    const ChatMessageFieldInput = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD);
    fireEvent.change(ChatMessageFieldInput, { target: { value: invalidMessage } });

    // THEN expect the error message to be in the document
    expect(screen.getByText(`${ERROR_MESSAGES.INVALID_SPECIAL_CHARACTERS}${invalidChar}`)).toBeInTheDocument();
    // AND the send button should be enabled
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_BUTTON)).toBeEnabled();
    // AND the input field should be enabled
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD)).toBeEnabled();
    // AND no errors or warnings to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should render correctly with no error message when the message is valid", () => {
    // GIVEN a valid message
    const validMessage = "foo bar";

    // WHEN ChatMessageField is rendered
    render(<ChatMessageField aiIsTyping={false} isChatFinished={false} handleSend={jest.fn()} />);
    // AND the input is changed
    const ChatMessageFieldInput = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD);
    fireEvent.change(ChatMessageFieldInput, { target: { value: validMessage } });

    // THEN expect no error message to be in the document
    expect(screen.queryByText(ERROR_MESSAGES.MESSAGE_LIMIT)).toBeNull();
    expect(screen.queryByText(ERROR_MESSAGES.INVALID_SPECIAL_CHARACTERS)).toBeNull();
    // AND the send button should be enabled
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_BUTTON)).toBeEnabled();
    // AND the input field should be enabled
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD)).toBeEnabled();
    // AND no errors or warnings to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should maintain caret position when adding invalid characters in the middle of the message", async () => {
    // GIVEN the ChatMessageField is rendered
    render(<ChatMessageField aiIsTyping={false} isChatFinished={false} handleSend={jest.fn()} />);
    // AND the chat message field
    const chatMessageField = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD) as HTMLInputElement;

    // WHEN the user types a valid message
    await userEvent.type(chatMessageField, "Hello");
    // AND user moves caret to the middle of the text (after "Hello")
    chatMessageField.setSelectionRange(2, 2);

    // THEN except the caret position to be at 2
    expect(chatMessageField.selectionStart).toBe(2);

    // WHEN user types an invalid character at that position
    // We need to use act to make sure the input updates and caret position are handled before the test checks them.
    // eslint-disable-next-line testing-library/no-unnecessary-act
    act(() => {
      userEvent.type(chatMessageField, "*");
    });

    // THEN expect the invalid characters to be removed
    expect(chatMessageField).toHaveValue("Hello");
    // AND expect the caret to be at the correct position
    expect(chatMessageField.selectionStart).toBe(2);
    // AND no errors or warnings to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  describe("character counter", () => {
    test("should render the character counter when the message is longer than 75% of the max allowed length", () => {
      // GIVEN a long message (76%)
      const message = "a".repeat(CHAT_MESSAGE_MAX_LENGTH * 0.76);

      // WHEN ChatMessageField is rendered
      render(<ChatMessageField aiIsTyping={false} isChatFinished={false} handleSend={jest.fn()} />);

      // AND the input is changed
      const ChatMessageFieldInput = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD);

      fireEvent.change(ChatMessageFieldInput, { target: { value: message } });

      // THEN expect the character counter to be in the document
      expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_CHAR_COUNTER)).toBeInTheDocument();
      // AND the character counter to be correct
      expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_CHAR_COUNTER)).toHaveTextContent(
        `${message.length}/${CHAT_MESSAGE_MAX_LENGTH}`
      );
      // AND the send button should be enabled
      expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_BUTTON)).toBeEnabled();
      // AND the input field should be enabled
      expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD)).toBeEnabled();
      // AND no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should not render the character counter when the message is shorter than or equal to 75% of the max allowed length", () => {
      // GIVEN a short message (75%)
      const message = "a".repeat(CHAT_MESSAGE_MAX_LENGTH * 0.75);

      // WHEN ChatMessageField is rendered
      render(<ChatMessageField aiIsTyping={false} isChatFinished={false} handleSend={jest.fn()} />);

      // AND the input is changed
      const ChatMessageFieldInput = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD);

      fireEvent.change(ChatMessageFieldInput, { target: { value: message } });

      // THEN expect the character counter not to be in the document
      expect(screen.queryByTestId(DATA_TEST_ID.CHAT_MESSAGE_CHAR_COUNTER)).not.toBeInTheDocument();
      // AND the send button should be enabled
      expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_BUTTON)).toBeEnabled();
      // AND the input field should be enabled
      expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD)).toBeEnabled();
      // AND no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });
  });

  describe("ChatMessageField action tests", () => {
    describe("sending a message", () => {
      test("should call handleSend when button is clicked", async () => {
        // GIVEN handleSend function
        const handleSend = jest.fn();
        // AND the user message
        const givenMessage = "foo";

        // WHEN ChatMessageField is rendered
        render(<ChatMessageField aiIsTyping={false} isChatFinished={false} handleSend={handleSend} />);
        // AND the user types the message
        const chatMessageField = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD);
        await userEvent.type(chatMessageField, givenMessage);
        // AND the button is clicked
        const chatMessageFieldButton = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_BUTTON);
        await userEvent.click(chatMessageFieldButton);

        // THEN expect handleSend to be called with the actual message
        expect(handleSend).toHaveBeenCalledWith(givenMessage);
        // AND no errors or warnings to have occurred
        expect(console.error).not.toHaveBeenCalled();
        expect(console.warn).not.toHaveBeenCalled();
      });

      test.each([
        ["empty string", ""],
        ["only spaces", "   "],
      ])("should disable sending a message when the message is %s", async (_description, message) => {
        // GIVEN handleSend function
        const handleSend = jest.fn();

        // WHEN ChatMessageField is rendered
        render(<ChatMessageField aiIsTyping={false} isChatFinished={false} handleSend={handleSend} />);

        // AND the user types the message
        const chatMessageField = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD);
        if (message) {
          await userEvent.type(chatMessageField, message);
        }

        // THEN expect handleSend not to be called
        expect(handleSend).not.toHaveBeenCalled();
        // AND expect the button to be disabled
        const chatMessageFieldButton = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_BUTTON);
        expect(chatMessageFieldButton).toBeDisabled();
        // AND chat message input to be enabled
        expect(chatMessageField).toBeEnabled();
        // AND no errors or warnings to have occurred
        expect(console.error).not.toHaveBeenCalled();
        expect(console.warn).not.toHaveBeenCalled();
      });
    });

    describe("disable input field and send button", () => {
      test("should disable the send button and input field when AI is typing", () => {
        // GIVEN handleSend function
        const handleSend = jest.fn();
        // AND AI is typing
        const givenAiIsTyping = true;

        // WHEN ChatMessageField is rendered
        render(<ChatMessageField aiIsTyping={givenAiIsTyping} isChatFinished={false} handleSend={handleSend} />);

        // THEN expect the chat message field button to be disabled
        const chatMessageFieldButton = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_BUTTON);
        expect(chatMessageFieldButton).toBeDisabled();
        // AND the chat message field to be disabled
        const chatMessageField = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD);
        expect(chatMessageField).toBeDisabled();
        // AND the placeholder should have specific text
        expect(chatMessageField).toHaveAttribute("placeholder", PLACEHOLDER_TEXTS.AI_TYPING);
        // AND the handleSend not to be called
        expect(handleSend).not.toHaveBeenCalled();
        // AND no errors or warnings to have occurred
        expect(console.error).not.toHaveBeenCalled();
        expect(console.warn).not.toHaveBeenCalled();
      });

      test("should disable the send button and input field when chat is finished", () => {
        // GIVEN handleSend function
        const handleSend = jest.fn();
        // AND chat is finished
        const givenIsChatFinished = true;

        // WHEN ChatMessageField is rendered
        render(<ChatMessageField aiIsTyping={false} isChatFinished={givenIsChatFinished} handleSend={handleSend} />);

        // THEN expect chat message field button to be disabled
        const chatMessageFieldButton = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_BUTTON);
        expect(chatMessageFieldButton).toBeDisabled();
        // AND the chat message field to be disabled
        const chatMessageField = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD);
        expect(chatMessageField).toBeDisabled();
        // AND the placeholder should have specific text
        expect(chatMessageField).toHaveAttribute("placeholder", PLACEHOLDER_TEXTS.CHAT_FINISHED);
        // AND no errors or warnings to have occurred
        expect(console.error).not.toHaveBeenCalled();
        expect(console.warn).not.toHaveBeenCalled();
      });

      test("should disable the send button and input field when browser is offline", () => {
        // GIVEN the browser is offline
        mockBrowserIsOnLine(false);
        // AND handleSend function
        const handleSend = jest.fn();

        // WHEN ChatMessageField is rendered
        render(<ChatMessageField aiIsTyping={false} isChatFinished={false} handleSend={handleSend} />);

        // THEN expect the chat message field button to be disabled
        const chatMessageFieldButton = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_BUTTON);
        expect(chatMessageFieldButton).toBeDisabled();
        // AND the chat message field to be disabled
        const chatMessageField = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD);
        expect(chatMessageField).toBeDisabled();
        // AND the placeholder should have specific text
        expect(chatMessageField).toHaveAttribute("placeholder", PLACEHOLDER_TEXTS.OFFLINE);
        // AND no errors or warnings to have occurred
        expect(console.error).not.toHaveBeenCalled();
        expect(console.warn).not.toHaveBeenCalled();
      });

      test("should disable the send button when message exceeds character limit", () => {
        // GIVEN a long message
        const message = "a".repeat(CHAT_MESSAGE_MAX_LENGTH + 2);
        // AND the component is rendered
        render(<ChatMessageField aiIsTyping={false} isChatFinished={false} handleSend={jest.fn()} />);

        // WHEN the user enters a message that exceeds the character limit
        const ChatMessageFieldInput = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD);
        fireEvent.change(ChatMessageFieldInput, { target: { value: message } });

        // THEN expect the chat message field button to be disabled
        const chatMessageFieldButton = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_BUTTON);
        expect(chatMessageFieldButton).toBeDisabled();
        // AND the chat message field to be enabled
        const chatMessageField = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD);
        expect(chatMessageField).toBeEnabled();
        // AND no errors or warnings to have occurred
        expect(console.error).not.toHaveBeenCalled();
        expect(console.warn).not.toHaveBeenCalled();
      });
    });

    test("should focus on the input once ai is done typing and blur it when the user scrolls", async () => {
      // GIVEN handleSend function
      const handleSend = jest.fn();
      // AND AI is not typing
      const givenAiIsTyping = false;

      // WHEN ChatMessageField is rendered
      render(<ChatMessageField aiIsTyping={givenAiIsTyping} isChatFinished={false} handleSend={handleSend} />);

      // THEN expect input to be focused
      const messageField = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD);
      expect(messageField).toHaveFocus();

      // WHEN the user scrolls
      fireEvent.touchEnd(window);

      // THEN expect the input to be blurred
      expect(messageField).not.toHaveFocus();
      // AND no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    describe("trimming message", () => {
      test("should trim message when sending it", async () => {
        // GIVEN handleSend function
        const handleSend = jest.fn();
        // AND a message with whitespace
        const messageWithWhitespace = "  message with spaces  ";

        // WHEN ChatMessageField is rendered
        render(<ChatMessageField aiIsTyping={false} isChatFinished={false} handleSend={handleSend} />);

        // AND the user types the message with whitespace
        const chatMessageField = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD);
        await userEvent.type(chatMessageField, messageWithWhitespace);

        // AND the button is clicked
        const chatMessageFieldButton = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_BUTTON);
        await userEvent.click(chatMessageFieldButton);

        // THEN expect handleSend to be called with the trimmed message
        const expectedTrimmedMessage = "message with spaces";
        expect(handleSend).toHaveBeenCalledWith(expectedTrimmedMessage);
        // AND the input field should be empty after sending
        expect(chatMessageField).toHaveValue("");
        // AND no errors or warnings to have occurred
        expect(console.error).not.toHaveBeenCalled();
        expect(console.warn).not.toHaveBeenCalled();
      });

      test("should ignore spaces before and after (trim) and not count them in the size of message", () => {
        // GIVEN a message with spaces before and after that would exceed the limit if spaces counted
        const messageContent = "a".repeat(CHAT_MESSAGE_MAX_LENGTH);
        // AND the message with spaces (length is CHAT_MESSAGE_MAX_LENGTH + 8)
        const messageWithSpaces = `    ${messageContent}    `;

        // WHEN ChatMessageField is rendered
        render(<ChatMessageField aiIsTyping={false} isChatFinished={false} handleSend={jest.fn()} />);

        // AND the input is changed
        const chatMessageFieldInput = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD);
        fireEvent.change(chatMessageFieldInput, { target: { value: messageWithSpaces } });

        // THEN expect the character counter to show the trimmed length
        const charCounter = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_CHAR_COUNTER);
        expect(charCounter).toHaveTextContent(`${messageContent.length}/${CHAT_MESSAGE_MAX_LENGTH}`);
        // AND the send button should be enabled
        const sendButton = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_BUTTON);
        expect(sendButton).toBeEnabled();
        // AND there should be no error message
        expect(screen.queryByText(`Message limit is ${CHAT_MESSAGE_MAX_LENGTH} characters.`)).not.toBeInTheDocument();
        // AND no errors or warnings to have occurred
        expect(console.error).not.toHaveBeenCalled();
        expect(console.warn).not.toHaveBeenCalled();
      });
    });

    describe("handle keypress behavior", () => {
      test("should send message on desktops when pressing Enter", async () => {
        // GIVEN handleSend function
        const handleSend = jest.fn();
        // AND a message
        const givenMessage = "this is a message";
        // AND mock width for desktop
        Object.defineProperty(window, "innerWidth", { value: 1024, writable: true });
        // AND ChatMessageField is rendered
        render(<ChatMessageField aiIsTyping={false} isChatFinished={false} handleSend={handleSend} />);

        // WHEN the user types a message
        const chatMessageField = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD);
        await userEvent.type(chatMessageField, givenMessage);
        // AND presses Enter
        await userEvent.keyboard("{Enter}");

        // THEN expect handleSend to be called with the message
        expect(handleSend).toHaveBeenCalledWith(givenMessage);
        // AND the input field should be empty after sending
        expect(chatMessageField).toHaveValue("");
        // AND no errors or warnings to have occurred
        expect(console.error).not.toHaveBeenCalled();
        expect(console.warn).not.toHaveBeenCalled();
      });

      test("should add new line on desktops when pressing Shift+Enter keypress", async () => {
        // GIVEN handleSend function
        const handleSend = jest.fn();
        // AND a message
        const givenMessage = "this is a message";
        // AND mock width for desktop
        Object.defineProperty(window, "innerWidth", { value: 1024, writable: true });
        // AND ChatMessageField is rendered
        render(<ChatMessageField aiIsTyping={false} isChatFinished={false} handleSend={handleSend} />);

        // WHEN the user types a message
        const chatMessageField = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD);
        await userEvent.type(chatMessageField, givenMessage);
        // AND presses Shift+Enter
        await userEvent.keyboard("{Shift>}{Enter}{/Shift}");

        // THEN expect handleSend to not be called
        expect(handleSend).not.toHaveBeenCalled();
        // AND expect the message to contain a newline
        expect(chatMessageField).toHaveValue(`${givenMessage}\n`);
        // AND no errors or warnings to have occurred
        expect(console.error).not.toHaveBeenCalled();
        expect(console.warn).not.toHaveBeenCalled();
      });

      test("should add new line on mobile devices when pressing Enter", async () => {
        // GIVEN handleSend function
        const handleSend = jest.fn();
        // AND a message
        const givenMessage = "this is a message";
        // AND mock width for mobile
        Object.defineProperty(window, "innerWidth", { value: 360, writable: true });
        // AND ChatMessageField is rendered
        render(<ChatMessageField aiIsTyping={false} isChatFinished={false} handleSend={handleSend} />);

        // WHEN the user types a message
        const chatMessageField = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD);
        await userEvent.type(chatMessageField, givenMessage);
        // AND presses Enter
        await userEvent.keyboard("{Enter}");

        // THEN expect handleSend to not be called
        expect(handleSend).not.toHaveBeenCalled();
        // AND expect the message to contain a newline
        expect(chatMessageField).toHaveValue(`${givenMessage}\n`);
        // AND no errors or warnings to have occurred
        expect(console.error).not.toHaveBeenCalled();
        expect(console.warn).not.toHaveBeenCalled();
      });

      test("should set the caret position at the new line", async () => {
        // GIVEN the ChatMessageField is rendered
        render(<ChatMessageField aiIsTyping={false} isChatFinished={false} handleSend={jest.fn()} />);
        // AND the chat message field
        const chatMessageField = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD);

        // AND add the event listener to track the caret position
        let recordedCaretPos: number | null = null;
        const handleKeyDown = (event: any) => {
          recordedCaretPos = event.target.selectionStart;
        };
        chatMessageField.addEventListener("keyup", handleKeyDown);

        // WHEN the user types a message
        await userEvent.type(chatMessageField, "Hello");
        // AND move caret left twice (to position 3, between “l” and “l”)
        await userEvent.keyboard("{ArrowLeft}{ArrowLeft}");
        // AND presses Shift+Enter
        await userEvent.keyboard("{Shift>}{Enter}{/Shift}");

        // THEN expect the message to contain a newline
        expect(chatMessageField).toHaveValue("Hel\nlo");
        // AND recorded caret position to be at 3 (after the new line)
        await waitFor(() => {
          expect(recordedCaretPos).toBe(4);
        });
        // AND remove the event listener after the test
        chatMessageField.removeEventListener("keydown", handleKeyDown);
        // AND no errors or warnings to have occurred
        expect(console.error).not.toHaveBeenCalled();
        expect(console.warn).not.toHaveBeenCalled();
      });
    });
  });
});
