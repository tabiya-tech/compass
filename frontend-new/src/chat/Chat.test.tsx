import "src/_test_utilities/consoleMock";
import Chat, { DATA_TEST_ID } from "./Chat";
import { fireEvent, render, screen, waitFor } from "src/_test_utilities/test-utils";
import { DATA_TEST_ID as CHAT_HEADER_TEST_ID, MENU_ITEM_ID } from "./ChatHeader/ChatHeader";
import ChatList, { DATA_TEST_ID as CHAT_LIST_TEST_ID } from "./ChatList/ChatList";
import ChatMessageField, { DATA_TEST_ID as CHAT_MESSAGE_FIELD_TEST_ID } from "./ChatMessageField/ChatMessageField";
import { DATA_TEST_ID as EXPERIENCES_DRAWER_HEADER_TEST_ID } from "src/Experiences/components/ExperiencesDrawerHeader/ExperiencesDrawerHeader";
import { DATA_TEST_ID as EXPERIENCES_DRAWER_CONTAINER_TEST_ID } from "src/Experiences/ExperiencesDrawer";
import { HashRouter } from "react-router-dom";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { ConversationMessageSender } from "./ChatService/ChatService.types";
import { Language } from "src/auth/services/UserPreferences/userPreferences.types";
import { UserPreferencesContext } from "src/auth/Providers/UserPreferencesProvider/UserPreferencesProvider";
import ChatService from "./ChatService/ChatService";
import ExperienceService from "src/Experiences/ExperienceService/ExperienceService";
import { MenuItemConfig } from "src/theme/ContextMenu/menuItemConfig.types";

// Mock the ChatService module
jest.mock("src/chat/ChatService/ChatService");

// mock the ExperienceService module
jest.mock("src/Experiences/ExperienceService/ExperienceService", () => {
  return {
    __esModule: true,
    default: {
      getInstance: jest.fn().mockReturnValue({
        getExperiences: jest.fn().mockResolvedValue([]),
      }),
    },
  };
});

jest.mock("src/chat/ChatList/ChatList", () => {
  const actualModule = jest.requireActual("src/chat/ChatList/ChatList");
  return {
    __esModule: true,
    ...actualModule,
    default: jest.fn(() => <div data-testid={actualModule.DATA_TEST_ID.CHAT_LIST_CONTAINER}></div>),
  };
});

jest.mock("src/chat/ChatMessageField/ChatMessageField", () => {
  const actualModule = jest.requireActual("src/chat/ChatMessageField/ChatMessageField");
  return {
    __esModule: true,
    ...actualModule,
    default: jest.fn(({ handleSend, message, notifyChange }) => (
      <div data-testid={actualModule.DATA_TEST_ID.CHAT_MESSAGE_FIELD_CONTAINER}>
        <input
          data-testid={actualModule.DATA_TEST_ID.CHAT_MESSAGE_FIELD}
          value={message}
          onChange={(e) => notifyChange(e.target.value)}
        />
        <button data-testid={actualModule.DATA_TEST_ID.CHAT_MESSAGE_FIELD_BUTTON} onClick={handleSend}>
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

// mock the ContextMenu
jest.mock("src/theme/ContextMenu/ContextMenu", () => {
  return {
    __esModule: true,
    default: jest.fn(({ items }: { items: MenuItemConfig[] }) => (
      <div data-testid="mock-context-menu">
        {items.map((item) => (
          <div key={item.id} data-testid={item.id} onClick={item.action}>
            {item.text}
          </div>
        ))}
        ;
      </div>
    )),
  };
});

describe("Chat", () => {
  const getUserPreferencesMock = jest.fn();
  const givenSessionId = 123;

  const userPreferencesContextValue = {
    getUserPreferences: getUserPreferencesMock,
    createUserPreferences: jest.fn(),
    userPreferences: {
      accepted_tc: new Date(),
      user_id: "0001",
      language: Language.en,
      sessions: [givenSessionId],
    },
    updateUserPreferences: jest.fn(),
    isLoading: false,
  };

  const mockSendMessage = jest.fn();
  const mockGetChatHistory = jest.fn();

  beforeEach(() => {
    // Mock the static getInstance method to return an instance with mocked methods
    (ChatService as jest.Mocked<typeof ChatService>).getInstance = jest.fn().mockReturnValue({
      sendMessage: mockSendMessage,
      getChatHistory: mockGetChatHistory,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("render tests", () => {
    test("should render the Chat Component", () => {
      // GIVEN a chat component
      // WHEN the chat header is rendered with a router
      render(
        <HashRouter>
          <UserPreferencesContext.Provider value={userPreferencesContextValue}>
            <Chat />
          </UserPreferencesContext.Provider>
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
      // AND the component to match the snapshot
      expect(screen.getByTestId(DATA_TEST_ID.CHAT_CONTAINER)).toMatchSnapshot();

      // AND the ChatMessageField component to be called with the initial props
      expect(ChatMessageField).toHaveBeenCalledWith(
        {
          message: expect.any(String),
          notifyChange: expect.any(Function),
          handleSend: expect.any(Function),
          aiIsTyping: expect.any(Boolean),
          isChatFinished: expect.any(Boolean),
        },
        {}
      );
    });
  });

  describe("test Chat Initialization", () => {
    test("should initialize chat on mount", async () => {
      mockGetChatHistory.mockResolvedValueOnce({
        messages: [
          {
            message: "",
            sent_at: new Date().toISOString(),
            sender: ConversationMessageSender.USER,
          },
          {
            message: "Hello, I'm Compass",
            sent_at: new Date().toISOString(),
            sender: ConversationMessageSender.COMPASS,
          },
          {
            message: "Hi, Compass, I'm foo",
            sent_at: new Date().toISOString(),
            sender: ConversationMessageSender.USER,
          },
          {
            message: "Hello foo, would you like to begin your skill exploration session?",
            sent_at: new Date().toISOString(),
            sender: ConversationMessageSender.COMPASS,
          },
        ],
        conversation_completed: false,
      });
      // GIVEN a chat component
      // WHEN the chat is rendered with a router
      render(
        <HashRouter>
          <UserPreferencesContext.Provider value={userPreferencesContextValue}>
            <Chat />
          </UserPreferencesContext.Provider>
        </HashRouter>
      );

      // THEN expect the initial message is added
      await waitFor(() => {
        expect(screen.getByTestId(CHAT_LIST_TEST_ID.CHAT_LIST_CONTAINER)).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(mockGetChatHistory).toHaveBeenCalled();
      });

      // AND the ChatList component to be called with the history returned to the initialization
      await waitFor(() => {
        expect(ChatList).toHaveBeenNthCalledWith(
          3,
          expect.objectContaining({
            messages: [
              {
                id: expect.any(Number),
                sender: ConversationMessageSender.COMPASS,
                message: "",
                sent_at: expect.any(String),
              },
              {
                id: expect.any(Number),
                sender: ConversationMessageSender.COMPASS,
                message: "Hello, I'm Compass",
                sent_at: expect.any(String),
              },
              {
                id: expect.any(Number),
                sender: ConversationMessageSender.USER,
                message: "Hi, Compass, I'm foo",
                sent_at: expect.any(String),
              },
              {
                id: expect.any(Number),
                sender: ConversationMessageSender.COMPASS,
                message: "Hello foo, would you like to begin your skill exploration session?",
                sent_at: expect.any(String),
              },
            ],
            isTyping: false,
          }),
          {}
        );
      });
    });

    test("should show an error message if initialization fails", async () => {
      // GIVEN a chat component
      mockGetChatHistory.mockRejectedValueOnce(new Error("Failed to initialize chat"));

      // WHEN the chat is rendered with a router and snackbar provider
      render(
        <HashRouter>
          <UserPreferencesContext.Provider value={userPreferencesContextValue}>
            <Chat />
          </UserPreferencesContext.Provider>
        </HashRouter>
      );

      // THEN expect an error message to be shown
      await waitFor(() => {
        expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith(
          "An unexpected error occurred. Please try again later.",
          { variant: "error" }
        );
      });
    });
  });

  describe("test send message", () => {
    test("should send a message", async () => {
      // GIVEN a chat component
      // First, we need the initialization to succeed
      mockSendMessage.mockResolvedValueOnce({
        messages: [
          {
            message: "Hello, I'm Compass",
            sent_at: new Date().toISOString(),
          },
        ],
        conversation_completed: false,
      });

      // GIVEN a chat component
      // WHEN a user sends a message with a router
      render(
        <HashRouter>
          <UserPreferencesContext.Provider value={userPreferencesContextValue}>
            <Chat />
          </UserPreferencesContext.Provider>
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
                sender: ConversationMessageSender.USER,
                message: "Test message",
                sent_at: expect.any(String),
              },
              {
                id: expect.any(Number),
                sender: ConversationMessageSender.COMPASS,
                message: "Hello, I'm Compass",
                sent_at: expect.any(String),
              },
            ],
          }),
          {}
        );
      });
    });

    test("should show an error message if sending a message fails", async () => {
      // WHEN a user sends a message with a router and snackbar provider
      render(
        <HashRouter>
          <UserPreferencesContext.Provider value={userPreferencesContextValue}>
            <Chat />
          </UserPreferencesContext.Provider>
        </HashRouter>
      );

      // Ensure initialization is successful
      await waitFor(() => {
        expect(mockGetChatHistory).toHaveBeenCalled();
      });

      // Now mock sendMessage to fail for the user message
      mockSendMessage.mockRejectedValueOnce(new Error("Sending message failed"));

      const input = screen.getByTestId(CHAT_MESSAGE_FIELD_TEST_ID.CHAT_MESSAGE_FIELD);
      const sendButton = screen.getByTestId(CHAT_MESSAGE_FIELD_TEST_ID.CHAT_MESSAGE_FIELD_BUTTON);

      fireEvent.change(input, { target: { value: "Test message" } });
      fireEvent.click(sendButton);

      // THEN expect an error message to be shown in the chat
      await waitFor(() => {
        expect(ChatList).toHaveBeenNthCalledWith(
          6,
          expect.objectContaining({
            messages: expect.arrayContaining([
              {
                id: expect.any(Number),
                sender: ConversationMessageSender.USER,
                message: "Test message",
                sent_at: expect.any(String),
              },
              {
                id: expect.any(Number),
                sender: ConversationMessageSender.COMPASS,
                message: "I'm sorry, Something seems to have gone wrong on my end... Can you try again?",
                sent_at: expect.any(String),
              },
            ]),
          }),
          {}
        );
      });
    });
  });

  describe("test user experience drawer", () => {
    const chatComponent = (
      <HashRouter>
        <UserPreferencesContext.Provider value={userPreferencesContextValue}>
          <Chat />
        </UserPreferencesContext.Provider>
      </HashRouter>
    );

    test("should open the drawer and fetch experiences when the button is clicked", async () => {
      // GIVEN the chat component is rendered
      render(chatComponent);
      // AND the user button is clicked
      const userButton = screen.getByTestId(CHAT_HEADER_TEST_ID.CHAT_HEADER_BUTTON_USER);
      fireEvent.click(userButton);
      // AND the experiences button is clicked
      const experiencesMenuItem = screen.getByTestId(MENU_ITEM_ID.EXPERIENCES_BUTTON);
      fireEvent.click(experiencesMenuItem);
      // AND the drawer is open
      expect(screen.getByTestId(EXPERIENCES_DRAWER_CONTAINER_TEST_ID.EXPERIENCES_DRAWER_CONTAINER)).toBeInTheDocument();

      // THEN expect the experiences to be fetched
      expect(ExperienceService.getInstance(1234).getExperiences).toHaveBeenCalled();
    });

    test("should shows an error notification if fetching experiences fails", async () => {
      // Mock the getExperiences function to throw an error
      const mockedGetExperiences = jest.fn().mockRejectedValue(new Error("Network error"));
      (ExperienceService.getInstance(1234).getExperiences as jest.Mock).mockImplementation(mockedGetExperiences);

      // GIVEN the chat component is rendered
      render(chatComponent);
      // AND the user button is clicked
      const userButton = screen.getByTestId(CHAT_HEADER_TEST_ID.CHAT_HEADER_BUTTON_USER);
      fireEvent.click(userButton);
      // AND the experiences button is clicked
      const experiencesMenuItem = screen.getByTestId(MENU_ITEM_ID.EXPERIENCES_BUTTON);
      fireEvent.click(experiencesMenuItem);
      // AND the drawer is open
      expect(screen.getByTestId(EXPERIENCES_DRAWER_CONTAINER_TEST_ID.EXPERIENCES_DRAWER_CONTAINER)).toBeInTheDocument();

      // WHEN the experiences fetching fails
      // THEN expect an error notification to be shown
      await waitFor(() => {
        expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith("Failed to retrieve experiences", {
          variant: "error",
        });
      });
    });

    test("should close the drawer when the close button is clicked", async () => {
      // GIVEN the chat component is rendered
      render(chatComponent);
      // AND the user button is clicked
      const userButton = screen.getByTestId(CHAT_HEADER_TEST_ID.CHAT_HEADER_BUTTON_USER);
      fireEvent.click(userButton);
      // AND the experiences button is clicked
      const experiencesMenuItem = screen.getByTestId(MENU_ITEM_ID.EXPERIENCES_BUTTON);
      fireEvent.click(experiencesMenuItem);

      // WHEN the close button is clicked
      const closeButton = screen.getByTestId(EXPERIENCES_DRAWER_HEADER_TEST_ID.EXPERIENCES_DRAWER_HEADER_BUTTON);
      fireEvent.click(closeButton);

      // THEN expect the drawer to be closed
      await waitFor(() => {
        expect(
          screen.queryByTestId(EXPERIENCES_DRAWER_CONTAINER_TEST_ID.EXPERIENCES_DRAWER_CONTAINER)
        ).not.toBeInTheDocument();
      });
    });
  });
});
