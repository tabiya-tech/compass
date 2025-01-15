// silence chatty console\
import "src/_test_utilities/consoleMock";
import { act } from "react";
import { render, screen, waitFor } from "src/_test_utilities/test-utils";
import Chat, { CHECK_INACTIVITY_INTERVAL, DATA_TEST_ID, INACTIVITY_TIMEOUT } from "src/chat/Chat";
import ChatHeader, { DATA_TEST_ID as CHAT_HEADER_TEST_ID } from "src/chat/ChatHeader/ChatHeader";
import ChatList, { DATA_TEST_ID as CHAT_LIST_TEST_ID } from "src/chat/chatList/ChatList";
import ChatMessageField, {
  DATA_TEST_ID as CHAT_MESSAGE_FIELD_TEST_ID,
} from "src/chat/ChatMessageField/ChatMessageField";
import ChatService from "./ChatService/ChatService";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { ConversationMessageSender, ConversationResponse } from "./ChatService/ChatService.types";
import AuthenticationStateService from "src/auth/services/AuthenticationState.service";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { ChatError } from "src/error/commonErrors";
import UserPreferencesService from "src/userPreferences/UserPreferencesService/userPreferences.service";
import ExperienceService from "src/experiences/experienceService/experienceService";
import ExperiencesDrawer, {
  DATA_TEST_ID as EXPERIENCE_DRAWER_TEST_ID,
} from "src/experiences/experiencesDrawer/ExperiencesDrawer";
import { WorkType } from "src/experiences/experienceService/experiences.types";
import { UserPreference } from "src/userPreferences/UserPreferencesService/userPreferences.types";
import ConfirmModalDialog, {
  DATA_TEST_ID as CONFIRM_MODAL_DIALOG_DATA_TEST_ID,
} from "src/theme/confirmModalDialog/ConfirmModalDialog";
import FeedbackForm, {
  DATA_TEST_ID as FEEDBACK_FORM_DATA_TEST_ID,
} from "src/feedback/overallFeedback/feedbackForm/FeedbackForm";
import { DATA_TEST_ID as INACTIVE_BACKDROP_DATA_TEST_ID } from "src/theme/Backdrop/InactiveBackdrop";
import userEvent from "@testing-library/user-event";
import { ChatMessageType } from "./Chat.types";
import { nanoid } from "nanoid";

// Mock Services ----------
// Mock the ChatService
jest.mock("src/chat/ChatService/ChatService");

// mock the authentication state service
jest.mock("src/auth/services/AuthenticationState.service");

// mock the user preferences state service
jest.mock("src/userPreferences/UserPreferencesStateService");

// mock the user preferences service
jest.mock("src/userPreferences/UserPreferencesService/userPreferences.service");

// mock the experience service
jest.mock("src/experiences/experienceService/experienceService");

// Mock Components ----------
// mock the snackbar
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

// mock the ChatHeader component
jest.mock("src/chat/ChatHeader/ChatHeader", () => {
  const actual = jest.requireActual("src/chat/ChatHeader/ChatHeader");
  const mockChatHeader = jest
    .fn()
    .mockImplementation(() => <div data-testid={actual.DATA_TEST_ID.CHAT_HEADER_CONTAINER}></div>);
  return {
    __esModule: true,
    default: mockChatHeader,
    DATA_TEST_ID: actual.DATA_TEST_ID,
  };
});

// mock the ChatList component
jest.mock("src/chat/chatList/ChatList", () => {
  const actual = jest.requireActual("src/chat/chatList/ChatList");
  const mockChatList = jest
    .fn()
    .mockImplementation(() => <div data-testid={actual.DATA_TEST_ID.CHAT_LIST_CONTAINER}></div>);
  return {
    __esModule: true,
    default: mockChatList,
    DATA_TEST_ID: actual.DATA_TEST_ID,
  };
});

// mock the ChatMessageField component
jest.mock("src/chat/ChatMessageField/ChatMessageField", () => {
  const actual = jest.requireActual("src/chat/ChatMessageField/ChatMessageField");
  const mockChatMessageField = jest
    .fn()
    .mockImplementation(() => <div data-testid={actual.DATA_TEST_ID.CHAT_MESSAGE_FIELD_CONTAINER}></div>);
  return {
    __esModule: true,
    default: mockChatMessageField,
    DATA_TEST_ID: actual.DATA_TEST_ID,
  };
});

// mock the ChatHeader component
jest.mock("src/chat/ChatHeader/ChatHeader", () => {
  const actual = jest.requireActual("src/chat/ChatHeader/ChatHeader");
  const mockChatHeader = jest
    .fn()
    .mockImplementation(() => <div data-testid={actual.DATA_TEST_ID.CHAT_HEADER_CONTAINER}></div>);
  return {
    __esModule: true,
    default: mockChatHeader,
    DATA_TEST_ID: actual.DATA_TEST_ID,
  };
});

// mock the Experience Drawer
jest.mock("src/experiences/experiencesDrawer/ExperiencesDrawer", () => {
  const actual = jest.requireActual("src/experiences/experiencesDrawer/ExperiencesDrawer");
  const mockExperienceDrawer = jest
    .fn()
    .mockImplementation(() => <div data-testid={actual.DATA_TEST_ID.EXPERIENCES_DRAWER_CONTAINER}></div>);
  return {
    __esModule: true,
    default: mockExperienceDrawer,
    DATA_TEST_ID: actual.DATA_TEST_ID,
  };
});

// mock the Feedback Form
jest.mock("src/feedback/overallFeedback/feedbackForm/FeedbackForm", () => {
  const actual = jest.requireActual("src/feedback/overallFeedback/feedbackForm/FeedbackForm");
  const mockOverallFeedbackForm = jest
    .fn()
    .mockImplementation(() => <div data-testid={actual.DATA_TEST_ID.FEEDBACK_FORM_DIALOG}></div>);
  return {
    __esModule: true,
    default: mockOverallFeedbackForm,
    DATA_TEST_ID: actual.DATA_TEST_ID,
  };
});

// mock the Confirm Modal Dialog
jest.mock("src/theme/confirmModalDialog/ConfirmModalDialog", () => {
  const actual = jest.requireActual("src/theme/confirmModalDialog/ConfirmModalDialog");
  const mockConfirmModalDialog = jest
    .fn()
    .mockImplementation(() => <div data-testid={actual.DATA_TEST_ID.CONFIRM_MODAL}></div>);
  return {
    __esModule: true,
    default: mockConfirmModalDialog,
    DATA_TEST_ID: actual.DATA_TEST_ID,
  };
});

jest.mock("src/theme/Backdrop/InactiveBackdrop", () => {
  const actual = jest.requireActual("src/theme/Backdrop/InactiveBackdrop");
  const mockBackdrop = jest
    .fn()
    .mockImplementation(() => <div data-testid={actual.DATA_TEST_ID.INACTIVE_BACKDROP_CONTAINER}></div>);
  return {
    __esModule: true,
    default: mockBackdrop,
    DATA_TEST_ID: actual.DATA_TEST_ID,
  };
});

describe("Chat", () => {
  // AuthenticationStateService methods to be mocked
  const mockGetUser = jest.fn();

  // UserPreferencesStateService methods to be mocked
  const mockGetActiveSessionId = jest.fn();
  const mockActiveSessionHasFeedback = jest.fn();
  const mockSetUserPreferences = jest.fn();

  // UserPreferencesService methods to be mocked
  const mockGetNewSession = jest.fn();
  const mockSetUserPreference = jest.fn();

  // ExperienceService methods to be mocked
  const mockGetExperiences = jest.fn();

  beforeEach(() => {
    // Mock the static getInstance method to return an instance with mocked methods
    jest.spyOn(UserPreferencesStateService, "getInstance").mockReturnValue({
      getActiveSessionId: mockGetActiveSessionId,
      activeSessionHasFeedback: mockActiveSessionHasFeedback,
      setUserPreferences: mockSetUserPreferences,
    } as unknown as UserPreferencesStateService);
    jest.spyOn(AuthenticationStateService, "getInstance").mockReturnValue({
      getUser: mockGetUser,
    } as unknown as AuthenticationStateService);
    jest.spyOn(UserPreferencesService, "getInstance").mockReturnValue({
      getNewSession: mockGetNewSession,
      setUserPreference: mockSetUserPreference,
    } as unknown as UserPreferencesService);
    jest.spyOn(ExperienceService.prototype, "getExperiences").mockImplementation(mockGetExperiences);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("render tests", () => {
    test("should render the Chat component with all its children", () => {
      // GIVEN the Chat component is rendered
      render(<Chat />);
      // THEN expect the container to be visible
      expect(screen.getByTestId(DATA_TEST_ID.CHAT_CONTAINER)).toBeInTheDocument();
      // AND expect the chat header to be visible
      expect(screen.getByTestId(CHAT_HEADER_TEST_ID.CHAT_HEADER_CONTAINER)).toBeInTheDocument();
      // AND expect the chat list to be visible
      expect(screen.getByTestId(CHAT_LIST_TEST_ID.CHAT_LIST_CONTAINER)).toBeInTheDocument();
      // AND expect the chat message field to be visible
      expect(screen.getByTestId(CHAT_MESSAGE_FIELD_TEST_ID.CHAT_MESSAGE_FIELD_CONTAINER)).toBeInTheDocument();
      // AND expect no console errors
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
      // AND the component to match the snapshot
      expect(screen.getByTestId(DATA_TEST_ID.CHAT_CONTAINER)).toMatchSnapshot();
    });
  });

  describe("chat initialization", () => {
    describe("should initialize chat for a user with an active session", () => {
      test("should initialize chat and fetch history on mount when the user has an existing conversation", async () => {
        // GIVEN a logged-in user
        const givenUserId = "fooUser";
        mockGetUser.mockReturnValue({
          id: givenUserId,
          name: "Foo User",
          email: "foo@bar.baz",
        });

        // AND the user has an active session
        const givenSessionId = 123;
        mockGetActiveSessionId.mockReturnValue(givenSessionId);

        // AND a chat service that returns some messages for that session
        let resolveHistory!: (value: ConversationResponse) => void;
        const historyPromise = new Promise<ConversationResponse>((resolve) => {
          resolveHistory = resolve;
        });

        const getChatHistorySpy = jest.spyOn(ChatService.prototype, "getChatHistory").mockReturnValue(historyPromise);

        // WHEN the component is rendered
        render(<Chat />);

        // THEN expect chat history to be fetched for the given session
        expect(getChatHistorySpy).toHaveBeenCalledWith(givenSessionId);
        // AND the chat list to be called with a message that says that compass is typing
        expect(ChatList as jest.Mock).toHaveBeenCalledWith(
          {
            messages: [
              {
                message_id: expect.any(String),
                message: "Typing...",
                sent_at: expect.any(String),
                sender: ConversationMessageSender.COMPASS,
                type: ChatMessageType.TYPING,
              },
            ],
            notifyOnFeedbackFormOpened: expect.any(Function),
          },
          {}
        );

        // AND WHEN the history promise resolves with the given messages
        const givenMessages: ConversationResponse = {
          messages: [
            {
              message_id: nanoid(),
              message: "Hello, how are you?",
              sent_at: new Date().toISOString(),
              sender: ConversationMessageSender.USER,
            },
            {
              message_id: nanoid(),
              message: "I'm good, thank you",
              sent_at: new Date().toISOString(),
              sender: ConversationMessageSender.COMPASS,
            },
          ],
          conversation_completed: false,
          conversation_conducted_at: null,
          experiences_explored: 0,
        };
        act(() => {
          resolveHistory(givenMessages);
        });

        // THEN expect messages to be passed to ChatList
        await waitFor(() => {
          expect(ChatList as jest.Mock).toHaveBeenNthCalledWith(4,
            {
              messages: givenMessages.messages.map((message) => ({
                ...message,
                message_id: expect.any(String), // the id is not sent by the server, so its not part of the given messages
                type: ChatMessageType.BASIC_CHAT, // the message type is not part of the given messages we get from the backend
              })),
              notifyOnFeedbackFormOpened: expect.any(Function),
            },
            {}
          );
        });
      });

      describe("should initialize chat and fetch history on mount and send an empty message when the user has no existing conversation", () => {
        test("should initialize chat and fetch history on mount and send an empty message when the user has no existing conversation", async () => {
          // GIVEN a logged-in user
          const givenUserId = "fooUser";
          mockGetUser.mockReturnValue({
            id: givenUserId,
            name: "Foo User",
            email: "foo@bar.baz",
          });

          // AND the user has an active session
          const givenSessionId = 123;
          mockGetActiveSessionId.mockReturnValue(givenSessionId);

          // AND a chat service that returns an empty message list
          let resolveHistory!: (value: ConversationResponse) => void;
          const historyPromise = new Promise<ConversationResponse>((resolve) => {
            resolveHistory = resolve;
          });

          let resolveSendMessage!: (value: ConversationResponse) => void;
          const sendMessagePromise = new Promise<ConversationResponse>((resolve) => {
            resolveSendMessage = resolve;
          });

          const getChatHistorySpy = jest.spyOn(ChatService.prototype, "getChatHistory").mockReturnValue(historyPromise);
          const sendMessageSpy = jest.spyOn(ChatService.prototype, "sendMessage").mockReturnValue(sendMessagePromise);

          // WHEN the component is mounted
          render(<Chat />);

          // THEN expect chat history to be fetched for the given session
          expect(getChatHistorySpy).toHaveBeenCalledWith(givenSessionId);

          // AND expect a typing indicator to be shown
          expect(ChatList as jest.Mock).toHaveBeenCalledWith(
            expect.objectContaining({
              messages: expect.arrayContaining([expect.objectContaining({ type: ChatMessageType.TYPING })]),
            }),
            {}
          );

          // AND WHEN the getChatHistory promise resolves with an empty message list
          act(() => {
            resolveHistory({
              messages: [],
              conversation_completed: false,
              conversation_conducted_at: null,
              experiences_explored: 0,
            });
          });

          // THEN expect an empty first message to be sent to the chat service
          await waitFor(() => {
            expect(sendMessageSpy).toHaveBeenCalledWith(givenSessionId, "");
          });

          // AND WHEN the message is sent
          const givenSendMessageResponse: ConversationResponse = {
            messages: [
              {
                message_id: nanoid(),
                message: "Hello, how are you?", // A RESPONSE FROM THE AI
                sent_at: new Date().toISOString(),
                sender: ConversationMessageSender.COMPASS,
              },
            ],
            conversation_completed: false,
            conversation_conducted_at: null,
            experiences_explored: 0,
          };
          resolveSendMessage(givenSendMessageResponse);

          // THEN expect the chat list to be updated with the new messages
          await waitFor(() => {
            expect(ChatList as jest.Mock).toHaveBeenCalledWith(
              expect.objectContaining({
                messages: givenSendMessageResponse.messages.map((message) => ({
                  ...message,
                  message_id: expect.any(String), // the id is not sent by the server, so its not part of the given messages
                  type: ChatMessageType.BASIC_CHAT,  // the message type is not part of the given messages
                })),
              }),
              {}
            );
          });
        });

        test("should throw an error if sending an empty message fails", async () => {
          // GIVEN a logged-in user
          const givenUserId = "fooUser";
          mockGetUser.mockReturnValue({
            id: givenUserId,
            name: "Foo User",
            email: "foo@bar.baz",
          });

          // AND the user has an active session
          const givenSessionId = 123;
          mockGetActiveSessionId.mockReturnValue(givenSessionId);

          // AND a chat service that returns an empty array of messages given a session id
          let resolveHistory!: (value: ConversationResponse) => void;
          const historyPromise = new Promise<ConversationResponse>((resolve) => {
            resolveHistory = resolve;
          });
          jest.spyOn(ChatService.prototype, "getChatHistory").mockReturnValue(historyPromise);

          // AND some preexisting messages
          const givenMessages: ConversationResponse = {
            messages: [],
            conversation_completed: false,
            conversation_conducted_at: null,
            experiences_explored: 0,
          };

          // AND a chat service that fails to send a message
          let rejectSendMessage!: (error: Error) => void;
          const sendMessagePromise = new Promise<ConversationResponse>((_, reject) => {
            rejectSendMessage = reject;
          });

          jest.spyOn(ChatService.prototype, "sendMessage").mockReturnValue(sendMessagePromise);

          // WHEN the component is mounted
          render(<Chat />);

          // THEN expect a typing indicator to be shown
          expect(ChatList as jest.Mock).toHaveBeenCalledWith(
            expect.objectContaining({
              messages: expect.arrayContaining([expect.objectContaining({ type: ChatMessageType.TYPING })]),
            }),
            {}
          );

          // AND WHEN the history promise resolves with the given messages list
          act(() => {
            resolveHistory(givenMessages);
          });

          // AND WHEN the send message promise rejects with a given error
          const givenError = new Error("Failed to send message");
          rejectSendMessage(givenError);

          // THEN expect an error to have be logged
          await waitFor(() => {
            expect(console.error).toHaveBeenCalledWith(new ChatError("Failed to send message:", givenError));
          });
          // AND expect a message to be shown in the chat
          await waitFor(() => {
            expect(ChatList as jest.Mock).toHaveBeenCalledWith(
              expect.objectContaining({
                messages: [
                  {
                    message_id: expect.any(String),
                    message: "I'm sorry, Something seems to have gone wrong on my end... Can you please repeat that?",
                    sent_at: expect.any(String),
                    sender: ConversationMessageSender.COMPASS,
                    type: ChatMessageType.BASIC_CHAT,
                  },
                ],
              }),
              {}
            );
          });
        });
      });

      test("should show error if fetching history fails", async () => {
        // GIVEN a logged-in user
        const givenUserId = "fooUser";
        mockGetUser.mockReturnValue({
          id: givenUserId,
          name: "Foo User",
          email: "foo@bar.baz",
        });

        // AND the user has an active session
        const givenSessionId = 123;
        mockGetActiveSessionId.mockReturnValue(givenSessionId);

        // AND a chat service that fails to get chat history
        let rejectHistory!: (error: Error) => void;
        const historyPromise = new Promise<ConversationResponse>((_, reject) => {
          rejectHistory = reject;
        });

        jest.spyOn(ChatService.prototype, "getChatHistory").mockReturnValue(historyPromise);

        // WHEN the component is mounted
        render(<Chat />);

        // THEN expect the typing indicator
        expect(ChatList as jest.Mock).toHaveBeenCalledWith(
          expect.objectContaining({
            messages: expect.arrayContaining([expect.objectContaining({ type: ChatMessageType.TYPING })]),
          }),
          {}
        );

        // AND WHEN the history promise rejects with a given error
        const givenError = new Error("Chat service failed to get history");
        rejectHistory(givenError);

        // THEN expect an error to have be logged
        await waitFor(() => {
          expect(console.error).toHaveBeenCalledWith(new ChatError("Failed to initialize chat", givenError));
        });
        // AND expect a snackbar notification to be shown
        await waitFor(() => {
          expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith(
            "An unexpected error occurred. Please try again later.",
            { variant: "error" }
          );
        });

        // AND expect no messages to be in the chat
        expect(ChatList as jest.Mock).toHaveBeenCalledWith(
          expect.objectContaining({
            messages: [],
          }),
          {}
        );
      });
    });

    describe("should initialize chat for a user that does not have an active session", () => {
      test("should create a new chat session if the active session is not found", async () => {
        // GIVEN a logged-in user
        const givenUserId = "fooUser";
        mockGetUser.mockReturnValue({
          id: givenUserId,
          name: "Foo User",
          email: "foo@bar.baz",
        });

        // AND the user has no active session
        mockGetActiveSessionId.mockReturnValue(null);

        // AND a chat service that returns an empty array of messages given a session id
        let resolveHistory!: (value: ConversationResponse) => void;
        const historyPromise = new Promise<ConversationResponse>((resolve) => {
          resolveHistory = resolve;
        });

        let resolveSendMessage!: (value: ConversationResponse) => void;
        const sendMessagePromise = new Promise<ConversationResponse>((resolve) => {
          resolveSendMessage = resolve;
        });

        const getChatHistorySpy = jest.spyOn(ChatService.prototype, "getChatHistory").mockReturnValue(historyPromise);

        const sendMessageSpy = jest.spyOn(ChatService.prototype, "sendMessage").mockReturnValue(sendMessagePromise);

        // AND a user preferences service that creates a new session and returns the id
        let resolveNewSession!: (value: number) => void;
        const newSessionPromise = new Promise<number>((resolve) => {
          resolveNewSession = resolve;
        });
        mockGetNewSession.mockReturnValue(newSessionPromise);

        // WHEN the component is mounted
        render(<Chat />);

        // THEN expect the getNewSession method to be called
        expect(UserPreferencesService.getInstance().getNewSession).toHaveBeenCalled();

        // AND a typing indicator to be shown
        expect(ChatList as jest.Mock).toHaveBeenCalledWith(
          expect.objectContaining({
            messages: expect.arrayContaining([expect.objectContaining({ type: ChatMessageType.TYPING })]),
          }),
          {}
        );

        // AND WHEN the new session promise resolves
        const givenNewSessionId = 456;
        resolveNewSession(givenNewSessionId);
        // we have to inform the userPreferences state that the session has changed (since we are mocking the service)
        mockGetActiveSessionId.mockReturnValue(givenNewSessionId);

        // THEN expect the user preferences state to be updated with the new session id
        await waitFor(() => {
          expect(mockSetUserPreferences).toHaveBeenCalledWith(givenNewSessionId);
        });

        // THEN expect chat history to be fetched for the new session
        expect(getChatHistorySpy).toHaveBeenCalledWith(givenNewSessionId);

        // AND WHEN the history promise resolves with an empty message list
        const givenMessages: ConversationResponse = {
          messages: [],
          conversation_completed: false,
          conversation_conducted_at: null,
          experiences_explored: 0,
        };
        act(() => {
          resolveHistory(givenMessages);
        });

        // THEN expect the chat list to be updated with the new (empty) messages list
        await waitFor(() => {
          expect(ChatList as jest.Mock).toHaveBeenCalledWith(expect.objectContaining({ messages: [] }), {});
        });

        // AND expect an empty message to be sent to the chat service for the new session
        expect(sendMessageSpy).toHaveBeenCalledWith(givenNewSessionId, "")

        // AND WHEN the send message promise resolves
        const givenSendMessageResponse: ConversationResponse = {
          messages: [
            {
              message_id: nanoid(),
              message: "Hello, how are you?", // A RESPONSE FROM THE AI
              sent_at: new Date().toISOString(),
              sender: ConversationMessageSender.COMPASS,
            },
          ],
          conversation_completed: false,
          conversation_conducted_at: null,
          experiences_explored: 0,
        };
        resolveSendMessage(givenSendMessageResponse);

        // THEN expect the chat list to be updated with the new messages
        await waitFor(() => {
          expect(ChatList as jest.Mock).toHaveBeenCalledWith(
            expect.objectContaining({
              messages: givenSendMessageResponse.messages.map((message) => ({
                ...message,
                message_id: expect.any(String), // the id is not sent by the server, so its not part of the given messages
                type: ChatMessageType.BASIC_CHAT,   // the message type is not part of the given messages
              })),
            }),
            {}
          );
        });
      });

      test("should show error if creating a new session fails", async () => {
        // GIVEN a logged-in user
        const givenUserId = "fooUser";
        mockGetUser.mockReturnValue({
          id: givenUserId,
          name: "Foo User",
          email: "foo@bar.baz",
        });

        // AND the user has no active session
        mockGetActiveSessionId.mockReturnValue(null);

        // AND a user preferences service that fails to create a new session
        let rejectNewSession!: (error: Error) => void;
        const newSessionPromise = new Promise<number>((_, reject) => {
          rejectNewSession = reject;
        });
        mockGetNewSession.mockReturnValue(newSessionPromise);

        // WHEN the component is mounted
        render(<Chat />);

        // THEN expect a typing indicator to be shown
        expect(ChatList as jest.Mock).toHaveBeenCalledWith(
          expect.objectContaining({
            messages: expect.arrayContaining([expect.objectContaining({ type: ChatMessageType.TYPING })]),
          }),
          {}
        );

        // THEN expect the getNewSession method to be called
        expect(UserPreferencesService.getInstance().getNewSession).toHaveBeenCalled();

        // AND WHEN the new session promise rejects with a given error
        const givenError = new Error("Failed to create new session");
        act(() => {
          rejectNewSession(givenError);
        });

        // THEN expect an error to have be logged
        await waitFor(() => {
          expect(console.error).toHaveBeenCalledWith(new ChatError("Failed to create new session", givenError));
        });
        // AND expect a snackbar notification to be shown
        await waitFor(() => {
          expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith("Failed to start new conversation", {
            variant: "error",
          });
        });

        // AND expect no messages to be in the chat
        expect(ChatList as jest.Mock).toHaveBeenCalledWith(
          expect.objectContaining({
            messages: [],
          }),
          {}
        );
      });

      test("should show error if fetching history fails", async () => {
        // GIVEN a logged-in user
        const givenUserId = "fooUser";
        mockGetUser.mockReturnValue({
          id: givenUserId,
          name: "Foo User",
          email: "foo@bar.baz",
        });

        // AND the user has no active session
        mockGetActiveSessionId.mockReturnValue(null);

        // AND a user preferences service that creates a new session and returns the id
        let resolveNewSession!: (value: number) => void;
        const newSessionPromise = new Promise<number>((resolve) => {
          resolveNewSession = resolve;
        });
        mockGetNewSession.mockReturnValue(newSessionPromise);

        // AND a chat service that fails to get chat history
        let rejectHistory!: (error: Error) => void;
        const historyPromise = new Promise<ConversationResponse>((_, reject) => {
          rejectHistory = reject;
        });
        jest.spyOn(ChatService.prototype, "getChatHistory").mockReturnValue(historyPromise);

        // WHEN the component is mounted
        render(<Chat />);

        // THEN expect a typing indicator to be shown
        expect(ChatList as jest.Mock).toHaveBeenCalledWith(
          expect.objectContaining({
            messages: expect.arrayContaining([expect.objectContaining({ type: ChatMessageType.TYPING })]),
          }),
          {}
        );

        // AND expect the getNewSession method to be called
        expect(UserPreferencesService.getInstance().getNewSession).toHaveBeenCalled();

        // AND WHEN the new session promise resolves
        const givenNewSessionId = 456;
        resolveNewSession(givenNewSessionId);
        // we have to inform the userPreferences state that the session has changed (since we are mocking the service)
        mockGetActiveSessionId.mockReturnValue(givenNewSessionId);

        // AND WHEN the history promise rejects with a given error
        const givenError = new Error("Failed to get chat history");
        rejectHistory(givenError);

        // THEN expect an error to have be logged
        await waitFor(() => {
          expect(console.error).toHaveBeenCalledWith(new ChatError("Failed to initialize chat", givenError));
        });

        // AND expect no messages to be in the chat
        expect(ChatList as jest.Mock).toHaveBeenLastCalledWith(
          expect.objectContaining({
            messages: [],
          }),
          {}
        );
      });

      test("should show error if sending message fails", async () => {
        // GIVEN a logged-in user
        const givenUserId = "fooUser";
        mockGetUser.mockReturnValue({
          id: givenUserId,
          name: "Foo User",
          email: "foo@bar.baz",
        });

        // AND the user has no active session
        mockGetActiveSessionId.mockReturnValue(null);

        // AND a user preferences service that creates a new session and returns the id
        let resolveNewSession!: (value: number) => void;
        const newSessionPromise = new Promise<number>((resolve) => {
          resolveNewSession = resolve;
        });
        mockGetNewSession.mockReturnValue(newSessionPromise);

        // AND a chat service that gets an empty message list
        let resolveHistory!: (value: ConversationResponse) => void;
        const historyPromise = new Promise<ConversationResponse>((resolve) => {
          resolveHistory = resolve;
        });
        jest.spyOn(ChatService.prototype, "getChatHistory").mockReturnValue(historyPromise);

        // AND a chat service that fails to send a message
        let rejectSendMessage!: (error: Error) => void;
        const sendMessagePromise = new Promise<ConversationResponse>((_, reject) => {
          rejectSendMessage = reject;
        });

        jest.spyOn(ChatService.prototype, "sendMessage").mockReturnValue(sendMessagePromise);

        // AND a chat history with no messages
        const givenMessages: ConversationResponse = {
          messages: [],
          conversation_completed: false,
          conversation_conducted_at: null,
          experiences_explored: 0,
        };

        // WHEN the component is mounted
        render(<Chat />);

        // THEN expect a typing indicator to be shown
        expect(ChatList as jest.Mock).toHaveBeenCalledWith(
          expect.objectContaining({
            messages: expect.arrayContaining([expect.objectContaining({ type: ChatMessageType.TYPING })]),
          }),
          {}
        );

        // AND expect the getNewSession method to be called
        expect(UserPreferencesService.getInstance().getNewSession).toHaveBeenCalled();

        // AND WHEN the new session promise resolves
        const givenNewSessionId = 456;
        resolveNewSession(givenNewSessionId);
        // we have to inform the userPreferences state that the session has changed (since we are mocking the service)
        mockGetActiveSessionId.mockReturnValue(givenNewSessionId);

        // AND WHEN the history promise resolves
        resolveHistory(givenMessages);

        // THEN expect the chat list to be updated with the new messages
        await waitFor(() => {
          expect(ChatList as jest.Mock).toHaveBeenCalledWith(
            expect.objectContaining({ messages: givenMessages.messages }),
            {}
          );
        });

        // AND WHEN the send message promise rejects with a given error
        const givenError = new Error("Failed to send message");
        rejectSendMessage(givenError);

        // THEN expect an error to have be logged
        await waitFor(() => {
          expect(console.error).toHaveBeenCalledWith(new ChatError("Failed to send message:", givenError));
        });

        // AND expect a message to be shown in the chat
        await waitFor(() => {
          expect(ChatList as jest.Mock).toHaveBeenCalledWith(
            expect.objectContaining({
              messages: [
                {
                  message_id: expect.any(String),
                  message: "I'm sorry, Something seems to have gone wrong on my end... Can you please repeat that?",
                  sent_at: expect.any(String),
                  sender: ConversationMessageSender.COMPASS,
                  type: ChatMessageType.BASIC_CHAT,
                },
              ],
            }),
            {}
          );
        });
      });
    });
  });

  describe("sending a message", () => {
    test("should send a message successfully", async () => {
      // GIVEN a user with an active session
      const givenUserId = "fooUser";
      mockGetUser.mockReturnValue({
        id: givenUserId,
        name: "Foo User",
        email: "foo@bar.baz",
      });
      // AND the user has an active session
      const givenSessionId = 123;
      mockGetActiveSessionId.mockReturnValue(givenSessionId);

      // AND the user has a previous conversation
      const givenPreviousConversation: ConversationResponse = {
        messages: [
          {
            message_id: nanoid(),
            message: "Hello, how can I assist you today?",
            sent_at: new Date().toISOString(),
            sender: ConversationMessageSender.COMPASS,
          },
          {
            message_id: nanoid(),
            message: "We can start by exploring your experiences.",
            sent_at: new Date().toISOString(),
            sender: ConversationMessageSender.COMPASS,
          },
          {
            message_id: nanoid(),
            message: "Good, let's start. I was a baker for 10 years.",
            sent_at: new Date().toISOString(),
            sender: ConversationMessageSender.USER,
          },
          {
            message_id: nanoid(),
            message: "Wow, a baker for 10 years! That's a long time. What was your favorite part about it?",
            sent_at: new Date().toISOString(),
            sender: ConversationMessageSender.COMPASS,
          },
        ],
        conversation_completed: false,
        conversation_conducted_at: null,
        experiences_explored: 0,
      };
      jest.spyOn(ChatService.prototype, "getChatHistory").mockResolvedValue(givenPreviousConversation);

      // AND a chat service that sends a message successfully
      const givenSendMessageResponse: ConversationResponse = {
        messages: [
          {
            message_id: nanoid(),
            message: "What skills did you learn?",
            sent_at: new Date().toISOString(),
            sender: ConversationMessageSender.COMPASS,
          },
          {
            message_id: nanoid(),
            message: "Are you still doing that?",
            sent_at: new Date().toISOString(),
            sender: ConversationMessageSender.COMPASS,
          },
        ],
        conversation_completed: false,
        conversation_conducted_at: null,
        experiences_explored: 0,
      };
      let resolveSendMessage!: (value: ConversationResponse) => void;
      const sendMessagePromise = new Promise<ConversationResponse>((resolve) => {
        resolveSendMessage = resolve;
      });

      const sendMessageSpy = jest.spyOn(ChatService.prototype, "sendMessage").mockReturnValue(sendMessagePromise);

      // WHEN the component is mounted
      render(<Chat />);

      // AND WHEN the types a message
      const givenMessage = "I loved the smell of the bread and the taste of the cake.";
      act(() => {
        (ChatMessageField as jest.Mock).mock.calls.at(-1)[0].notifyChange(givenMessage);
      });

      // AND WHEN the user sends the message
      act(() => {
        (ChatMessageField as jest.Mock).mock.calls.at(-1)[0].handleSend();
      });

      // THEN expect the send message method to be called
      expect(sendMessageSpy).toHaveBeenCalledWith(givenSessionId, givenMessage);

      // AND expect the user's message and a typing indicator to be shown in the chat
      await waitFor(() => {
        expect(ChatList as jest.Mock).toHaveBeenLastCalledWith(
          expect.objectContaining({
            messages: expect.arrayContaining([
              expect.objectContaining({ message: givenMessage }),
              expect.objectContaining({ type: ChatMessageType.TYPING }),
            ]),
          }),
          {}
        );
      });

      // AND WHEN the send message promise resolves
      act(() => {
        resolveSendMessage(givenSendMessageResponse);
      });

      // THEN expect the previous conversation and the response from the chat service to be shown in the chat
      await waitFor(() => {
        expect(ChatList as jest.Mock).toHaveBeenLastCalledWith(
          expect.objectContaining({
            messages: expect.arrayContaining([
              ...givenPreviousConversation.messages.map((message) =>
                expect.objectContaining({ message: message.message })
              ),
              ...givenSendMessageResponse.messages.map((message) =>
                expect.objectContaining({ message: message.message })
              ),
            ]),
          }),
          {}
        );
      });

      // AND expect that no errors or warnings were logged
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();

      // AND expect that the chat input is cleared
      expect(ChatMessageField as jest.Mock).toHaveBeenLastCalledWith(expect.objectContaining({ message: "" }), {});
    });

    test("should handle send message error", async () => {
      // GIVEN a user with an active session
      const givenUserId = "fooUser";
      mockGetUser.mockReturnValue({
        id: givenUserId,
        name: "Foo User",
        email: "foo@bar.baz",
      });

      // AND the user has an active session
      const givenSessionId = 123;
      mockGetActiveSessionId.mockReturnValue(givenSessionId);

      // AND the user has a previous conversation
      const givenPreviousConversation: ConversationResponse = {
        messages: [
          {
            message_id: nanoid(),
            message: "Hello, how can I assist you today?",
            sent_at: new Date().toISOString(),
            sender: ConversationMessageSender.COMPASS,
          },
        ],
        conversation_completed: false,
        conversation_conducted_at: null,
        experiences_explored: 0,
      };

      jest.spyOn(ChatService.prototype, "getChatHistory").mockResolvedValue(givenPreviousConversation);

      // AND a chat service that fails to send a message
      const givenError = new Error("Failed to send message");
      const sendMessageSpy = jest.spyOn(ChatService.prototype, "sendMessage").mockRejectedValue(givenError);

      // WHEN the component is mounted
      render(<Chat />);

      // AND WHEN the user types a message
      const givenMessage = "I loved the smell of the bread and the taste of the cake.";
      act(() => {
        (ChatMessageField as jest.Mock).mock.calls.at(-1)[0].notifyChange(givenMessage);
      });

      // AND WHEN the user sends the message
      act(() => {
        (ChatMessageField as jest.Mock).mock.calls.at(-1)[0].handleSend();
      });

      // THEN expect the send message method to be called
      expect(sendMessageSpy).toHaveBeenCalledWith(givenSessionId, givenMessage);

      // AND expect an error to have been logged
      await waitFor(() => {
        expect(console.error).toHaveBeenCalledWith(new ChatError("Failed to send message:", givenError));
      });

      // AND expect a message to be shown in the chat
      await waitFor(() => {
        expect(ChatList as jest.Mock).toHaveBeenLastCalledWith(
          expect.objectContaining({
            messages: [
              ...givenPreviousConversation.messages.map((message) => ({
                ...message,
                sent_at: expect.any(String),
                message_id: expect.any(String),
                type: ChatMessageType.BASIC_CHAT,
              })),
              expect.objectContaining({
                message: "I'm sorry, Something seems to have gone wrong on my end... Can you please repeat that?",
              }),
            ],
          }),
          {}
        );
      });
    });
  });

  describe("opening experience drawer and fetching experiences", () => {
    test("should open drawer and fetch experiences", async () => {
      // GIVEN a user with an active session
      const givenUserId = "fooUser";
      mockGetUser.mockReturnValue({
        id: givenUserId,
        name: "Foo User",
        email: "foo@bar.baz",
      });
      const givenSessionId = 123;
      mockGetActiveSessionId.mockReturnValue(givenSessionId);
      // WHEN the component is rendered
      render(<Chat />);

      // AND an experience service that returns some experiences
      const givenExperiences = [
        {
          UUID: "1",
          start_date: "2024-01-01",
          end_date: "2024-01-01",
          experience_title: "Experience 1",
          company: "Company 1",
          location: "Location 1",
          work_type: WorkType.SELF_EMPLOYMENT,
          top_skills: [],
        },
      ];
      mockGetExperiences.mockResolvedValue(givenExperiences);

      // WHEN the experiences button is clicked
      // we are using the last call to the ChatHeader mock because the first one is the initial call
      // and a bunch of calls are made when the component is re-rendered,
      // for example, due to the chat initialization
      (ChatHeader as jest.Mock).mock.calls.at(-1)[0].notifyOnExperiencesDrawerOpen();

      // THEN expect the drawer to open
      await waitFor(() => {
        expect(screen.getByTestId(EXPERIENCE_DRAWER_TEST_ID.EXPERIENCES_DRAWER_CONTAINER)).toBeInTheDocument();
      });

      // AND expect experiences to be fetched for the active session
      expect(mockGetExperiences).toHaveBeenCalled();

      // AND expect the experiences to be passed to the drawer
      await waitFor(() => {
        expect(ExperiencesDrawer as jest.Mock).toHaveBeenCalledWith(
          {
            experiences: givenExperiences,
            isLoading: false,
            isOpen: true,
            conversationConductedAt: null,
            notifyOnClose: expect.any(Function),
          },
          {}
        );
      });
    });

    test("should handle experience fetch error", async () => {
      // GIVEN a user with an active session
      const givenUserId = "fooUser";
      mockGetUser.mockReturnValue({
        id: givenUserId,
        name: "Foo User",
        email: "foo@bar.baz",
      });
      const givenSessionId = 123;
      mockGetActiveSessionId.mockReturnValue(givenSessionId);
      // AND a failing experience service
      const givenError = new Error("Failed to fetch experiences");
      mockGetExperiences.mockRejectedValue(givenError);

      // WHEN the component is mounted
      render(<Chat />);

      // AND the experiences button is clicked
      // we are using the last call to the ChatHeader mock because the first one is the initial call
      // and a bunch of calls are made when the component is re-rendered,
      // for example, due to the chat initialization
      (ChatHeader as jest.Mock).mock.calls.at(-1)[0].notifyOnExperiencesDrawerOpen();

      // THEN expect error notification
      await waitFor(() => {
        expect(console.error).toHaveBeenCalledWith(new ChatError("Failed to retrieve experiences", givenError));
      });
      // AND expect a snackbar notification
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith("Failed to retrieve experiences", {
        variant: "error",
      });
    });
  });

  describe("starting a new conversation", () => {
    test("should start a new conversation", async () => {
      // GIVEN a user with an active session
      const givenUserId = "fooUser";
      mockGetUser.mockReturnValue({
        id: givenUserId,
        name: "Foo User",
        email: "foo@bar.baz",
      });
      const givenSessionId = 123;
      mockGetActiveSessionId.mockReturnValue(givenSessionId);

      // AND a user preferences service that returns a new session id
      const givenNewSessionId = 456;
      let resolveNewSession!: (value: UserPreference) => void;
      const mockNewSessionPromise = new Promise<UserPreference>((resolve) => {
        resolveNewSession = resolve;
      });
      mockGetNewSession.mockReturnValue(mockNewSessionPromise);

      // AND a chat service that returns an empty message list for the new session
      const historyPromise = Promise.resolve({
        messages: [],
        conversation_completed: false,
        conversation_conducted_at: null,
        experiences_explored: 0,
      });
      const givenSendMessageResponse: ConversationResponse = {
        messages: [
          {
            message_id: nanoid(),
            message: "Hello, how can I assist you today?",
            sent_at: new Date().toISOString(),
            sender: ConversationMessageSender.COMPASS,
          },
        ],
        conversation_completed: false,
        conversation_conducted_at: null,
        experiences_explored: 0,
      };
      const sendMessagePromise = Promise.resolve(givenSendMessageResponse);
      const getChatHistorySpy = jest.spyOn(ChatService.prototype, "getChatHistory").mockReturnValue(historyPromise);
      const sendMessageSpy = jest.spyOn(ChatService.prototype, "sendMessage").mockReturnValue(sendMessagePromise);

      // AND the component is mounted
      render(<Chat />);

      // THEN expect the chat history to be fetched for the existing session
      expect(getChatHistorySpy).toHaveBeenCalledWith(givenSessionId);

      // AND WHEN the new conversation button is clicked,
      // we are using the last call to the ChatHeader mock because the first one is the initial call
      // and a bunch of calls are made when the component is re-rendered,
      // for example, due to the chat initialization
      (ChatHeader as jest.Mock).mock.calls.at(-1)[0].startNewConversation();

      // THEN expect confirmation dialog to be shown
      await waitFor(() => {
        expect(screen.getByTestId(CONFIRM_MODAL_DIALOG_DATA_TEST_ID.CONFIRM_MODAL)).toBeInTheDocument();
      });

      // WHEN the user confirms,
      // we are using the last call to the ConfirmModalDialog mock because the first one is the initial call
      // and a bunch of calls are made when the component is re-rendered,
      // for example, due to the chat initialization
      (ConfirmModalDialog as jest.Mock).mock.calls.at(-1)[0].onConfirm();

      // THEN expect the new session to be fetched
      await waitFor(() => {
        expect(mockGetNewSession).toHaveBeenCalled();
      });
      // AND expect the chat to be reset and only show the typing indicator
      await waitFor(() => {
        expect(ChatList as jest.Mock).toHaveBeenCalledWith(
          expect.objectContaining({
            messages: expect.arrayContaining([expect.objectContaining({ type: ChatMessageType.TYPING })]),
          }),
          {}
        );
      });
      // AND when the new session promise resolves
      resolveNewSession({ sessions: [givenNewSessionId] } as unknown as UserPreference);
      // we have to inform the userPreferences state that the session has changed (since we are mocking the service)
      mockGetActiveSessionId.mockReturnValue(givenNewSessionId);

      // THEN expect the chat history to be fetched for the new session
      await waitFor(() => {
        expect(getChatHistorySpy).toHaveBeenCalledWith(givenNewSessionId);
      })
      // AND expect an empty message to be sent to the chat service for the new session
      expect(sendMessageSpy).toHaveBeenCalledWith(givenNewSessionId, "")
      // AND expect the chat list to be updated with the response from the chat service
      await waitFor(() => {
        expect(ChatList as jest.Mock).toHaveBeenCalledWith(
          expect.objectContaining({
            messages: givenSendMessageResponse.messages.map((message) => ({
              ...message,
              message_id: expect.any(String),
              type: ChatMessageType.BASIC_CHAT,
            })),
          }),
          {}
        );
      });
    });

    test("should handle new conversation cancellation", async () => {
      // GIVEN a user with an active session
      const givenUserId = "fooUser";
      mockGetUser.mockReturnValue({
        id: givenUserId,
        name: "Foo User",
        email: "foo@bar.baz",
      });
      const givenSessionId = 123;
      mockGetActiveSessionId.mockReturnValue(givenSessionId);
      // AND a chat service that returns an existing conversation
      const givenMessages = [
        {
          message_id: nanoid(),
          message: "Hello, how can I assist you today?",
          sent_at: new Date().toISOString(),
          sender: ConversationMessageSender.COMPASS,
        },
      ];
      const historyPromise = Promise.resolve({
        messages: givenMessages,
        conversation_completed: false,
        conversation_conducted_at: null,
        experiences_explored: 0,
      });
      jest.spyOn(ChatService.prototype, "getChatHistory").mockReturnValue(historyPromise);

      // AND the component is mounted
      render(<Chat />);

      // WHEN new conversation clicked
      // we are using the last call to the ChatHeader mock because the first one is the initial call
      // and a bunch of calls are made when the component is re-rendered,
      // for example, due to the chat initialization
      (ChatHeader as jest.Mock).mock.calls.at(-1)[0].startNewConversation();

      // THEN expect confirmation dialog to be shown
      await waitFor(() => {
        expect(screen.getByTestId(CONFIRM_MODAL_DIALOG_DATA_TEST_ID.CONFIRM_MODAL)).toBeInTheDocument();
      });

      // WHEN user cancels
      // we are using the last call to the ConfirmModalDialog mock because the first one is the initial call
      // and a bunch of calls are made when the component is re-rendered,
      // for example, due to the chat initialization
      (ConfirmModalDialog as jest.Mock).mock.calls.at(-1)[0].onCancel();

      // THEN expect dialog to close
      expect(screen.queryByText("Are you sure you want to start a new conversation?")).not.toBeInTheDocument();

      // AND expect chat state to remain unchanged
      expect(ChatList as jest.Mock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          messages: givenMessages.map((message) => ({
            ...message,
            message_id: expect.any(String),
            type: ChatMessageType.BASIC_CHAT,
          })),
        }),
        {}
      );
    });

    test("should handle new conversation error", async () => {
      // GIVEN a user with an active session
      const givenUserId = "fooUser";
      mockGetUser.mockReturnValue({
        id: givenUserId,
        name: "Foo User",
        email: "foo@bar.baz",
      });
      const givenSessionId = 123;
      mockGetActiveSessionId.mockReturnValue(givenSessionId);

      // AND a chat service that returns an existing conversation
      const givenMessages = [
        {
          message_id: nanoid(),
          message: "Hello, how can I assist you today?",
          sent_at: new Date().toISOString(),
          sender: ConversationMessageSender.COMPASS,
        },
      ];
      const historyPromise = Promise.resolve({
        messages: givenMessages,
        conversation_completed: false,
        conversation_conducted_at: null,
        experiences_explored: 0,
      });
      jest.spyOn(ChatService.prototype, "getChatHistory").mockReturnValue(historyPromise);

      // AND a failing new session service
      const givenError = new Error("Failed to start new conversation");
      mockGetNewSession.mockRejectedValue(givenError);

      // AND the component is mounted
      render(<Chat />);

      // WHEN new conversation clicked
      (ChatHeader as jest.Mock).mock.calls.at(-1)[0].startNewConversation();

      // THEN expect confirmation dialog to be shown
      await waitFor(() => {
        expect(screen.getByTestId(CONFIRM_MODAL_DIALOG_DATA_TEST_ID.CONFIRM_MODAL)).toBeInTheDocument();
      });

      // AND the user confirms
      // we are using the last call to the ConfirmModalDialog mock because the first one is the initial call
      // and a bunch of calls are made when the component is re-rendered,
      // for example, due to the chat initialization
      (ConfirmModalDialog as jest.Mock).mock.calls.at(-1)[0].onConfirm();

      // THEN expect an error message to be added to the chat list
      await waitFor(() => {
        expect(ChatList as jest.Mock).toHaveBeenLastCalledWith(
          expect.objectContaining({
            messages: expect.arrayContaining([
              expect.objectContaining({
                message: "I'm sorry, Something seems to have gone wrong on my end... Can you please repeat that?",
                sender: ConversationMessageSender.COMPASS,
              }),
            ]),
          }),
          {}
        );
      });
      // AND expect a snackbar notification
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith("Failed to start new conversation", {
        variant: "error",
      });
      // AND expect the dialog to close
      expect(screen.queryByText("Are you sure you want to start a new conversation?")).not.toBeInTheDocument();
    });
  });

  describe("handling feedback submission", () => {
    test("should handle feedback submission successfully", async () => {
      // GIVEN a user with an active session
      const givenUserId = "fooUser";
      mockGetUser.mockReturnValue({
        id: givenUserId,
        name: "Foo User",
        email: "foo@bar.baz",
      });
      const givenSessionId = 123;
      mockGetActiveSessionId.mockReturnValue(givenSessionId);

      // AND a chat service with existing messages
      const givenMessages: ConversationResponse = {
        messages: [
          {
            message_id: nanoid(),
            message: "Hello, how are you?",
            sent_at: new Date().toISOString(),
            sender: ConversationMessageSender.USER,
          },
          {
            message_id: nanoid(),
            message: "I'm good, thank you",
            sent_at: new Date().toISOString(),
            sender: ConversationMessageSender.COMPASS,
          },
        ],
        conversation_completed: true, // Conversation needs to be completed to show feedback
        conversation_conducted_at: new Date().toISOString(),
        experiences_explored: 1,
      };
      const historyPromise = Promise.resolve(givenMessages);
      jest.spyOn(ChatService.prototype, "getChatHistory").mockReturnValue(historyPromise);

      // WHEN the component is mounted
      render(<Chat />);

      // AND the feedback form is triggered
      // we are using the last call to the ChatList mock because the first one is the initial call
      // and a bunch of calls are made when the component is re-rendered,
      // for example, due to the chat initialization
      act(() => {
        (ChatList as jest.Mock).mock.calls.at(-1)[0].notifyOnFeedbackFormOpened();
      });

      // THEN expect feedback form to be visible
      await waitFor(() => {
        expect(screen.getByTestId(FEEDBACK_FORM_DATA_TEST_ID.FEEDBACK_FORM_DIALOG)).toBeInTheDocument();
      });

      // AND the user submits feedback
      // we are using the last call to the FeedbackForm mock because the first one is the initial call
      // and a bunch of calls are made when the component is re-rendered,
      // for example, due to the chat initialization
      act(() => {
        (FeedbackForm as jest.Mock).mock.calls.at(-1)[0].onFeedbackSubmit();
      });

      // THEN expect the conversation conclusion message to be removed from the chat list
      await waitFor(() => {
        expect(ChatList as jest.Mock).toHaveBeenLastCalledWith(
          expect.objectContaining({
            messages: expect.not.arrayContaining([
              expect.objectContaining({ type: ChatMessageType.CONVERSATION_CONCLUSION }),
            ]),
          }),
          {}
        );
      });

      // AND expect a thank you message to be added to the chat list
      await waitFor(() => {
        expect(ChatList as jest.Mock).toHaveBeenLastCalledWith(
          expect.objectContaining({
            messages: expect.arrayContaining([
              expect.objectContaining({
                message:
                  "Thank you for taking the time to share your valuable feedback. Your input is important to us.",
                sender: ConversationMessageSender.COMPASS,
              }),
            ]),
          }),
          {}
        );
      });
    });
  });

  describe("handling inactivity backdrop", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      // Reset the Date.now() mock before each test
      jest.spyOn(Date, "now").mockImplementation(() => 0);
    });

    afterEach(() => {
      jest.useRealTimers();
      jest.restoreAllMocks();
    });

    test("should show inactive backdrop after inactivity timeout", async () => {
      // GIVEN a user with an active session
      const givenUserId = "fooUser";
      mockGetUser.mockReturnValue({
        id: givenUserId,
        name: "Foo User",
        email: "foo@bar.baz",
      });
      const givenSessionId = 123;
      mockGetActiveSessionId.mockReturnValue(givenSessionId);

      // AND a chat service with some messages
      const givenMessages: ConversationResponse = {
        messages: [
          {
            message_id: nanoid(),
            message: "Hello",
            sent_at: new Date().toISOString(),
            sender: ConversationMessageSender.USER,
          },
        ],
        conversation_completed: false,
        conversation_conducted_at: null,
        experiences_explored: 0,
      };
      jest.spyOn(ChatService.prototype, "getChatHistory").mockResolvedValue(givenMessages);


      // WHEN the component is mounted
      render(<Chat />);

      // AND time passes beyond the inactivity timeout
      act(() => {
        // Advance Date.now() to simulate time passing
        jest.spyOn(Date, "now").mockImplementation(() => INACTIVITY_TIMEOUT + 1);
        // Trigger the check interval
        jest.advanceTimersByTime(CHECK_INACTIVITY_INTERVAL);
      });

      // THEN expect the backdrop to be visible
      await waitFor(() => {
        expect(screen.getByTestId(INACTIVE_BACKDROP_DATA_TEST_ID.INACTIVE_BACKDROP_CONTAINER)).toBeInTheDocument();
      });
    });

    test("should not show inactive backdrop when disableInactivityCheck is true", async () => {
      // GIVEN a user with an active session
      const givenUserId = "fooUser";
      mockGetUser.mockReturnValue({
        id: givenUserId,
        name: "Foo User",
        email: "foo@bar.baz",
      });
      const givenSessionId = 123;
      mockGetActiveSessionId.mockReturnValue(givenSessionId);

      // AND a chat service with some messages
      const givenMessages: ConversationResponse = {
        messages: [
          {
            message_id: nanoid(),
            message: "Hello",
            sent_at: new Date().toISOString(),
            sender: ConversationMessageSender.USER,
          },
        ],
        conversation_completed: false,
        conversation_conducted_at: null,
        experiences_explored: 0,
      };
      jest.spyOn(ChatService.prototype, "getChatHistory").mockResolvedValue(givenMessages);


      // WHEN the component is mounted with disableInactivityCheck
      render(<Chat disableInactivityCheck={true} />);

      // AND time passes beyond the inactivity timeout
      act(() => {
        jest.spyOn(Date, "now").mockImplementation(() => INACTIVITY_TIMEOUT + 1);
        jest.advanceTimersByTime(CHECK_INACTIVITY_INTERVAL);
      });

      // THEN expect the backdrop to not be visible
      await waitFor(() => {
        expect(
          screen.queryByTestId(INACTIVE_BACKDROP_DATA_TEST_ID.INACTIVE_BACKDROP_CONTAINER)
        ).not.toBeInTheDocument();
      });
    });

    test.each([
      ["click", () => userEvent.click(screen.getByTestId(DATA_TEST_ID.CHAT_CONTAINER))],
      ["type(foo)", () => userEvent.type(screen.getByTestId(DATA_TEST_ID.CHAT_CONTAINER), "foo")],
      ["type(Space)", () => userEvent.type(screen.getByTestId(DATA_TEST_ID.CHAT_CONTAINER), " ")],
      ["type(enter)", () => userEvent.type(screen.getByTestId(DATA_TEST_ID.CHAT_CONTAINER), "\n")],
    ])("should hide backdrop on %s event", async (_, triggerEvent) => {
      // GIVEN a user with an active session
      const givenUserId = "fooUser";
      mockGetUser.mockReturnValue({
        id: givenUserId,
        name: "Foo User",
        email: "foo@bar.baz",
      });
      const givenSessionId = 123;
      mockGetActiveSessionId.mockReturnValue(givenSessionId);

      // AND a chat service with some messages
      const givenMessages: ConversationResponse = {
        messages: [
          {
            message_id: nanoid(),
            message: "Hello",
            sent_at: new Date().toISOString(),
            sender: ConversationMessageSender.USER,
          },
        ],
        conversation_completed: false,
        conversation_conducted_at: null,
        experiences_explored: 0,
      };
      jest.spyOn(ChatService.prototype, "getChatHistory").mockResolvedValue(givenMessages);

      // AND the component is mounted
      render(<Chat />);

      // AND the backdrop is visible
      act(() => {
        jest.spyOn(Date, "now").mockImplementation(() => INACTIVITY_TIMEOUT + 1);
        jest.advanceTimersByTime(CHECK_INACTIVITY_INTERVAL);
      });

      await waitFor(() => {
        expect(screen.getByTestId(INACTIVE_BACKDROP_DATA_TEST_ID.INACTIVE_BACKDROP_CONTAINER)).toBeInTheDocument();
      });

      // WHEN the user interacts
      act(() => {
        // Reset the mock time to simulate user interaction
        jest.spyOn(Date, "now").mockImplementation(() => 0);
        triggerEvent();
      });

      // THEN expect the backdrop to be hidden
      await waitFor(() => {
        expect(
          screen.queryByTestId(INACTIVE_BACKDROP_DATA_TEST_ID.INACTIVE_BACKDROP_CONTAINER)
        ).not.toBeInTheDocument();
      });
    });
  });
});
