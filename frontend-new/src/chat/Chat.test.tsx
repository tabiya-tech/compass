import "src/_test_utilities/consoleMock";
import Chat, { DATA_TEST_ID, START_PROMPT } from "./Chat";
import { fireEvent, render, screen, waitFor } from "src/_test_utilities/test-utils";
import { DATA_TEST_ID as CHAT_HEADER_TEST_ID } from "./ChatHeader/ChatHeader";
import ChatList, { DATA_TEST_ID as CHAT_LIST_TEST_ID } from "./ChatList/ChatList";
import { DATA_TEST_ID as CHAT_MESSAGE_FIELD_TEST_ID } from "./ChatMessageField/ChatMessageField";
import { HashRouter } from "react-router-dom";
import { ChatMessageOrigin } from "./Chat.types";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import ChatService from "./ChatService/ChatService";

const mockSendMessage = jest.fn().mockResolvedValue({
  conversation_context: {
    all_history: {
      turns: [
        {
          input: { message: "Hello" },
          output: { message_for_user: "Hello, I'm Compass" },
        },
      ],
    },
  },
  last: {
    message_for_user: "Hello, I'm Compass",
  },
});

const mockClearChat = jest.fn();

jest.mock("src/chat/ChatService/ChatService", () => {
  return jest.fn().mockImplementation(() => {
    return {
      sendMessage: mockSendMessage,
      clearChat: mockClearChat,
    };
  });
});

jest.mock("src/chat/ChatList/ChatList", () => {
  const originalModule = jest.requireActual("src/chat/ChatList/ChatList");
  return {
    __esModule: true,
    ...originalModule,
    default: jest.fn(() => <div data-testid={originalModule.DATA_TEST_ID.CHAT_LIST_CONTAINER}></div>),
  };
});

jest.mock("src/chat/ChatMessageField/ChatMessageField", () => {
  const originalModule = jest.requireActual("src/chat/ChatMessageField/ChatMessageField");
  return {
    __esModule: true,
    ...originalModule,
    default: jest.fn(({ handleSend, message, notifyChange }) => (
      <div data-testid={originalModule.DATA_TEST_ID.CHAT_MESSAGE_FIELD_CONTAINER}>
        <input
          data-testid={originalModule.DATA_TEST_ID.CHAT_MESSAGE_FIELD}
          value={message}
          onChange={(e) => notifyChange(e.target.value)}
        />
        <button data-testid={originalModule.DATA_TEST_ID.CHAT_MESSAGE_FIELD_BUTTON} onClick={handleSend}>
          Send
        </button>
      </div>
    )),
  };
});

// mock the snackbar provider
jest.mock("src/theme/SnackbarProvider/SnackbarProvider", () => {
  const actual = jest.requireActual("src/theme/SnackbarProvider/SnackbarProvider");
  return {
    ...actual,
    __esModule: true,
    useSnackbar: jest.fn().mockReturnValue({
      enqueueSnackbar: jest.fn(),
      closeSnackbar: jest.fn(),
    }),
  };
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("render tests", () => {
  test("should render the Chat Component", () => {
    // GIVEN a chat component

    // WHEN the chat header is rendered with a router
    render(
      <HashRouter>
        <Chat />
      </HashRouter>
    );

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    // AND the chat container to be visible
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_CONTAINER)).toBeInTheDocument();
    // AND the chat header to be in the document
    expect(screen.getByTestId(CHAT_HEADER_TEST_ID.CHAT_HEADER_CONTAINER)).toBeInTheDocument();
    // AND the chat list to be in the document
    expect(screen.getByTestId(CHAT_LIST_TEST_ID.CHAT_LIST_CONTAINER)).toBeInTheDocument();
    // AND the chat message field to be in the document
    expect(screen.getByTestId(CHAT_MESSAGE_FIELD_TEST_ID.CHAT_MESSAGE_FIELD_CONTAINER)).toBeInTheDocument();
    // AND the compoenent to match the snapshot
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_CONTAINER)).toMatchSnapshot();
  });
});

describe("test Chat Initialization", () => {
  test("should initialize chat on mount", async () => {
    // GIVEN a chat component
    // WHEN the chat is rendered with a router
    render(
      <HashRouter>
        <Chat />
      </HashRouter>
    );

    // THEN expect the initial message is added
    await waitFor(() => {
      expect(screen.getByTestId(CHAT_LIST_TEST_ID.CHAT_LIST_CONTAINER)).toBeInTheDocument();
    });

    expect(mockSendMessage).toHaveBeenCalledWith(START_PROMPT);

    // AND the ChatList component to be called with the history returned to the initialization
    await waitFor(() => {
      expect(ChatList).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            {
              id: expect.any(Number),
              origin: ChatMessageOrigin.ME,
              message: "Hello",
              timestamp: expect.any(Number),
            },
            {
              id: expect.any(Number),
              origin: ChatMessageOrigin.COMPASS,
              message: "Hello, I'm Compass",
              timestamp: expect.any(Number),
            },
          ],
        }),
        {}
      );
    });
  });

  test("should show an error message if initialization fails", async () => {
    // GIVEN a chat component
    mockSendMessage.mockRejectedValueOnce(new Error("Initialization failed"));

    // WHEN the chat is rendered with a router and snackbar provider
    render(
      <HashRouter>
        <Chat />
      </HashRouter>
    );

    // THEN expect an error message to be shown
    await waitFor(() => {
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith(
        "Something went wrong... Please try logging in again",
        { variant: "error" }
      );
    });
  });

  test("should show a console error if ChatService constructor fails", async () => {
    // GIVEN a failing ChatService constructor
    const givenError = new Error("Constructor failed");
    (ChatService as jest.Mock).mockImplementationOnce(() => {
      throw givenError;
    });

    // WHEN the chat is rendered with a router and snackbar provider
    render(
      <HashRouter>
        <Chat />
      </HashRouter>
    );

    // THEN expect a console error to be logged
    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith("Failed to create chat service:", givenError);
    });
  });
});

describe("test send message", () => {
  test("should send a message", async () => {
    // GIVEN a chat component
    // WHEN a user sends a message with a router
    render(
      <HashRouter>
        <Chat />
      </HashRouter>
    );

    const input = screen.getByTestId(CHAT_MESSAGE_FIELD_TEST_ID.CHAT_MESSAGE_FIELD);
    const sendButton = screen.getByTestId(CHAT_MESSAGE_FIELD_TEST_ID.CHAT_MESSAGE_FIELD_BUTTON);

    fireEvent.change(input, { target: { value: "Test message" } });
    fireEvent.click(sendButton);

    // THEN expect the message to be sent and the response to be received
    await waitFor(() => {
      expect(screen.getByTestId(CHAT_LIST_TEST_ID.CHAT_LIST_CONTAINER)).toBeInTheDocument();
    });

    expect(mockSendMessage).toHaveBeenCalledWith("Test message");

    // AND the ChatList component to be called with the new message
    await waitFor(() => {
      expect(ChatList).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            {
              id: expect.any(Number),
              origin: ChatMessageOrigin.ME,
              message: "Test message",
              timestamp: expect.any(Number),
            },
          ],
        }),
        {}
      );
    });
  });

  test("should show an error message if sending a message fails", async () => {
    // GIVEN a chat component
    // First, we need the initialization to succeed
    mockSendMessage.mockResolvedValueOnce({
      conversation_context: {
        all_history: {
          turns: [
            {
              input: { message: "Hello" },
              output: { message_for_user: "Hello, I'm Compass" },
            },
          ],
        },
      },
      last: {
        message_for_user: "Hello, I'm Compass",
      },
    });

    // WHEN a user sends a message with a router and snackbar provider
    render(
      <HashRouter>
        <Chat />
      </HashRouter>
    );

    // Ensure initialization is successful
    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith(START_PROMPT);
    });

    // Now mock sendMessage to fail for the user message
    mockSendMessage.mockRejectedValueOnce(new Error("Sending message failed"));

    const input = screen.getByTestId(CHAT_MESSAGE_FIELD_TEST_ID.CHAT_MESSAGE_FIELD);
    const sendButton = screen.getByTestId(CHAT_MESSAGE_FIELD_TEST_ID.CHAT_MESSAGE_FIELD_BUTTON);

    fireEvent.change(input, { target: { value: "Test message" } });
    fireEvent.click(sendButton);

    // THEN expect an error message to be shown in the chat
    await waitFor(() => {
      expect(ChatList).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            {
              id: expect.any(Number),
              origin: ChatMessageOrigin.ME,
              message: "Test message",
              timestamp: expect.any(Number),
            },
            {
              id: expect.any(Number),
              origin: ChatMessageOrigin.COMPASS,
              message: "I'm sorry, I'm having trouble connecting to the server. Please try again later.",
              timestamp: expect.any(Number),
            },
          ]),
        }),
        {}
      );
    });
  });
});
