// mute the console
import "src/_test_utilities/consoleMock";

import ChatMessageField, {
  DATA_TEST_ID,
  CHAT_MESSAGE_MAX_LENGTH,
  DISALLOWED_CHARACTERS,
  ERROR_MESSAGES,
  PLACEHOLDER_TEXTS,
  MENU_ITEM_ID,
  MAX_FILE_SIZE_BYTES,
} from "./ChatMessageField";
import { render, screen, fireEvent, act, userEvent, waitFor } from "src/_test_utilities/test-utils";
import { mockBrowserIsOnLine, unmockBrowserIsOnLine } from "src/_test_utilities/mockBrowserIsOnline";
import { ConversationPhase } from "src/chat/chatProgressbar/types";
import ContextMenu from "src/theme/ContextMenu/ContextMenu";
import { MenuItemConfig } from "src/theme/ContextMenu/menuItemConfig.types";
import { StatusCodes } from "http-status-codes";
import ErrorConstants from "src/error/restAPIError/RestAPIError.constants";
import { getCvUploadEnabled } from "src/envService";
import AuthenticationStateService from "src/auth/services/AuthenticationState.service";
import CVService from "src/CV/CVService/CVService";

// mock the getCvUploadEnabled function
jest.mock("src/envService", () => ({
  ...jest.requireActual("src/envService"),
  getCvUploadEnabled: jest.fn(),
}));

const mockGetCvUploadEnabled = getCvUploadEnabled as jest.MockedFunction<typeof getCvUploadEnabled>;

// mock the ContextMenu
jest.mock("src/theme/ContextMenu/ContextMenu", () => {
  const actual = jest.requireActual("src/theme/ContextMenu/ContextMenu");
  return {
    __esModule: true,
    default: jest.fn(({ items }: { items: MenuItemConfig[] }) => (
      <div data-testid={actual.DATA_TEST_ID.MENU}>
        {items.map((item) => {
          // Render custom menu items
          if ((item as any).customNode) {
            return (
              <div key={item.id} data-testid={item.id}>
                {(item as any).customNode}
              </div>
            );
          }
          return (
            <div key={item.id} data-testid={item.id} onClick={item.action}>
              {item.text}
            </div>
          );
        })}
      </div>
    )),
    DATA_TEST_ID: actual.DATA_TEST_ID,
  };
});

describe("ChatMessageField", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    unmockBrowserIsOnLine();
    // Default to CV upload enabled for most tests
    mockGetCvUploadEnabled.mockReturnValue("true");
  });

  test("should render correctly", () => {
    // WHEN ChatMessageField is rendered
    render(
      <ChatMessageField
        aiIsTyping={false}
        isChatFinished={false}
        handleSend={jest.fn()}
        currentPhase={ConversationPhase.INTRO}
      />
    );

    //THEN expect no errors or warnings has occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    // AND the ChatMessageField container to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_CONTAINER)).toBeInTheDocument();
    // AND the ChatMessageField input to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD)).toBeInTheDocument();
    // AND the ChatMessageField send button to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_SEND_BUTTON)).toBeInTheDocument();
    // AND the ChatMessageField send icon to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_SEND_ICON)).toBeInTheDocument();
    // AND the ChatMessageField plus button to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_PLUS_BUTTON)).toBeInTheDocument();
    // AND the ChatMessageField plus icon to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_PLUS_ICON)).toBeInTheDocument();
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
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_SEND_BUTTON)).toBeDisabled();
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
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_SEND_BUTTON)).toBeEnabled();
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
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_SEND_BUTTON)).toBeEnabled();
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
      expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_SEND_BUTTON)).toBeEnabled();
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
      expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_SEND_BUTTON)).toBeEnabled();
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
        const chatMessageFieldButton = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_SEND_BUTTON);
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
        const chatMessageFieldButton = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_SEND_BUTTON);
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
        const chatMessageFieldButton = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_SEND_BUTTON);
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
        const chatMessageFieldButton = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_SEND_BUTTON);
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
        const chatMessageFieldButton = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_SEND_BUTTON);
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
        const chatMessageFieldButton = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_SEND_BUTTON);
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
        const chatMessageFieldButton = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_SEND_BUTTON);
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
        const sendButton = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_SEND_BUTTON);
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

    describe("Plus button", () => {
      let mockCVServiceInstance: { getAllCVs: jest.Mock };

      beforeEach(() => {
        // Mock user to be logged in by default
        const givenUser = { id: "fooUser", name: "Foo User", email: "foo@bar" };
        AuthenticationStateService.getInstance().setUser(givenUser);

        mockCVServiceInstance = {
          getAllCVs: jest.fn().mockResolvedValue([]),
        };
        jest.spyOn(CVService, "getInstance").mockReturnValue(mockCVServiceInstance as any);
      });

      test("should open file picker and handle file upload when plus button is clicked", async () => {
        // GIVEN an INTRO phase and a mock onUploadCv
        const mockOnUploadCv = jest.fn().mockResolvedValue(["parsed CV content"]);
        render(
          <ChatMessageField
            aiIsTyping={false}
            isChatFinished={false}
            handleSend={jest.fn()}
            currentPhase={ConversationPhase.INTRO}
            onUploadCv={mockOnUploadCv}
          />
        );

        // WHEN the plus button is clicked
        const plusButton = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_PLUS_BUTTON);
        await userEvent.click(plusButton);

        // AND the context menu is opened
        await waitFor(() => {
          expect(ContextMenu).toHaveBeenCalledWith(
            expect.objectContaining({
              anchorEl: plusButton,
              open: true,
            }),
            {}
          );
        });

        // AND the user clicks an upload file option
        const uploadFileOption = screen.getByTestId(MENU_ITEM_ID.UPLOAD_CV);
        await userEvent.click(uploadFileOption);

        // AND a file is selected
        const fileInput = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_HIDDEN_FILE_INPUT);
        const file = new File(["dummy content"], "cv.pdf", { type: "application/pdf" });
        await userEvent.upload(fileInput, file);

        // THEN expect onUploadCv to be called with the file
        expect(mockOnUploadCv).toHaveBeenCalledWith(file);
        // AND the composed content (intro + bullets) should be added to the input field
        const chatMessageField = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD);
        await waitFor(() => {
          expect(chatMessageField).toHaveValue("These are my experiences:\n• parsed CV content");
        });
        // AND no errors or warnings to have occurred
        expect(console.error).not.toHaveBeenCalled();
        expect(console.warn).not.toHaveBeenCalled();
      });

      test("should show error message when file upload exceeds size limit", async () => {
        // GIVEN an INTRO phase and a mock onUploadCv
        const mockOnUploadCv = jest.fn();
        render(
          <ChatMessageField
            aiIsTyping={false}
            isChatFinished={false}
            handleSend={jest.fn()}
            currentPhase={ConversationPhase.INTRO}
            onUploadCv={mockOnUploadCv}
          />
        );

        // WHEN the plus button is clicked
        const plusButton = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_PLUS_BUTTON);
        await userEvent.click(plusButton);

        // AND the context menu is opened
        await waitFor(() => {
          expect(ContextMenu).toHaveBeenCalledWith(
            expect.objectContaining({
              anchorEl: plusButton,
              open: true,
            }),
            {}
          );
        });

        // AND the user clicks an upload file option
        const uploadFileOption = screen.getByTestId(MENU_ITEM_ID.UPLOAD_CV);
        await userEvent.click(uploadFileOption);

        // AND a file is selected that exceeds the size limit
        const fileInput = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_HIDDEN_FILE_INPUT);
        const largeFile = new File([new ArrayBuffer(MAX_FILE_SIZE_BYTES * 2)], "large_cv.pdf", {
          type: "application/pdf",
        });
        await userEvent.upload(fileInput, largeFile);

        // THEN expect onUploadCv not to be called
        expect(mockOnUploadCv).not.toHaveBeenCalled();
        // AND expect an error message to be shown
        await waitFor(() => {
          expect(screen.getByText(ERROR_MESSAGES.MAX_FILE_SIZE)).toBeInTheDocument();
        });
        // AND no errors or warnings to have occurred
        expect(console.error).not.toHaveBeenCalled();
        expect(console.warn).not.toHaveBeenCalled();
      });

      test("should disable text field and display the correct placeholder when uploading a file", async () => {
        // GIVEN a mock onUploadCv that resolves after a delay
        const mockOnUploadCv = jest.fn().mockResolvedValue(["parsed CV content"]);
        // AND the file is being uploaded
        const mockIsUploadingCv = true;

        // WHEN ChatMessageField is rendered
        render(
          <ChatMessageField
            aiIsTyping={false}
            isChatFinished={false}
            handleSend={jest.fn()}
            currentPhase={ConversationPhase.COLLECT_EXPERIENCES}
            onUploadCv={mockOnUploadCv}
            isUploadingCv={mockIsUploadingCv}
          />
        );

        // THEN expect the text field to be disabled while uploading
        const chatMessageField = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD);
        expect(chatMessageField).toBeDisabled();
        // AND the placeholder should indicate uploading
        expect(chatMessageField).toHaveAttribute("placeholder", PLACEHOLDER_TEXTS.UPLOADING);
        // AND no errors or warnings to have occurred
        expect(console.error).not.toHaveBeenCalled();
        expect(console.warn).not.toHaveBeenCalled();
      });

      test("should show plus button in all phases when CV upload is enabled", async () => {
        // GIVEN a non-relevant phase and a mock onUploadCv
        const currentPhase = ConversationPhase.DIVE_IN;

        // WHEN ChatMessageField is rendered
        render(
          <ChatMessageField
            aiIsTyping={false}
            isChatFinished={false}
            handleSend={jest.fn()}
            currentPhase={currentPhase}
            onUploadCv={jest.fn()}
          />
        );

        // THEN expect the plus button to be in the document
        expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_PLUS_BUTTON)).toBeInTheDocument();

        // AND no errors or warnings to have occurred
        expect(console.error).not.toHaveBeenCalled();
        expect(console.warn).not.toHaveBeenCalled();
      });

      test("should handle 413 error when uploading a CV with too much text", async () => {
        // GIVEN an INTRO phase
        const givenPhase = ConversationPhase.INTRO;
        // AND a mock onUploadCv that rejects with a 413 error
        const tooLargeErrorAlt = new Error(ERROR_MESSAGES.FILE_TOO_DENSE);
        (tooLargeErrorAlt as any).status = StatusCodes.REQUEST_TOO_LONG;
        (tooLargeErrorAlt as any).errorCode = ErrorConstants.ErrorCodes.TOO_LARGE_PAYLOAD;

        const mockOnUploadCv = jest.fn().mockRejectedValue(tooLargeErrorAlt);

        // AND ChatMessageField is rendered
        render(
          <ChatMessageField
            aiIsTyping={false}
            isChatFinished={false}
            handleSend={jest.fn()}
            currentPhase={givenPhase}
            onUploadCv={mockOnUploadCv}
          />
        );

        // WHEN plus button is clicked
        const plusButton = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_PLUS_BUTTON);
        await userEvent.click(plusButton);

        // AND the user clicks an upload file option
        const uploadFileOption = screen.getByTestId(MENU_ITEM_ID.UPLOAD_CV);
        await userEvent.click(uploadFileOption);

        // AND a file is selected
        const fileInput = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_HIDDEN_FILE_INPUT);
        const file = new File(["dummy content"], "cv.pdf", { type: "application/pdf" });
        await userEvent.upload(fileInput, file);

        // THEN expect onUploadCv to be called with the file
        expect(mockOnUploadCv).toHaveBeenCalledWith(file);

        // AND the specific error message for too dense content to be shown
        await waitFor(() => {
          expect(screen.getByText(ERROR_MESSAGES.FILE_TOO_DENSE)).toBeInTheDocument();
        });

        // AND console.error should be called for logging the error
        expect(console.error).toHaveBeenCalled();
      });

      test("should show uploaded CVs and load selected CV content in the field", async () => {
        // GIVEN COLLECT_EXPERIENCES phase
        const givenPhase = ConversationPhase.COLLECT_EXPERIENCES;
        // AND a mock onUploadCv
        const mockOnUploadCv = jest.fn().mockResolvedValue(["parsed CV content"]);
        // AND mock CVs returned from the service
        const mockCvs = [
          {
            upload_id: "cv1",
            filename: "foo_bar.pdf",
            uploaded_at: new Date().toISOString(),
            upload_process_state: "COMPLETED",
            experiences_data: ["foo"],
          },
          {
            upload_id: "cv2",
            filename: "foo_baz.pdf",
            uploaded_at: new Date().toISOString(),
            upload_process_state: "COMPLETED",
            experiences_data: ["foo", "bar"],
          },
        ];
        mockCVServiceInstance.getAllCVs.mockResolvedValue(mockCvs);
        // AND ChatMessageField is rendered
        render(
          <ChatMessageField
            handleSend={jest.fn()}
            aiIsTyping={false}
            isChatFinished={false}
            onUploadCv={mockOnUploadCv}
            currentPhase={givenPhase}
          />
        );

        // WHEN the plus button is clicked
        const plusButton = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_PLUS_BUTTON);
        await userEvent.click(plusButton);
        // AND the "Previously uploaded CVs" menu item is clicked
        const viewUploadedCvsOption = screen.getByTestId(MENU_ITEM_ID.VIEW_UPLOADED_CVS);
        await userEvent.click(viewUploadedCvsOption);

        // THEN expect getAllCVs to be called
        await waitFor(() => {
          expect(mockCVServiceInstance.getAllCVs).toHaveBeenCalled();
        });

        // AND the uploaded CVs should be displayed (after async fetch + render)
        expect(await screen.findByText("foo_bar.pdf")).toBeInTheDocument();
        expect(await screen.findByText("foo_baz.pdf")).toBeInTheDocument();

        // WHEN a CV is selected from the list
        const firstCVItem = await screen.findByText("foo_bar.pdf");
        await userEvent.click(firstCVItem);

        // THEN expect the composed content from the selected CV to be added to the input field
        const chatMessageField = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD);
        await waitFor(() => {
          expect(chatMessageField).toHaveValue("These are my experiences:\n• foo");
        });
        // AND the menu should close
        expect(screen.queryByTestId(MENU_ITEM_ID.VIEW_UPLOADED_CVS)).not.toBeInTheDocument();
        // AND no errors or warnings to have occurred
        expect(console.error).not.toHaveBeenCalled();
        expect(console.warn).not.toHaveBeenCalled();
      });
    });
  });

  describe("CV Upload Feature Flag", () => {
    let mockCVServiceInstance: { getAllCVs: jest.Mock };

    beforeEach(() => {
      // Mock user to be logged in by default
      const givenUser = { id: "foo01", name: "Foo bar", email: "foo@bar" };
      AuthenticationStateService.getInstance().setUser(givenUser);

      mockCVServiceInstance = {
        getAllCVs: jest.fn().mockResolvedValue([]),
      };
      jest.spyOn(CVService, "getInstance").mockReturnValue(mockCVServiceInstance as any);
    });

    test("should show plus button and context menu when CV upload is enabled", () => {
      // GIVEN CV upload is enabled
      mockGetCvUploadEnabled.mockReturnValue("true");

      // WHEN ChatMessageField is rendered with a relevant phase
      render(
        <ChatMessageField
          aiIsTyping={false}
          isChatFinished={false}
          handleSend={jest.fn()}
          currentPhase={ConversationPhase.INTRO}
          onUploadCv={jest.fn()}
        />
      );

      // THEN expect the plus button to be in the document
      expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_PLUS_BUTTON)).toBeInTheDocument();
      // AND expect the plus icon to be in the document
      expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_PLUS_ICON)).toBeInTheDocument();
      // AND expect the hidden file input to be in the document
      expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_HIDDEN_FILE_INPUT)).toBeInTheDocument();
      // AND no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should hide plus button and context menu when CV upload is disabled", () => {
      // GIVEN CV upload is disabled
      mockGetCvUploadEnabled.mockReturnValue("false");

      // WHEN ChatMessageField is rendered with a relevant phase
      render(
        <ChatMessageField
          aiIsTyping={false}
          isChatFinished={false}
          handleSend={jest.fn()}
          currentPhase={ConversationPhase.INTRO}
          onUploadCv={jest.fn()}
        />
      );

      // THEN expect the plus button not to be in the document
      expect(screen.queryByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_PLUS_BUTTON)).not.toBeInTheDocument();
      // AND expect the plus icon not to be in the document
      expect(screen.queryByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_PLUS_ICON)).not.toBeInTheDocument();
      // AND expect the hidden file input not to be in the document
      expect(screen.queryByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_HIDDEN_FILE_INPUT)).not.toBeInTheDocument();
      // AND no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should hide plus button and context menu when CV upload flag is not set (empty string)", () => {
      // GIVEN CV upload flag is not set (returns empty string)
      mockGetCvUploadEnabled.mockReturnValue("");

      // WHEN ChatMessageField is rendered with a relevant phase
      render(
        <ChatMessageField
          aiIsTyping={false}
          isChatFinished={false}
          handleSend={jest.fn()}
          currentPhase={ConversationPhase.INTRO}
          onUploadCv={jest.fn()}
        />
      );

      // THEN expect the plus button not to be in the document
      expect(screen.queryByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_PLUS_BUTTON)).not.toBeInTheDocument();
      // AND expect the plus icon not to be in the document
      expect(screen.queryByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_PLUS_ICON)).not.toBeInTheDocument();
      // AND expect the hidden file input not to be in the document
      expect(screen.queryByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_HIDDEN_FILE_INPUT)).not.toBeInTheDocument();
      // AND no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should not show context menu when CV upload is disabled even if plus button is clicked", async () => {
      // GIVEN CV upload is disabled
      mockGetCvUploadEnabled.mockReturnValue("false");

      // WHEN ChatMessageField is rendered with a relevant phase
      render(
        <ChatMessageField
          aiIsTyping={false}
          isChatFinished={false}
          handleSend={jest.fn()}
          currentPhase={ConversationPhase.INTRO}
          onUploadCv={jest.fn()}
        />
      );

      // THEN expect the plus button not to be in the document
      expect(screen.queryByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_PLUS_BUTTON)).not.toBeInTheDocument();
      // AND expect the context menu not to be rendered
      expect(ContextMenu).not.toHaveBeenCalled();
      // AND no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should show context menu when CV upload is enabled and plus button is clicked", async () => {
      // GIVEN CV upload is enabled
      mockGetCvUploadEnabled.mockReturnValue("true");
      // AND a mock onUploadCv function
      const mockOnUploadCv = jest.fn();

      // WHEN ChatMessageField is rendered with a relevant phase
      render(
        <ChatMessageField
          aiIsTyping={false}
          isChatFinished={false}
          handleSend={jest.fn()}
          currentPhase={ConversationPhase.INTRO}
          onUploadCv={mockOnUploadCv}
        />
      );

      // AND the plus button is clicked
      const plusButton = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_PLUS_BUTTON);
      await userEvent.click(plusButton);

      // THEN expect the context menu to be rendered
      await waitFor(() => {
        expect(ContextMenu).toHaveBeenCalledWith(
          expect.objectContaining({
            anchorEl: plusButton,
            open: true,
          }),
          {}
        );
      });
      // AND no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should show correct context menu message for INTRO phase", async () => {
      // GIVEN CV upload is enabled and current phase is INTRO
      mockGetCvUploadEnabled.mockReturnValue("true");
      const currentPhase = ConversationPhase.INTRO;

      // WHEN ChatMessageField is rendered
      render(
        <ChatMessageField
          aiIsTyping={false}
          isChatFinished={false}
          handleSend={jest.fn()}
          currentPhase={currentPhase}
          onUploadCv={jest.fn()}
        />
      );

      // AND the plus button is clicked
      const plusButton = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_PLUS_BUTTON);
      await userEvent.click(plusButton);

      // THEN expect the context menu to be rendered with the correct description
      await waitFor(() => {
        expect(ContextMenu).toHaveBeenCalledWith(
          expect.objectContaining({
            anchorEl: plusButton,
            open: true,
            items: expect.arrayContaining([
              expect.objectContaining({
                description: "You can upload your CV as soon as we start exploring your experiences",
                disabled: true, // Should be disabled in INTRO phase
              }),
            ]),
          }),
          {}
        );
      });
      // AND no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should show correct context menu message for COLLECT_EXPERIENCES phase", async () => {
      // GIVEN CV upload is enabled and current phase is COLLECT_EXPERIENCES
      mockGetCvUploadEnabled.mockReturnValue("true");
      const currentPhase = ConversationPhase.COLLECT_EXPERIENCES;

      // WHEN ChatMessageField is rendered
      render(
        <ChatMessageField
          aiIsTyping={false}
          isChatFinished={false}
          handleSend={jest.fn()}
          currentPhase={currentPhase}
          onUploadCv={jest.fn()}
        />
      );

      // AND the plus button is clicked
      const plusButton = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_PLUS_BUTTON);
      await userEvent.click(plusButton);

      // THEN expect the context menu to be rendered with the correct description
      await waitFor(() => {
        expect(ContextMenu).toHaveBeenCalledWith(
          expect.objectContaining({
            anchorEl: plusButton,
            open: true,
            items: expect.arrayContaining([
              expect.objectContaining({
                description: "Attach your CV to the conversation",
                disabled: false, // Should be enabled in COLLECT_EXPERIENCES phase
              }),
            ]),
          }),
          {}
        );
      });
      // AND no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should show correct context menu message for phases after COLLECT_EXPERIENCES", async () => {
      // GIVEN CV upload is enabled and current phase is after COLLECT_EXPERIENCES
      mockGetCvUploadEnabled.mockReturnValue("true");
      const currentPhase = ConversationPhase.DIVE_IN;

      // WHEN ChatMessageField is rendered
      render(
        <ChatMessageField
          aiIsTyping={false}
          isChatFinished={false}
          handleSend={jest.fn()}
          currentPhase={currentPhase}
          onUploadCv={jest.fn()}
        />
      );

      // AND the plus button is clicked
      const plusButton = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_PLUS_BUTTON);
      await userEvent.click(plusButton);

      // THEN expect the context menu to be rendered with the correct description
      await waitFor(() => {
        expect(ContextMenu).toHaveBeenCalledWith(
          expect.objectContaining({
            anchorEl: plusButton,
            open: true,
            items: expect.arrayContaining([
              expect.objectContaining({
                description: "CV upload is only available during experience collection",
                disabled: true, // Should be disabled after COLLECT_EXPERIENCES phase
              }),
            ]),
          }),
          {}
        );
      });
      // AND no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should show max uploads reached when user has reached max CV upload", async () => {
      // GIVEN CV upload is enabled (default mocked in beforeEach) and COLLECT_EXPERIENCES phase
      const currentPhase = ConversationPhase.COLLECT_EXPERIENCES;
      // AND onUploadCv rejects with 403
      const forbiddenErr = new Error("max uploads reached");
      (forbiddenErr as any).statusCode = StatusCodes.FORBIDDEN;
      const mockOnUploadCv = jest.fn().mockRejectedValue(forbiddenErr);

      // WHEN ChatMessageField is rendered
      render(
        <ChatMessageField
          aiIsTyping={false}
          isChatFinished={false}
          handleSend={jest.fn()}
          currentPhase={currentPhase}
          onUploadCv={mockOnUploadCv}
        />
      );
      // AND the plus button is clicked
      const plusButton = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_PLUS_BUTTON);
      await userEvent.click(plusButton);

      // AND the user chooses an upload option and selects a valid file
      const uploadFileOption = screen.getByTestId(MENU_ITEM_ID.UPLOAD_CV);
      await userEvent.click(uploadFileOption);

      const fileInput = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_HIDDEN_FILE_INPUT);
      const file = new File(["dummy content"], "cv.pdf", { type: "application/pdf" });
      await userEvent.upload(fileInput, file);

      // THEN onUploadCv is called with the file
      expect(mockOnUploadCv).toHaveBeenCalledWith(file);
      // AND the specific max uploads reached error is shown
      await waitFor(() => {
        expect(screen.getByText(ERROR_MESSAGES.MAX_UPLOADS_REACHED)).toBeInTheDocument();
      });
      // AND no warnings to have occurred
      expect(console.warn).not.toHaveBeenCalled();
    });
  });
});
