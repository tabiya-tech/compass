// mute the console
import "src/_test_utilities/consoleMock";

import ChatMessageField, { DATA_TEST_ID, CHAT_MESSAGE_MAX_LENGTH } from "./ChatMessageField";
import { render, screen, fireEvent } from "src/_test_utilities/test-utils";
import { waitForElementToBeRemoved } from "@testing-library/react";

// mock the emoji picker
jest.mock("@emoji-mart/react", () => {
  return {
    __esModule: true,
    default: (props: any) => {
      return <div data-testid={props["data-testid"]} onClick={() => props.onEmojiSelect({ native: "😊" })} />;
    },
  };
});

describe("ChatMessageField", () => {
  test("should render ChatMessageField correctly", () => {
    // WHEN ChatMessageField is rendered
    render(<ChatMessageField handleSend={jest.fn()} message="foo" notifyChange={jest.fn()} />);

    //THEN expect no errors or warnings has occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    // AND the ChatMessageField container to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_CONTAINER)).toBeInTheDocument();
    // AND the ChatMessageField send button to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_SEND_BUTTON)).toBeInTheDocument();
    // AND the ChatMessageField send icon to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_SEND_ICON)).toBeInTheDocument();
    // AND the ChatMessageField emoji button to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_EMOJI_BUTTON)).toBeInTheDocument();
    // AND the ChatMessageField emoji icon to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_EMOJI_ICON)).toBeInTheDocument();
    // AND to match the snapshot
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_CONTAINER)).toMatchSnapshot();
  });

  test("should render ChatMessageField correctly with error message when message is too long", () => {
    // GIVEN a long message
    const message = "a".repeat(CHAT_MESSAGE_MAX_LENGTH + 2);
    // AND handleChange function
    const handleChange = jest.fn();

    // WHEN ChatMessageField is rendered
    render(<ChatMessageField handleSend={jest.fn()} message="" notifyChange={handleChange} />);
    // AND the input is changed
    const ChatMessageFieldInput = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_CONTAINER);
    fireEvent.change(ChatMessageFieldInput, { target: { value: message } });

    // THEN expect notifyChange to be called
    expect(handleChange).toHaveBeenCalled();
    // AND the error message to be in the document
    expect(screen.getByText("Message limit is 1000 characters.")).toBeInTheDocument();
    // AND the icon button to be disabled
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_SEND_BUTTON)).toBeDisabled();
  });

  test("should render ChatMessageField correctly with error message when message contains invalid characters", () => {
    // WHEN a message that contains invalid characters
    const invalidMessage = "foobar{}&*";
    // AND handleChange function
    const handleChange = jest.fn();

    // WHEN ChatMessageField is rendered
    render(<ChatMessageField handleSend={jest.fn()} message="" notifyChange={handleChange} />);
    // AND the input is changed
    const ChatMessageFieldInput = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_CONTAINER);
    fireEvent.change(ChatMessageFieldInput, { target: { value: invalidMessage } });

    // THEN expect notifyChange to be called
    expect(handleChange).toHaveBeenCalled();
    // AND the error message to be in the document
    expect(screen.getByText("Invalid special characters.")).toBeInTheDocument();
    // AND the icon button to be disabled
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_SEND_BUTTON)).toBeDisabled();
  });

  test("should render ChatMessageField correctly with no error message when message is valid", () => {
    // GIVEN a valid message
    const validMessage = "foo bar";
    // AND handleChange function
    const handleChange = jest.fn();

    // WHEN ChatMessageField is rendered
    render(<ChatMessageField handleSend={jest.fn()} message="" notifyChange={handleChange} />);
    // AND the input is changed
    const ChatMessageFieldInput = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_CONTAINER);
    fireEvent.change(ChatMessageFieldInput, { target: { value: validMessage } });

    // THEN expect notifyChange to be called
    expect(handleChange).toHaveBeenCalled();
    // AND no error message to be in the document
    expect(screen.queryByText("Message limit is 1000 characters.")).toBeNull();
    expect(screen.queryByText("Invalid special characters.")).toBeNull();
  });

  describe("character counter", () => {
    test("should render Character counter when the message is longer than 75% of the max allowed length", () => {
      // GIVEN a long message (76%)
      const message = "a".repeat(CHAT_MESSAGE_MAX_LENGTH * 0.76);

      // AND handleChange function
      const handleChange = jest.fn();

      // WHEN ChatMessageField is rendered
      render(<ChatMessageField handleSend={jest.fn()} message="" notifyChange={handleChange} />);

      // AND the input is changed
      const ChatMessageFieldInput = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_CONTAINER);

      fireEvent.change(ChatMessageFieldInput, { target: { value: message } });

      // THEN expect the character counter to be in the document
      expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_CHAR_COUNTER)).toBeInTheDocument();
      // AND the character counter to be correct
      expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_CHAR_COUNTER)).toHaveTextContent(
        `${message.length}/${CHAT_MESSAGE_MAX_LENGTH}`
      );
    });

    test("should not render the character counter when the message is shorter than or equal to 75% of the max allowed length", () => {
      // GIVEN a short message (75%)
      const message = "a".repeat(CHAT_MESSAGE_MAX_LENGTH * 0.75);

      // AND handleChange function
      const handleChange = jest.fn();

      // WHEN ChatMessageField is rendered
      render(<ChatMessageField handleSend={jest.fn()} message="" notifyChange={handleChange} />);

      // AND the input is changed
      const ChatMessageFieldInput = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_CONTAINER);

      fireEvent.change(ChatMessageFieldInput, { target: { value: message } });

      // THEN expect the character counter not to be in the document
      expect(screen.queryByTestId(DATA_TEST_ID.CHAT_MESSAGE_CHAR_COUNTER)).not.toBeInTheDocument();
    });
  });

  describe("Emoji picker", () => {
    test("should render Emoji picker when the emoji button is clicked", async () => {
      // GIVEN the component is rendered
      render(<ChatMessageField handleSend={jest.fn()} message="" notifyChange={jest.fn()} />);

      // WHEN the emoji button is clicked
      const emojiButton = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_EMOJI_BUTTON);
      fireEvent.click(emojiButton);

      // THEN expect the popover to be in the document
      expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_POPOVER)).toBeInTheDocument();
      // AND expect the emoji picker to be in the document
      expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_EMOJI_PICKER)).toBeInTheDocument();
    });

    test("should close the Emoji picker when the Popover onClose is triggered", async () => {
      // GIVEN the component is rendered
      render(<ChatMessageField handleSend={jest.fn()} message="" notifyChange={jest.fn()} />);
      // AND the emoji button is clicked
      const emojiButton = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_EMOJI_BUTTON);
      fireEvent.click(emojiButton);
      // AND the emoji picker is in the document
      expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_EMOJI_PICKER)).toBeInTheDocument();

      // WHEN the popover onClose is triggered
      const popover = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_POPOVER);
      fireEvent.keyDown(popover, { key: "Escape", code: "Escape" });

      // THEN expect the emoji picker to be removed from the document
      await waitForElementToBeRemoved(() => screen.queryByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_EMOJI_PICKER));
      expect(screen.queryByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_EMOJI_PICKER)).not.toBeInTheDocument();
    });

    test("should call notifyChange with the message and selected emoji", () => {
      // GIVEN notifyChange function
      const mockNotifyChange = jest.fn();
      // AND a message
      const message = "Hello";
      // AND ChatMessageField is rendered
      render(<ChatMessageField handleSend={jest.fn()} message={message} notifyChange={mockNotifyChange} />);

      // WHEN the emoji button is clicked
      const emojiButton = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_EMOJI_BUTTON);
      fireEvent.click(emojiButton);
      // THEN expect emoji picker is in the document
      expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_EMOJI_PICKER)).toBeInTheDocument();

      // WHEN the emoji is selected
      const emojiPicker = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_EMOJI_PICKER);
      fireEvent.click(emojiPicker);
      // THEN expect notifyChange to be called with the message and the selected emoji
      expect(mockNotifyChange).toHaveBeenCalledWith(message + "😊");
    });
  });

  describe("ChatMessageField action tests", () => {
    test("should call handleSend when button is clicked", () => {
      // GIVEN handleSend function
      const handleSend = jest.fn();

      // WHEN ChatMessageField is rendered
      render(<ChatMessageField handleSend={handleSend} message="foo" notifyChange={jest.fn()} />);
      // AND the button is clicked
      const ChatMessageFieldButton = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_SEND_BUTTON);
      fireEvent.click(ChatMessageFieldButton);

      // THEN expect handleSend to be called
      expect(handleSend).toHaveBeenCalled();
    });

    test("should call handleSend when enter key is pressed", () => {
      // GIVEN handleSend function
      const handleSend = jest.fn();

      // WHEN ChatMessageField is rendered
      render(<ChatMessageField handleSend={handleSend} message="foo" notifyChange={jest.fn()} />);
      // AND the enter key is pressed
      const ChatMessageFieldInput = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_CONTAINER);
      fireEvent.keyDown(ChatMessageFieldInput, { key: "Enter", code: "Enter" });

      // THEN expect handleSend to be called
      expect(handleSend).toHaveBeenCalled();
    });

    test("should call notifyChange when input is changed", () => {
      // GIVEN notifyChange function
      const notifyChange = jest.fn();

      // WHEN ChatMessageField is rendered
      render(<ChatMessageField handleSend={jest.fn()} message="foo" notifyChange={notifyChange} />);
      // AND the input is changed
      const ChatMessageFieldInput = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_CONTAINER);
      fireEvent.change(ChatMessageFieldInput, { target: { value: "bar" } });

      // THEN expect notifyChange to be called
      expect(notifyChange).toHaveBeenCalled();
    });
  });
});
