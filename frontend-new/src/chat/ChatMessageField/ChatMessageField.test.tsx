// mute the console
import "src/_test_utilities/consoleMock";

import ChatMessageField, { DATA_TEST_ID, CHAT_MESSAGE_MAX_LENGTH, DISALLOWED_CHARACTERS } from "./ChatMessageField";
import { render, screen, fireEvent } from "src/_test_utilities/test-utils";
import { mockBrowserIsOnLine } from "src/_test_utilities/mockBrowserIsOnline";

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

describe("ChatMessageField", () => {
  test("should render ChatMessageField correctly", () => {
    // WHEN ChatMessageField is rendered
    render(
      <ChatMessageField
        aiIsTyping={false}
        isChatFinished={false}
        handleSend={jest.fn()}
        message="foo"
        notifyChange={jest.fn()}
      />
    );

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

  test("should render ChatMessageField correctly with error message when message is too long", () => {
    // GIVEN a long message
    const message = "a".repeat(CHAT_MESSAGE_MAX_LENGTH + 2);
    // AND handleChange function
    const handleChange = jest.fn();

    // WHEN ChatMessageField is rendered
    render(
      <ChatMessageField
        aiIsTyping={false}
        isChatFinished={false}
        handleSend={jest.fn()}
        message=""
        notifyChange={handleChange}
      />
    );
    // AND the input is changed
    const ChatMessageFieldInput = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD);
    fireEvent.change(ChatMessageFieldInput, { target: { value: message } });

    // THEN expect notifyChange to be called
    expect(handleChange).toHaveBeenCalled();
    // AND the error message to be in the document
    expect(screen.getByText("Message limit is 1000 characters.")).toBeInTheDocument();
  });

  test("should render ChatMessageField correctly with error message when message contains invalid characters", () => {
    // WHEN a message that contains invalid characters
    const invalidMessage = "foobar{}&*";
    const invalidChar = invalidMessage.split("").filter((char) => DISALLOWED_CHARACTERS.test(char));
    // AND handleChange function
    const handleChange = jest.fn();

    // WHEN ChatMessageField is rendered
    render(
      <ChatMessageField
        aiIsTyping={false}
        isChatFinished={false}
        handleSend={jest.fn()}
        message=""
        notifyChange={handleChange}
      />
    );
    // AND the input is changed
    const ChatMessageFieldInput = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD);
    fireEvent.change(ChatMessageFieldInput, { target: { value: invalidMessage } });

    // THEN expect notifyChange to be called
    expect(handleChange).toHaveBeenCalled();
    // AND the error message to be in the document
    expect(screen.getByText(`Invalid special characters: ${invalidChar}`)).toBeInTheDocument();
  });

  test("should render ChatMessageField correctly with no error message when message is valid", () => {
    // GIVEN a valid message
    const validMessage = "foo bar";
    // AND handleChange function
    const handleChange = jest.fn();

    // WHEN ChatMessageField is rendered
    render(
      <ChatMessageField
        aiIsTyping={false}
        isChatFinished={false}
        handleSend={jest.fn()}
        message=""
        notifyChange={handleChange}
      />
    );
    // AND the input is changed
    const ChatMessageFieldInput = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD);
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
      render(
        <ChatMessageField
          aiIsTyping={false}
          isChatFinished={false}
          handleSend={jest.fn()}
          message=""
          notifyChange={handleChange}
        />
      );

      // AND the input is changed
      const ChatMessageFieldInput = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD);

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
      render(
        <ChatMessageField
          aiIsTyping={false}
          isChatFinished={false}
          handleSend={jest.fn()}
          message=""
          notifyChange={handleChange}
        />
      );

      // AND the input is changed
      const ChatMessageFieldInput = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD);

      fireEvent.change(ChatMessageFieldInput, { target: { value: message } });

      // THEN expect the character counter not to be in the document
      expect(screen.queryByTestId(DATA_TEST_ID.CHAT_MESSAGE_CHAR_COUNTER)).not.toBeInTheDocument();
    });
  });

  describe("ChatMessageField action tests", () => {
    test("should call handleSend when button is clicked", () => {
      // GIVEN handleSend function
      const handleSend = jest.fn();

      // WHEN ChatMessageField is rendered
      render(
        <ChatMessageField
          aiIsTyping={false}
          isChatFinished={false}
          handleSend={handleSend}
          message="foo"
          notifyChange={jest.fn()}
        />
      );
      // AND the button is clicked
      const ChatMessageFieldButton = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_BUTTON);
      fireEvent.change(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD), { target: { value: "foo" } });
      fireEvent.click(ChatMessageFieldButton);

      // THEN expect handleSend to be called
      expect(handleSend).toHaveBeenCalled();
    });

    test("should call notifyChange when input is changed", () => {
      // GIVEN notifyChange function
      const notifyChange = jest.fn();

      // WHEN ChatMessageField is rendered
      render(
        <ChatMessageField
          aiIsTyping={false}
          isChatFinished={false}
          handleSend={jest.fn()}
          message="foo"
          notifyChange={notifyChange}
        />
      );
      // AND the input is changed
      const ChatMessageFieldInput = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD);
      fireEvent.change(ChatMessageFieldInput, { target: { value: "bar" } });

      // THEN expect notifyChange to be called
      expect(notifyChange).toHaveBeenCalled();
    });

    test("should disable sending a message when the message is empty", () => {
      // GIVEN handleSend function
      const handleSend = jest.fn();
      // WHEN ChatMessageField is rendered
      render(
        <ChatMessageField
          aiIsTyping={false}
          isChatFinished={false}
          handleSend={handleSend}
          message=""
          notifyChange={jest.fn()}
        />
      );
      // AND the button is clicked
      const ChatMessageFieldButton = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_BUTTON);
      fireEvent.click(ChatMessageFieldButton);

      // THEN expect handleSend not to be called
      expect(handleSend).not.toHaveBeenCalled();
    });

    it("should disable send button when AI is typing", () => {
      // GIVEN handleSend function
      const handleSend = jest.fn();
      // WHEN ChatMessageField is rendered
      render(
        <ChatMessageField
          aiIsTyping={true}
          isChatFinished={false}
          handleSend={handleSend}
          message="foo"
          notifyChange={jest.fn()}
        />
      );
      // AND the button is clicked
      const ChatMessageFieldButton = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_BUTTON);

      // THEN expect ChatMessageFieldButton to be disabled
      expect(ChatMessageFieldButton).toBeDisabled();
    });

    it("should not call handleSend when AI is typing", () => {
      // GIVEN handleSend function
      const handleSend = jest.fn();
      // WHEN ChatMessageField is rendered with some message
      render(
        <ChatMessageField
          aiIsTyping={true}
          isChatFinished={false}
          handleSend={handleSend}
          message="foo"
          notifyChange={jest.fn()}
        />
      );

      // AND the button is clicked
      const ChatMessageFieldButton = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_BUTTON);
      fireEvent.click(ChatMessageFieldButton);

      // THEN expect handleSend not to be called
      expect(handleSend).not.toHaveBeenCalled();
    });

    it("should be disabled when chat is finished", () => {
      // GIVEN handleSend function
      const handleSend = jest.fn();
      // WHEN ChatMessageField is rendered
      render(
        <ChatMessageField
          aiIsTyping={false}
          isChatFinished={true}
          handleSend={handleSend}
          message="foo"
          notifyChange={jest.fn()}
        />
      );
      // AND the button is clicked
      const ChatMessageFieldButton = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_BUTTON);

      // THEN expect ChatMessageFieldButton to be disabled
      expect(ChatMessageFieldButton).toBeDisabled();
    });

    test("should be disabled when browser is offline", () => {
      // GIVEN the browser is offline
      mockBrowserIsOnLine(false);
      // AND handleSend function
      const handleSend = jest.fn();
      // WHEN ChatMessageField is rendered
      render(
        <ChatMessageField
          aiIsTyping={false}
          isChatFinished={false}
          handleSend={handleSend}
          message="foo"
          notifyChange={jest.fn()}
        />
      );
      // AND the button is clicked
      const ChatMessageFieldButton = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_BUTTON);

      // THEN expect ChatMessageFieldButton to be disabled
      expect(ChatMessageFieldButton).toBeDisabled();

      // AND the button is clicked
      fireEvent.click(ChatMessageFieldButton);

      // THEN expect handleSend not to be called
      expect(handleSend).not.toHaveBeenCalled();
    });

    it("should focus on the input once ai is done typing", async () => {
      // GIVEN handleSend function
      const handleSend = jest.fn();

      // WHEN ChatMessageField is rendered
      render(
        <ChatMessageField
          aiIsTyping={false}
          isChatFinished={false}
          handleSend={handleSend}
          message="foo"
          notifyChange={jest.fn()}
        />
      );

      const messageField = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD);

      // THEN expect input should be focused
      expect(messageField).toHaveFocus();
    });
  });
});
