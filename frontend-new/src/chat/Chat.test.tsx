// silence chatty console\
import "src/_test_utilities/consoleMock";
import { render, screen, waitFor, act } from "src/_test_utilities/test-utils";
import Chat, { CHECK_INACTIVITY_INTERVAL, DATA_TEST_ID, INACTIVITY_TIMEOUT, NOTIFICATION_MESSAGES_TEXT } from "src/chat/Chat";
import ChatHeader, { DATA_TEST_ID as CHAT_HEADER_TEST_ID } from "src/chat/ChatHeader/ChatHeader";
import ChatList, { DATA_TEST_ID as CHAT_LIST_TEST_ID } from "src/chat/chatList/ChatList";
import ChatMessageField, { DATA_TEST_ID as CHAT_MESSAGE_FIELD_TEST_ID } from "src/chat/ChatMessageField/ChatMessageField";
import ChatService from "./ChatService/ChatService";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { ConversationMessage, ConversationMessageSender, ConversationResponse } from "./ChatService/ChatService.types";
import AuthenticationStateService from "src/auth/services/AuthenticationState.service";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { ChatError } from "src/error/commonErrors";
import UserPreferencesService from "src/userPreferences/UserPreferencesService/userPreferences.service";
import ExperienceService from "src/experiences/experiencesDrawer/experienceService/experienceService";
import ExperiencesDrawer, { DATA_TEST_ID as EXPERIENCE_DRAWER_TEST_ID } from "src/experiences/experiencesDrawer/ExperiencesDrawer";
import { WorkType } from "src/experiences/experiencesDrawer/experienceService/experiences.types";
import { Language, SensitivePersonalDataRequirement, UserPreference } from "src/userPreferences/UserPreferencesService/userPreferences.types";
import ConfirmModalDialog, { DATA_TEST_ID as CONFIRM_MODAL_DIALOG_DATA_TEST_ID } from "src/theme/confirmModalDialog/ConfirmModalDialog";
import FeedbackForm, { DATA_TEST_ID as FEEDBACK_FORM_DATA_TEST_ID } from "src/feedback/overallFeedback/feedbackForm/FeedbackForm";
import { DATA_TEST_ID as INACTIVE_BACKDROP_DATA_TEST_ID } from "src/theme/Backdrop/InactiveBackdrop";
import userEvent, { UserEvent } from "@testing-library/user-event";
import { ChatMessageType, IChatMessage } from "./Chat.types";
import { FIXED_MESSAGES_TEXT } from "./util";
import { TabiyaUser } from "src/auth/auth.types";
import { resetAllMethodMocks } from "src/_test_utilities/resetAllMethodMocks";

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
  // ExperienceService methods to be mocked
  const mockGetExperiences = jest.fn();

  function assertResponseMessagesAreShown(givenConversationResponse: ConversationResponse, areLastMessages: boolean = true) {
    assertMessagesAreShown(givenConversationResponse.messages.map((message) => ({
        ...message,
        id: expect.any(String), // the id is not sent by the server, so its not part of the given messages
        type: ChatMessageType.BASIC_CHAT, // the message type is not part of the given messages we get from the backend
      })),
      areLastMessages,
    );
  }

  function assertMessagesAreShown(conversationMessages: IChatMessage[], areLastMessages: boolean = true) {
    // eslint-disable-next-line jest/valid-expect
    const fn = areLastMessages ? expect(ChatList as jest.Mock).toHaveBeenLastCalledWith : expect(ChatList as jest.Mock).toHaveBeenCalledWith;
    fn(
      expect.objectContaining({
        messages: expect.arrayContaining(
          conversationMessages,
        ),
      }),
      {},
    );
  }

  function assertTypingMessageWasShown(nthCall: number = -1) {
    // AND expect a typing indicator to have been shown
    const assertion = () => expect.objectContaining({
      messages: expect.arrayContaining([expect.objectContaining({ type: ChatMessageType.TYPING })]),
    });
    if (nthCall < 0) {
      expect(ChatList as jest.Mock).toHaveBeenCalledWith(
        assertion(),
        {},
      );
    } else {
      expect(ChatList as jest.Mock).toHaveBeenNthCalledWith(
        nthCall,
        assertion(),
        {});
    }
  }

  async function assertChatInitialized() {
    await waitFor(() => {
      // wait for the chat component to initialize and the dom to settle
      expect(screen.getByTestId(DATA_TEST_ID.CHAT_CONTAINER)).toHaveAttribute("is-initialized", "true");
    });
  }

  function getMockUser(): TabiyaUser {
    return {
      id: "fooUser",
      name: "Foo User",
      email: "foo@bar",
    };
  }

  function getMockUserPreferences(givenUser: TabiyaUser, givenSessionId: number | null): UserPreference {
    return {
      user_id: givenUser.id,
      accepted_tc: new Date(),
      has_sensitive_personal_data: false,
      language: Language.en,
      sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
      sessions: givenSessionId !== null ? [givenSessionId] : [],
      sessions_with_feedback: [],
    };
  }

  function getMockConversationResponse(messages: ConversationMessage[]): ConversationResponse {
    return {
      messages: messages,
      conversation_completed: false,
      conversation_conducted_at: null,
      experiences_explored: 0,
    };
  }

  beforeEach(() => {
    // Clear all mocks before each test, to ensure that calls are tracked correctly
    jest.clearAllMocks();
    // Reset the state of all singletons
    AuthenticationStateService.getInstance().setUser(null);
    UserPreferencesStateService.getInstance().clearUserPreferences();
    // Reset all method mocks on the singletons that may have been mocked
    // As a good practice, we should the mock*Once() methods to avoid side effects between tests
    // As a precaution, we reset all method mocks to ensure that no side effects are carried over between tests
    resetAllMethodMocks(ChatService.getInstance());
    resetAllMethodMocks(UserPreferencesService.getInstance());
    // Reset the mock implementation of the ExperienceService to avoid side effects between tests
    jest.spyOn(ExperienceService.prototype, "getExperiences").mockImplementation(mockGetExperiences);
  });

  describe("render tests", () => {
    test("should render the Chat component with all its children", async () => {
      // GIVEN a logged-in user
      const givenUser: TabiyaUser = getMockUser();
      AuthenticationStateService.getInstance().setUser(givenUser);
      // AND the user has an active session
      const givenActiveSessionId = 123;
      UserPreferencesStateService.getInstance().setUserPreferences(getMockUserPreferences(givenUser, givenActiveSessionId));
      // AND the conversation history has some messages
      const givenChatHistoryResponse: ConversationResponse = getMockConversationResponse([
        {
          message: "eb0f8640-9d51-4e9b-a5b8-cd660aa1b08b",
          sent_at: new Date().toISOString(),
          sender: ConversationMessageSender.USER,
        },
        {
          message: "f564df06-799f-4e20-9b54-369515c0c222",
          sent_at: new Date().toISOString(),
          sender: ConversationMessageSender.COMPASS,
        },
      ]);
      jest.spyOn(ChatService.getInstance(), "getChatHistory").mockResolvedValueOnce(givenChatHistoryResponse);
      // AND when a chat message is sent, it returns some message
      jest.spyOn(ChatService.getInstance(), "sendMessage").mockResolvedValueOnce(getMockConversationResponse([]));

      // WHEN the Chat component is rendered
      render(<Chat />);

      // THEN expect the Chat component to be initialized
      await assertChatInitialized();
      // AND expect the container to be visible
      expect(screen.getByTestId(DATA_TEST_ID.CHAT_CONTAINER)).toBeVisible();
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
      /// AND expect a snackbar notification was never shown
      expect(useSnackbar().enqueueSnackbar).not.toHaveBeenCalled();
      // AND expect input field to have been enabled
      expect(ChatMessageField as jest.Mock).toHaveBeenLastCalledWith(expect.objectContaining({ isChatFinished: false, aiIsTyping: false }), {});
    });
  });

  describe("chat initialization", () => {
    describe("should initialize chat for a user with an active session", () => {
      test("should initialize chat and fetch history on mount when the user has an existing conversation", async () => {
        // GIVEN a logged-in user
        const givenUser: TabiyaUser = getMockUser();
        AuthenticationStateService.getInstance().setUser(givenUser);
        // AND the user has an active session
        const givenActiveSessionId = 123;
        UserPreferencesStateService.getInstance().setUserPreferences(getMockUserPreferences(givenUser, givenActiveSessionId));
        // AND the conversation history has some messages
        const givenChatHistoryResponse: ConversationResponse = getMockConversationResponse([
          {
            message: "bcf81460-54de-484a-822f-a96b27378224",
            sent_at: new Date().toISOString(),
            sender: ConversationMessageSender.USER,
          },
          {
            message: "52aea18a-4a0f-44ad-b690-e99ff8e4ddc7",
            sent_at: new Date().toISOString(),
            sender: ConversationMessageSender.COMPASS,
          },
        ]);
        jest.spyOn(ChatService.getInstance(), "getChatHistory").mockResolvedValueOnce(givenChatHistoryResponse);
        // AND when a chat message is sent, it returns some message
        jest.spyOn(ChatService.getInstance(), "sendMessage").mockResolvedValueOnce(getMockConversationResponse([]));

        // WHEN the component is rendered
        render(<Chat />);

        // THEN expect the Chat component to be initialized
        await assertChatInitialized();

        // AND expect chat history was fetched with the active session ID
        expect(ChatService.getInstance().getChatHistory).toHaveBeenCalledWith(givenActiveSessionId);
        // AND the chat list to be called with a message that says that compass is typing
        assertTypingMessageWasShown();
        // AND no message to be sent to the chat service
        expect(ChatService.getInstance().sendMessage).not.toHaveBeenCalled();
        // AND expect the given history to be currently shown in ChatList
        assertResponseMessagesAreShown(givenChatHistoryResponse, true);
        // AND expect a snackbar notification was never shown
        expect(useSnackbar().enqueueSnackbar).not.toHaveBeenCalled();
        // AND expect input field to have been enabled
        expect(ChatMessageField as jest.Mock).toHaveBeenLastCalledWith(expect.objectContaining({ isChatFinished: false, aiIsTyping: false }), {});
        // AND expect no errors or warning to have occurred
        expect(console.error).not.toHaveBeenCalled();
        expect(console.warn).not.toHaveBeenCalled();
      });

      describe("should initialize chat and fetch history on mount and send an empty message when the user has no existing conversation", () => {
        test("should initialize chat and fetch history on mount and send an empty message when the user has no existing conversation", async () => {
          // GIVEN a logged-in user
          const givenUser: TabiyaUser = getMockUser();
          AuthenticationStateService.getInstance().setUser(givenUser);
          // AND the user has an active session
          const givenActiveSessionId = 123;
          UserPreferencesStateService.getInstance().setUserPreferences(getMockUserPreferences(givenUser, givenActiveSessionId));
          // AND the conversation history has some messages
          const givenChatHistoryResponse: ConversationResponse = getMockConversationResponse([]);
          jest.spyOn(ChatService.getInstance(), "getChatHistory").mockResolvedValueOnce(givenChatHistoryResponse);
          // AND when a chat message is sent, it returns a message
          const givenSendMessageResponse: ConversationResponse = getMockConversationResponse([
            {
              message: "004448d3-f97a-484e-94a4-03951ba8b36f", // A RESPONSE FROM THE AI
              sent_at: new Date().toISOString(),
              sender: ConversationMessageSender.COMPASS,
            },
          ]);
          jest.spyOn(ChatService.getInstance(), "sendMessage").mockResolvedValue(givenSendMessageResponse);

          // WHEN the component is mounted
          render(<Chat />);

          // THEN expect the Chat component to be initialized
          await assertChatInitialized();
          // AND expect chat history to be fetched with active session ID
          expect(ChatService.getInstance().getChatHistory).toHaveBeenCalledWith(givenActiveSessionId);
          // AND expect a typing indicator to have been shown
          assertTypingMessageWasShown();
          // AND expect an empty message to be sent to the chat service
          expect(ChatService.getInstance().sendMessage).toHaveBeenCalledWith(givenActiveSessionId, "");
          await expect((ChatService.getInstance().sendMessage as jest.Mock).mock.results[0].value).resolves.toBe(givenSendMessageResponse);
          // THEN expect the chat list to be updated with the response from the chat service
          assertResponseMessagesAreShown(givenSendMessageResponse, true);
          // AND expect a snackbar notification was never shown
          expect(useSnackbar().enqueueSnackbar).not.toHaveBeenCalled();
          // AND expect input field to have been enabled
          expect(ChatMessageField as jest.Mock).toHaveBeenLastCalledWith(expect.objectContaining({ isChatFinished: false, aiIsTyping: false }), {});
          // AND expect no errors or warning to have occurred
          expect(console.error).not.toHaveBeenCalled();
          expect(console.warn).not.toHaveBeenCalled();
        });

        test("should throw an error if sending an empty message fails", async () => {
          // GIVEN a logged-in user
          const givenUser: TabiyaUser = getMockUser();
          AuthenticationStateService.getInstance().setUser(givenUser);
          // AND the user has an active session
          const givenActiveSessionId = 123;
          UserPreferencesStateService.getInstance().setUserPreferences(getMockUserPreferences(givenUser, givenActiveSessionId));
          // AND the conversation history is empty
          const givenChatHistoryResponse: ConversationResponse = getMockConversationResponse([]);
          jest.spyOn(ChatService.getInstance(), "getChatHistory").mockResolvedValueOnce(givenChatHistoryResponse);
          // AND an error is thrown when sending a message
          const givenError = new Error("Failed to send message");
          jest.spyOn(ChatService.getInstance(), "sendMessage").mockRejectedValueOnce(givenError);

          // WHEN the component is mounted
          render(<Chat />);

          // THEN expect the Chat component to be initialized
          await assertChatInitialized();
          // AND expect a typing indicator to be shown
          assertTypingMessageWasShown();
          // AND expect an empty message to be sent to the chat service
          expect(ChatService.getInstance().sendMessage).toHaveBeenCalledWith(givenActiveSessionId, "");
          // AND an error message to be shown in the chat list
          expect(ChatList as jest.Mock).toHaveBeenLastCalledWith(
            expect.objectContaining({
              messages: [
                {
                  id: expect.any(String),
                  message: FIXED_MESSAGES_TEXT.PLEASE_REPEAT,
                  sent_at: expect.any(String),
                  sender: ConversationMessageSender.COMPASS,
                  type: ChatMessageType.BASIC_CHAT,
                },
              ],
            }),
            {},
          );
          // AND expect that a snackbar notification is not shown
          expect(useSnackbar().enqueueSnackbar).not.toHaveBeenCalled();
          // AND expect input field to have be enabled
          expect(ChatMessageField as jest.Mock).toHaveBeenLastCalledWith(expect.objectContaining({ isChatFinished: false, aiIsTyping: false }), {});
          // AND expect an error to have been logged
          expect(console.error).toHaveBeenCalledTimes(1);
          expect(console.error).toHaveBeenCalledWith(new ChatError("Failed to send message:", givenError));
        });
      });

      test("should show error if fetching history fails", async () => {
        // GIVEN a logged-in user
        const givenUser: TabiyaUser = getMockUser();
        AuthenticationStateService.getInstance().setUser(givenUser);
        // AND the user has an active session
        const givenActiveSessionId = 123;
        UserPreferencesStateService.getInstance().setUserPreferences(getMockUserPreferences(givenUser, givenActiveSessionId));
        // AND a chat service that fails to get chat history
        const givenError = new Error("Chat service failed to get history");
        jest.spyOn(ChatService.getInstance(), "getChatHistory").mockRejectedValueOnce(givenError);


        // WHEN the component is mounted
        render(<Chat />);

        // THEN expect the Chat component to be initialized
        await assertChatInitialized();
        // AND expect a typing indicator to have been shown
        await waitFor(() => {
          assertTypingMessageWasShown();
        });
        // AND expect a snackbar notification was shown once
        expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledTimes(1);
        // AND expect a snackbar notification to be an error
        await waitFor(() => {
          expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith(
            NOTIFICATION_MESSAGES_TEXT.FAILED_TO_START_CONVERSATION,
            { variant: "error" },
          );
        });
        // AND expect the chat to show a message that something went wrong
        assertMessagesAreShown([
            {
              id: expect.any(String),
              type: ChatMessageType.BASIC_CHAT,
              message: FIXED_MESSAGES_TEXT.SOMETHING_WENT_WRONG,
              sent_at: expect.any(String),
              sender: ConversationMessageSender.COMPASS,
            },
          ], true,
        );

        // AND expect input field to have be disabled because the chat is finished
        expect(ChatMessageField as jest.Mock).toHaveBeenLastCalledWith(expect.objectContaining({ isChatFinished: true }), {});
        // AND expect an error to have been logged
        expect(console.error).toHaveBeenCalledTimes(1);
        expect(console.error).toHaveBeenCalledWith(new ChatError("Failed to initialize chat", givenError));
      });
    });

    describe("should initialize chat for a user that does not have an active session", () => {
      test("should create a new chat session if the active session is not found", async () => {
        // GIVEN a logged-in user
        const givenUser: TabiyaUser = getMockUser();
        AuthenticationStateService.getInstance().setUser(givenUser);
        // AND the user has no active session
        const givenActiveSessionId = null;
        UserPreferencesStateService.getInstance().setUserPreferences(getMockUserPreferences(givenUser, givenActiveSessionId));
        // AND the user preferences service returns a new session id
        const givenNewSessionId = 123;
        const givenUserPreferences: UserPreference = {
          user_id: givenUser.id,
          accepted_tc: new Date(),
          has_sensitive_personal_data: false,
          language: Language.en,
          sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
          sessions: [givenNewSessionId],
          sessions_with_feedback: [],
        };
        jest.spyOn(UserPreferencesService.getInstance(), "getNewSession").mockResolvedValueOnce(givenUserPreferences);
        // AND the conversation history is empty
        const givenChatHistoryResponse: ConversationResponse = getMockConversationResponse([]);
        jest.spyOn(ChatService.getInstance(), "getChatHistory").mockResolvedValueOnce(givenChatHistoryResponse);
        // AND when a chat message is sent, it returns a message
        const givenSendMessageResponse: ConversationResponse = getMockConversationResponse([
          {
            message: "c9afe141-3655-48d1-b558-cf69123ab803", // A RESPONSE FROM THE AI
            sent_at: new Date().toISOString(),
            sender: ConversationMessageSender.COMPASS,
          },
        ]);
        jest.spyOn(ChatService.getInstance(), "sendMessage").mockResolvedValueOnce(givenSendMessageResponse);

        // WHEN the component is mounted
        render(<Chat />);

        // THEN expect the Chat component to be initialized
        await assertChatInitialized();
        // AND the getNewSession method to be called
        expect(UserPreferencesService.getInstance().getNewSession).toHaveBeenCalled();
        // AND the UserPreferencesStateService to have been updated with the new session id
        expect(UserPreferencesStateService.getInstance().getUserPreferences()).toEqual(givenUserPreferences);
        // AND a typing indicator to be shown
        assertTypingMessageWasShown();
        // AND expect the chat history to be fetched for the new session
        expect(ChatService.getInstance().getChatHistory).toHaveBeenCalledWith(givenNewSessionId);
        // AND expect the chat list to be updated with the new (empty) messages list
        expect(ChatList as jest.Mock).toHaveBeenNthCalledWith(1, expect.objectContaining({ messages: [] }), {});
        // AND expect an empty message to be sent to the chat service for the new session
        expect(ChatService.getInstance().sendMessage).toHaveBeenCalledWith(givenNewSessionId, "");
        // AND expect no errors or warning to have occurred
        expect(console.error).not.toHaveBeenCalled();
        expect(console.warn).not.toHaveBeenCalled();
      });

      test("should show error if creating a new session fails", async () => {
        // GIVEN a logged-in user
        const givenUser: TabiyaUser = getMockUser();
        AuthenticationStateService.getInstance().setUser(givenUser);

        // AND the user has no active session
        const givenActiveSessionId = null;
        UserPreferencesStateService.getInstance().setUserPreferences(getMockUserPreferences(givenUser, givenActiveSessionId));

        // AND a user preferences service that fails to create a new session
        const givenError = new Error("Failed to create new session");
        jest.spyOn(UserPreferencesService.getInstance(), "getNewSession").mockRejectedValueOnce(givenError);


        // WHEN the component is mounted
        render(<Chat />);

        // THEN expect the Chat component to be initialized
        await assertChatInitialized();
        // AND  expect a typing indicator to be shown
        assertTypingMessageWasShown();
        // AND expect the getNewSession method to be called
        expect(UserPreferencesService.getInstance().getNewSession).toHaveBeenCalled();
        // AND expect a snackbar notification to be shown
        expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith("Failed to start new conversation", {
          variant: "error",
        });
        // AND expect the chat to show a message that something went wrong
        assertMessagesAreShown([
            {
              id: expect.any(String),
              type: ChatMessageType.BASIC_CHAT,
              message: FIXED_MESSAGES_TEXT.SOMETHING_WENT_WRONG,
              sent_at: expect.any(String),
              sender: ConversationMessageSender.COMPASS,
            },
          ], true,
        );
        // AND expect input field to have be disabled because the conversation is finished
        expect(ChatMessageField as jest.Mock).toHaveBeenLastCalledWith(expect.objectContaining({ isChatFinished: true }), {});
        // AND expect an error to have been logged
        expect(console.error).toHaveBeenCalledTimes(1);
        expect(console.error).toHaveBeenCalledWith(new ChatError("Failed to create new session", givenError));
      });

      test("should show error if fetching history fails", async () => {
        // GIVEN a logged-in user
        const givenUser: TabiyaUser = getMockUser();
        AuthenticationStateService.getInstance().setUser(givenUser);

        // AND the user has no active session
        const givenActiveSessionId = null;
        UserPreferencesStateService.getInstance().setUserPreferences(getMockUserPreferences(givenUser, givenActiveSessionId));

        // AND the user preferences service will create a new session with the given id
        const givenNewSessionId = 123;
        const givenUserPreferences: UserPreference = {
          user_id: givenUser.id,
          accepted_tc: new Date(),
          has_sensitive_personal_data: false,
          sessions: [givenNewSessionId],
          sessions_with_feedback: [],
          sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
          language: Language.en,
        };
        jest.spyOn(UserPreferencesService.getInstance(), "getNewSession").mockResolvedValueOnce(givenUserPreferences);


        // AND a chat service that fails to get chat history
        const givenError = new Error("Failed to get chat history");
        jest.spyOn(ChatService.getInstance(), "getChatHistory").mockRejectedValueOnce(givenError);

        // WHEN the component is mounted
        render(<Chat />);

        // THEN expect the Chat component to be initialized
        await assertChatInitialized();
        // AND expect a typing indicator to be shown
        assertTypingMessageWasShown();
        // AND expect the getNewSession method to be called
        expect(UserPreferencesService.getInstance().getNewSession).toHaveBeenCalled();
        // AND expect an error message to be shown in the chat
        assertMessagesAreShown([
            {
              id: expect.any(String),
              type: ChatMessageType.BASIC_CHAT,
              message: FIXED_MESSAGES_TEXT.SOMETHING_WENT_WRONG,
              sent_at: expect.any(String),
              sender: ConversationMessageSender.COMPASS,
            },
          ], true,
        );

        // AND expect input field to have be disabled because the conversation is finished
        expect(ChatMessageField as jest.Mock).toHaveBeenLastCalledWith(expect.objectContaining({ isChatFinished: true }), {});
        // AND expect an error to have been logged
        expect(console.error).toHaveBeenCalledTimes(1);
        expect(console.error).toHaveBeenCalledWith(new ChatError("Failed to initialize chat", givenError));
      });

      test("should show error if sending message fails", async () => {
        // GIVEN a logged-in user
        const givenUser: TabiyaUser = getMockUser();
        AuthenticationStateService.getInstance().setUser(givenUser);

        // AND the user has no active session
        const givenActiveSessionId = null;
        UserPreferencesStateService.getInstance().setUserPreferences(getMockUserPreferences(givenUser, givenActiveSessionId));

        // AND the preferences service will creates a new session and returns the id
        const givenNewSessionId = 123;
        const givenUserPreferences: UserPreference = {
          user_id: givenUser.id,
          language: Language.en,
          accepted_tc: new Date(),
          has_sensitive_personal_data: false,
          sessions: [givenNewSessionId],
          sessions_with_feedback: [],
          sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
        };
        jest.spyOn(UserPreferencesService.getInstance(), "getNewSession").mockResolvedValueOnce(givenUserPreferences);

        // AND the chat history is empty
        const givenChatHistoryResponse: ConversationResponse = getMockConversationResponse([]);
        jest.spyOn(ChatService.getInstance(), "getChatHistory").mockResolvedValueOnce(givenChatHistoryResponse);

        // AND the sending a message fails
        const givenError = new Error("Failed to send message");
        jest.spyOn(ChatService.getInstance(), "sendMessage").mockRejectedValueOnce(givenError);

        // WHEN the component is mounted
        render(<Chat />);

        // THEN expect the Chat component to be initialized
        await assertChatInitialized();
        // AND expect a typing indicator to be shown
        assertTypingMessageWasShown();
        // AND expect the getNewSession method to be called
        expect(UserPreferencesService.getInstance().getNewSession).toHaveBeenCalled();
        // AND expect a message to be shown in the chat
        assertMessagesAreShown([
            {
              id: expect.any(String),
              type: ChatMessageType.BASIC_CHAT,
              message: FIXED_MESSAGES_TEXT.PLEASE_REPEAT,
              sent_at: expect.any(String),
              sender: ConversationMessageSender.COMPASS,
            },
          ], true,
        );
        // AND expect input field to have be enabled
        expect(ChatMessageField as jest.Mock).toHaveBeenLastCalledWith(expect.objectContaining({ isChatFinished: false, aiIsTyping: false }), {});
        // AND expect an error to have been logged
        expect(console.error).toHaveBeenCalledTimes(1);
        expect(console.error).toHaveBeenCalledWith(new ChatError("Failed to send message:", givenError));
      });
    });
  });

  describe("sending a message", () => {
    test("should send a message successfully", async () => {
      // GIVEN a user is logged in
      const givenUser: TabiyaUser = getMockUser();
      AuthenticationStateService.getInstance().setUser(givenUser);
      // AND the user has an active session
      const givenActiveSessionId = 123;
      UserPreferencesStateService.getInstance().setUserPreferences(getMockUserPreferences(givenUser, givenActiveSessionId));
      // AND the conversation history has some messages
      const givenPreviousConversation: ConversationResponse = getMockConversationResponse([
        {
          message: "13a7d8b3-dcb8-4e5c-b377-97160eb2b814",
          sent_at: new Date().toISOString(),
          sender: ConversationMessageSender.COMPASS,
        },
        {
          message: "d27b6bf0-f060-4825-aeab-0f1b3d8e274d",
          sent_at: new Date().toISOString(),
          sender: ConversationMessageSender.COMPASS,
        },
        {
          message: "2c69dca6-fc07-4cdb-942c-0021c86ebe94",
          sent_at: new Date().toISOString(),
          sender: ConversationMessageSender.USER,
        },
        {
          message: "1c322d44-a232-494b-95be-af475abe36a8",
          sent_at: new Date().toISOString(),
          sender: ConversationMessageSender.COMPASS,
        },
      ]);
      jest.spyOn(ChatService.getInstance(), "getChatHistory").mockResolvedValueOnce(givenPreviousConversation);
      // AND a chat service that can sends a message successfully
      const givenSendMessageResponse: ConversationResponse = {
        messages: [
          {
            message: "008f1449-4d70-4cc0-a876-553c11caad18",
            sent_at: new Date().toISOString(),
            sender: ConversationMessageSender.COMPASS,
          },
          {
            message: "51602db3-cf7f-490e-9ca8-4fae4427de30",
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
      jest.spyOn(ChatService.getInstance(), "sendMessage").mockResolvedValueOnce(sendMessagePromise);

      // WHEN the component is mounted
      render(<Chat />);

      // THEN expect the Chat component to be initialized
      await assertChatInitialized();
      // AND the conversation history to be shown in the chat
      assertResponseMessagesAreShown(givenPreviousConversation, true);

      // AND WHEN the user types a message
      const givenMessage = "I loved the smell of the bread and the taste of the cake.";
      act(() => {
        (ChatMessageField as jest.Mock).mock.calls.at(-1)[0].notifyChange(givenMessage);
      });
      // AND the user sends the message
      act(() => {
        (ChatMessageField as jest.Mock).mock.calls.at(-1)[0].handleSend();
      });

      // THEN expect the send message method to be called with the user's message
      expect(ChatService.getInstance().sendMessage).toHaveBeenCalledWith(givenActiveSessionId, givenMessage);
      // AND expect the user's message and a typing indicator to be shown in the chat
      await waitFor(() => {
        assertMessagesAreShown([
          ...givenPreviousConversation.messages.map((message) => (
            {
              ...message,
              id: expect.any(String),
              type: ChatMessageType.BASIC_CHAT,
            })),
          {
            id: expect.any(String),
            message: givenMessage,
            sent_at: expect.any(String),
            sender: ConversationMessageSender.USER,
            type: ChatMessageType.BASIC_CHAT,
          },
          {
            id: expect.any(String),
            message: FIXED_MESSAGES_TEXT.AI_IS_TYPING,
            sent_at: expect.any(String),
            sender: ConversationMessageSender.COMPASS,
            type: ChatMessageType.TYPING,
          },
        ], true);
      });
      // AND the input field to be disabled
      expect(ChatMessageField as jest.Mock).toHaveBeenLastCalledWith(expect.objectContaining({ isChatFinished: false, aiIsTyping: true }), {});

      // AND WHEN the send message promise resolves
      act(() => {
        resolveSendMessage(givenSendMessageResponse);
      });

      // THEN expect the previous conversation and the response from the chat service to be shown in the chat
      await waitFor(() => {
        assertMessagesAreShown([
          ...givenPreviousConversation.messages.map((message) => (
            {
              ...message,
              id: expect.any(String),
              type: ChatMessageType.BASIC_CHAT,
            })),
          {
            id: expect.any(String),
            message: givenMessage,
            sent_at: expect.any(String),
            sender: ConversationMessageSender.USER,
            type: ChatMessageType.BASIC_CHAT,
          },
          ...givenSendMessageResponse.messages.map((message) => (
            {
              ...message,
              id: expect.any(String),
              type: ChatMessageType.BASIC_CHAT,
            })),
        ], true);
      });

      // AND expect that no errors or warnings were logged
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
      // AND no snackbar notification was shown
      expect(useSnackbar().enqueueSnackbar).not.toHaveBeenCalled();
      // AND expect that the chat input is cleared and enabled
      await waitFor(() => {
        expect(ChatMessageField as jest.Mock).toHaveBeenLastCalledWith(expect.objectContaining({
          message: "",
          isChatFinished: false,
          aiIsTyping: false,
        }), {});
      });
    });

    test("should handle send message error", async () => {
      // GIVEN a user is logged in
      const givenUser: TabiyaUser = getMockUser();
      AuthenticationStateService.getInstance().setUser(givenUser);
      // AND the user has an active session
      const givenActiveSessionId = 123;
      UserPreferencesStateService.getInstance().setUserPreferences(getMockUserPreferences(givenUser, givenActiveSessionId));
      // AND the conversation history has some messages
      const givenPreviousConversation: ConversationResponse = getMockConversationResponse([
        {
          message: "e8a727c6-1b49-4800-9925-03ee31f0a7b9",
          sent_at: new Date().toISOString(),
          sender: ConversationMessageSender.COMPASS,
        },
        {
          message: "91ca9c85-d27a-4987-b410-d687d13cbba6",
          sent_at: new Date().toISOString(),
          sender: ConversationMessageSender.COMPASS,
        },
        {
          message: "08731b79-2816-4d9d-9248-89fa6818634c",
          sent_at: new Date().toISOString(),
          sender: ConversationMessageSender.USER,
        },
        {
          message: "b7a59799-16c3-4bc0-bac4-8e8764053fb8",
          sent_at: new Date().toISOString(),
          sender: ConversationMessageSender.COMPASS,
        },
      ]);
      jest.spyOn(ChatService.getInstance(), "getChatHistory").mockResolvedValueOnce(givenPreviousConversation);

      // AND sending a message will fail
      const givenError = new Error("Failed to send message");
      jest.spyOn(ChatService.getInstance(), "sendMessage").mockRejectedValueOnce(givenError);

      // WHEN the component is mounted
      render(<Chat />);

      // THEN expect the Chat component to be initialized
      await assertChatInitialized();
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
      expect(ChatService.getInstance().sendMessage).toHaveBeenCalledTimes(1);
      expect(ChatService.getInstance().sendMessage).toHaveBeenLastCalledWith(givenActiveSessionId, givenMessage);
      // AND expect an error to have been logged
      await waitFor(() => {
        expect(console.error).toHaveBeenCalledWith(new ChatError("Failed to send message:", givenError));
      });
      // AND expect an error message to be the last shown in the chat
      await waitFor(() => {
        assertMessagesAreShown([
          ...givenPreviousConversation.messages.map((message) => ({
            ...message,
            sent_at: expect.any(String),
            id: expect.any(String),
            type: ChatMessageType.BASIC_CHAT,
          })),
          {
            id: expect.any(String),
            type: ChatMessageType.BASIC_CHAT,
            message: FIXED_MESSAGES_TEXT.PLEASE_REPEAT,
            sent_at: expect.any(String),
            sender: ConversationMessageSender.COMPASS,
          },
        ], true);
      });

      // AND expect no snackbar notification was shown
      expect(useSnackbar().enqueueSnackbar).not.toHaveBeenCalled();
      // AND expect the input field to be enabled
      expect(ChatMessageField as jest.Mock).toHaveBeenLastCalledWith(expect.objectContaining({ isChatFinished: false, aiIsTyping: false }), {});
      // AND expect an error to have been logged
      expect(console.error).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledWith(new ChatError("Failed to send message:", givenError));
    });
  });

  describe("opening experience drawer and fetching experiences", () => {
    test("should open drawer and fetch experiences", async () => {
      // GIVEN a user is logged in
      const givenUser: TabiyaUser = getMockUser();
      AuthenticationStateService.getInstance().setUser(givenUser);
      // AND the user has an active session
      const givenActiveSessionId = 123;
      UserPreferencesStateService.getInstance().setUserPreferences(getMockUserPreferences(givenUser, givenActiveSessionId));
      // AND the conversation history has some messages
      const givenPreviousConversation: ConversationResponse = getMockConversationResponse([
        {
          message: "90dac7d1-d396-4516-9078-00032539d8dc",
          sent_at: new Date().toISOString(),
          sender: ConversationMessageSender.COMPASS,
        },
      ]);
      jest.spyOn(ChatService.getInstance(), "getChatHistory").mockResolvedValueOnce(givenPreviousConversation);
      // AND the user has some experiences
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
      mockGetExperiences.mockResolvedValueOnce(givenExperiences);

      // WHEN the component is rendered
      render(<Chat />);
      // THEN expect the Chat component to be initialized
      await assertChatInitialized();

      // AND the experiences button is clicked
      // we are using the last call to the ChatHeader mock because the first one is the initial call
      // and a bunch of calls are made when the component is re-rendered,
      // for example, due to the chat initialization
      act(() => {
        (ChatHeader as jest.Mock).mock.calls.at(-1)[0].notifyOnExperiencesDrawerOpen();
      });

      // THEN expect the drawer to open
      await waitFor(() => {
        expect(screen.getByTestId(EXPERIENCE_DRAWER_TEST_ID.EXPERIENCES_DRAWER_CONTAINER)).toBeInTheDocument();
      });

      // AND expect experiences to be fetched for the active session
      expect(ExperienceService.prototype.getExperiences).toHaveBeenCalledWith(givenActiveSessionId);

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
          {},
        );
      });
      // AND no errors or warnings were logged
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should handle experience fetch error", async () => {
      // GIVEN a user is logged in
      const givenUser: TabiyaUser = getMockUser();
      AuthenticationStateService.getInstance().setUser(givenUser);
      // AND the user has an active session
      const givenActiveSessionId = 123;
      UserPreferencesStateService.getInstance().setUserPreferences(getMockUserPreferences(givenUser, givenActiveSessionId));
      // AND the conversation history has some messages
      const givenPreviousConversation: ConversationResponse = {
        messages: [
          {
            message: "fad1a46e-1be8-43e8-a1d4-461a99322014",
            sent_at: new Date().toISOString(),
            sender: ConversationMessageSender.COMPASS,
          },
        ],
        conversation_completed: false,
        conversation_conducted_at: null,
        experiences_explored: 0,
      };
      jest.spyOn(ChatService.getInstance(), "getChatHistory").mockResolvedValueOnce(givenPreviousConversation);
      // AND fetching experiences will fail
      const givenError = new Error("Foo");
      mockGetExperiences.mockRejectedValueOnce(givenError);

      // WHEN the component is mounted
      render(<Chat />);

      // THEN expect the Chat component to be initialized
      await assertChatInitialized();

      // AND the experiences button is clicked
      // we are using the last call to the ChatHeader mock because the first one is the initial call
      // and a bunch of calls are made when the component is re-rendered,
      // for example, due to the chat initialization
      act(() => {
        (ChatHeader as jest.Mock).mock.calls.at(-1)[0].notifyOnExperiencesDrawerOpen();
      });
      // THEN expect error notification
      await waitFor(() => {
        expect(console.error).toHaveBeenCalledWith(new ChatError("Failed to retrieve experiences", givenError));
      });
      expect(console.error).toHaveBeenCalledTimes(1);
      // AND expect a snackbar notification
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith("Failed to retrieve experiences", {
        variant: "error",
      });
    });
  });

  describe("starting a new conversation", () => {
    test("should start a new conversation", async () => {
      // GIVEN a user is logged in
      const givenUser: TabiyaUser = getMockUser();
      AuthenticationStateService.getInstance().setUser(givenUser);
      // AND the user has an active session
      const givenActiveSessionId = 1000;
      UserPreferencesStateService.getInstance().setUserPreferences(getMockUserPreferences(givenUser, givenActiveSessionId));
      // AND the user preferences service will return a new session id
      const givenNewSessionId = 2000;
      const givenUserPreferences: UserPreference = {
        user_id: givenUser.id,
        accepted_tc: new Date(),
        has_sensitive_personal_data: false,
        language: Language.en,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
        sessions: [givenNewSessionId, givenActiveSessionId],
        sessions_with_feedback: [],
      };
      jest.spyOn(UserPreferencesService.getInstance(), "getNewSession").mockResolvedValueOnce(givenUserPreferences);

      // AND the conversation history has some messages for the current session, but is empty for the new session
      const givenInitialSessionChatHistoryResponse: ConversationResponse = getMockConversationResponse([
        {
          message: "1584e645-e367-490d-bc5c-c14f41bc0e80",
          sent_at: new Date().toISOString(),
          sender: ConversationMessageSender.COMPASS,
        },
        {
          message: "904a1ceb-2bf0-478a-b28f-fa73c86efdb6",
          sent_at: new Date().toISOString(),
          sender: ConversationMessageSender.USER,
        },
      ]);
      const givenNewSessionChatHistoryResponse: ConversationResponse = getMockConversationResponse([]);
      const mockGetChatHistoryFn = (sessionId: number) => {
        if (sessionId === givenNewSessionId) {
          return Promise.resolve(givenNewSessionChatHistoryResponse);
        } else if (sessionId === givenActiveSessionId) {
          return Promise.resolve(givenInitialSessionChatHistoryResponse);
        }
        throw new Error("Invalid session id");
      };
      jest.spyOn(ChatService.getInstance(), "getChatHistory").mockImplementationOnce(mockGetChatHistoryFn);
      // AND the chat service will return a message when a message is sent
      const givenSendMessageResponse: ConversationResponse = getMockConversationResponse([
        {
          message: "69eb00eb-4d55-44b2-bd47-0245df0ca9cc",
          sent_at: new Date().toISOString(),
          sender: ConversationMessageSender.COMPASS,
        },
      ]);
      jest.spyOn(ChatService.getInstance(), "sendMessage").mockResolvedValueOnce(givenSendMessageResponse);

      // AND the component is mounted
      render(<Chat />);

      // THEN expect the Chat component to be initialized
      await assertChatInitialized();
      // AND the chat history to be shown
      assertResponseMessagesAreShown(givenInitialSessionChatHistoryResponse, true);
      // WHEN new conversation clicked
      // we are using the last call to the ChatHeader mock because the first one is the initial call
      // and a bunch of calls are made when the component is re-rendered,
      // for example, due to the chat initialization
      act(() => {
        (ChatHeader as jest.Mock).mock.calls.at(-1)[0].startNewConversation();
      });

      // THEN expect confirmation dialog to be shown
      await waitFor(() => {
        expect(screen.getByTestId(CONFIRM_MODAL_DIALOG_DATA_TEST_ID.CONFIRM_MODAL)).toBeInTheDocument();
      });
      // AND the new session has not been fetched yet
      expect(UserPreferencesService.getInstance().getNewSession).not.toHaveBeenCalled();
      // BEFORE the user confirms
      // Mock the getChatHistory method a second time for the new session
      jest.spyOn(ChatService.getInstance(), "getChatHistory").mockImplementationOnce(mockGetChatHistoryFn);

      // WHEN the user confirms
      // we are using the last call to the ConfirmModalDialog mock because the first one is the initial call
      // and a bunch of calls are made when the component is re-rendered,
      // for example, due to the chat initialization
      act(() => {
        (ConfirmModalDialog as jest.Mock).mock.calls.at(-1)[0].onConfirm();
      });
      // THEN expect the new session to be fetched for the given user
      await waitFor(() => {
        expect(UserPreferencesService.getInstance().getNewSession).toHaveBeenCalledTimes(1);
      });
      expect(UserPreferencesService.getInstance().getNewSession).toHaveBeenCalledWith(givenUser.id);
      // AND expect the chat to be reset and only show the typing indicator
      const callsToChatlist = (ChatList as jest.Mock).mock.calls.length;
      assertTypingMessageWasShown(callsToChatlist);
      // AND the input field to be disabled because the ai is typing
      expect(ChatMessageField as jest.Mock).toHaveBeenLastCalledWith(expect.objectContaining({ isChatFinished: false, aiIsTyping: true }), {});

      // AND expect the chat history to be fetched for the new session
      await waitFor(() => {
        expect(ChatService.getInstance().getChatHistory).toHaveBeenCalledWith(givenNewSessionId);
      });
      // AND expect an empty message to be sent to the chat service for the new session
      await waitFor(() => {
        expect(ChatService.getInstance().sendMessage).toHaveBeenCalledWith(givenNewSessionId, "");
      });
      // AND expect the chat list to be updated with the response from the chat service
      await waitFor(() => {
        assertResponseMessagesAreShown(givenSendMessageResponse);
      });

      // AND expect a snackbar notification was shown once
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledTimes(1);
      // AND expect the snackbar notification to a success message
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith("New conversation started", { variant: "success" });

      // AND expect input field to have be enabled because the conversation is not finished
      expect(ChatMessageField as jest.Mock).toHaveBeenLastCalledWith(expect.objectContaining({ isChatFinished: false, aiIsTyping: false }), {});
    });

    test("should handle new conversation cancellation", async () => {
      // GIVEN a user is logged in
      const givenUser: TabiyaUser = getMockUser();
      AuthenticationStateService.getInstance().setUser(givenUser);
      // AND the user has an active session
      const givenActiveSessionId = 123;
      UserPreferencesStateService.getInstance().setUserPreferences(getMockUserPreferences(givenUser, givenActiveSessionId));
      // AND a chat service that returns an existing conversation
      const givenPreviousConversation = getMockConversationResponse([
        {
          message: "7f3f43fd-a203-4b4a-9f6a-da6dfb301558",
          sent_at: new Date().toISOString(),
          sender: ConversationMessageSender.COMPASS,
        },
      ]);
      jest.spyOn(ChatService.getInstance(), "getChatHistory").mockResolvedValueOnce(givenPreviousConversation);

      // AND the component is mounted
      render(<Chat />);

      // WHEN new conversation clicked
      // we are using the last call to the ChatHeader mock because the first one is the initial call
      // and a bunch of calls are made when the component is re-rendered,
      // for example, due to the chat initialization
      act(() => {
        (ChatHeader as jest.Mock).mock.calls.at(-1)[0].startNewConversation();
      });
      // THEN expect confirmation dialog to be shown
      await waitFor(() => {
        expect(screen.getByTestId(CONFIRM_MODAL_DIALOG_DATA_TEST_ID.CONFIRM_MODAL)).toBeInTheDocument();
      });

      // WHEN user cancels
      // we are using the last call to the ConfirmModalDialog mock because the first one is the initial call
      // and a bunch of calls are made when the component is re-rendered,
      // for example, due to the chat initialization
      act(() => {
        (ConfirmModalDialog as jest.Mock).mock.calls.at(-1)[0].onCancel();
      });
      // THEN expect dialog to close
      expect(screen.queryByText("Are you sure you want to start a new conversation?")).not.toBeInTheDocument();

      // AND expect chat state to remain unchanged
      assertMessagesAreShown([
          ...givenPreviousConversation.messages.map((message) => ({
            ...message,
            id: expect.any(String),
            type: ChatMessageType.BASIC_CHAT,
          })),
        ], true,
      );
    });

    test("should handle new conversation error", async () => {
      // GIVEN a user is logged in
      const givenUser: TabiyaUser = getMockUser();
      AuthenticationStateService.getInstance().setUser(givenUser);
      // AND the user has an active session
      const givenActiveSessionId = 123;
      UserPreferencesStateService.getInstance().setUserPreferences(getMockUserPreferences(givenUser, givenActiveSessionId));

      // AND a chat service that returns an existing conversation
      const givenPreviousConversation = getMockConversationResponse([
        {
          message: "7a283c09-c4d4-4bf3-a480-1263e4d5282e",
          sent_at: new Date().toISOString(),
          sender: ConversationMessageSender.COMPASS,
        },
      ]);

      jest.spyOn(ChatService.getInstance(), "getChatHistory").mockResolvedValueOnce(givenPreviousConversation);

      // AND a failing new session service
      const givenError = new Error("Failed to start new conversation");
      jest.spyOn(UserPreferencesService.getInstance(), "getNewSession").mockRejectedValueOnce(givenError);

      // AND the component is mounted
      render(<Chat />);

      // WHEN new conversation clicked
      act(() => {
        (ChatHeader as jest.Mock).mock.calls.at(-1)[0].startNewConversation();
      });
      // THEN expect confirmation dialog to be shown
      await waitFor(() => {
        expect(screen.getByTestId(CONFIRM_MODAL_DIALOG_DATA_TEST_ID.CONFIRM_MODAL)).toBeInTheDocument();
      });

      // AND the user confirms
      // we are using the last call to the ConfirmModalDialog mock because the first one is the initial call
      // and a bunch of calls are made when the component is re-rendered,
      // for example, due to the chat initialization
      act(() => {
        (ConfirmModalDialog as jest.Mock).mock.calls.at(-1)[0].onConfirm();
      });
      // THEN expect an error message to be added to the chat list
      await waitFor(() => {
        assertMessagesAreShown([{
          id: expect.any(String),
          type: ChatMessageType.BASIC_CHAT,
          message: FIXED_MESSAGES_TEXT.SOMETHING_WENT_WRONG,
          sender: ConversationMessageSender.COMPASS,
          sent_at: expect.any(String),
        }], true);
      });

      // AND expect input field to have be disabled because the conversation is finished
      expect(ChatMessageField as jest.Mock).toHaveBeenLastCalledWith(expect.objectContaining({ isChatFinished: true }), {});

      // AND expect a snackbar notification was shown once
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledTimes(1);
      // AND expect the snackbar notification to be an error
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith("Failed to start new conversation", {
        variant: "error",
      });
      // AND expect the dialog to close
      expect(screen.queryByTestId(CONFIRM_MODAL_DIALOG_DATA_TEST_ID.CONFIRM_MODAL)).not.toBeInTheDocument();
    });
  });

  describe("handling feedback submission", () => {
    test("should handle feedback submission successfully", async () => {
      // GIVEN a user is logged in
      const givenUser: TabiyaUser = getMockUser();
      AuthenticationStateService.getInstance().setUser(givenUser);
      // AND the user has an active session
      const givenActiveSessionId = 123;
      UserPreferencesStateService.getInstance().setUserPreferences(getMockUserPreferences(givenUser, givenActiveSessionId));

      // AND a chat service with existing messages
      const givenMessages: ConversationResponse = getMockConversationResponse([
        {
          message: "66a3fd90-2f4a-4aeb-af56-b4f12f73c68d",
          sent_at: new Date().toISOString(),
          sender: ConversationMessageSender.USER,
        },
        {
          message: "c64b0aae-f19b-49cb-a8e8-2e6f4fd69947",
          sent_at: new Date().toISOString(),
          sender: ConversationMessageSender.COMPASS,
        },
      ]);

      jest.spyOn(ChatService.getInstance(), "getChatHistory").mockResolvedValueOnce(givenMessages);

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
          {},
        );
      });

      // AND expect a thank-you message to be added to the chat list
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
          {},
        );
      });
      // AND no errors or warnings were logged
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });
  });
  describe("handling inactivity backdrop", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      console.info("*************");
      // Reset the Date.now() mock before each test
      //jest.spyOn(Date, "now").mockImplementation(() => 0);
    });

    afterEach(() => {
      jest.useRealTimers();
      //jest.restoreAllMocks();
    });

    test("should show inactive backdrop after inactivity timeout", async () => {
      // GIVEN a user is logged in
      const givenUser: TabiyaUser = getMockUser();
      AuthenticationStateService.getInstance().setUser(givenUser);
      // AND the user has an active session
      const givenActiveSessionId = 123;
      UserPreferencesStateService.getInstance().setUserPreferences(getMockUserPreferences(givenUser, givenActiveSessionId));

      // AND the conversation history has some messages
      const givenMessages: ConversationResponse = getMockConversationResponse([
        {
          message: "d3b57530-82ed-42b7-8621-95aeec4a60b4",
          sent_at: new Date().toISOString(),
          sender: ConversationMessageSender.USER,
        },
      ]);
      jest.spyOn(ChatService.getInstance(), "getChatHistory").mockResolvedValueOnce(givenMessages);

      // WHEN the component is mounted
      render(<Chat />);
      // AND flush all microtasks unclear because they are not flushed in the waitFor when using  fake timers
      // the issue with the WARNING: An update to Chat inside a test was not wrapped in act(...).
      await act(async () => {
        await Promise.resolve();
      });

      // AND the chat component is initialized
      await assertChatInitialized();

      // AND time passes beyond the inactivity timeout and the check interval
      act(() => {
        // Trigger the check interval and satisfy the inactivity timeout
        jest.advanceTimersByTime(INACTIVITY_TIMEOUT + CHECK_INACTIVITY_INTERVAL + 1);
      });

      // THEN expect the backdrop to be visible
      await waitFor(() => {
        expect(screen.getByTestId(INACTIVE_BACKDROP_DATA_TEST_ID.INACTIVE_BACKDROP_CONTAINER)).toBeVisible();
      });
      // AND no errors or warnings were logged
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should not show inactive backdrop when disableInactivityCheck is true", async () => {
      // GIVEN a user is logged in
      const givenUser: TabiyaUser = getMockUser();
      AuthenticationStateService.getInstance().setUser(givenUser);
      // AND the user has an active session
      const givenActiveSessionId = 123;
      UserPreferencesStateService.getInstance().setUserPreferences(getMockUserPreferences(givenUser, givenActiveSessionId));

      // AND the conversation history has some messages
      const givenMessages: ConversationResponse = getMockConversationResponse([
        {
          message: "5a7330e5-4f0c-4c1f-8a1c-f86d7ad59530",
          sent_at: new Date().toISOString(),
          sender: ConversationMessageSender.USER,
        },
      ]);
      jest.spyOn(ChatService.getInstance(), "getChatHistory").mockResolvedValueOnce(givenMessages);

      // WHEN the component is mounted with disableInactivityCheck
      render(<Chat disableInactivityCheck={true} />);

      // AND flush all microtasks unclear because they are not flushed in the waitFor when using  fake timers
      // the issue with the WARNING: An update to Chat inside a test was not wrapped in act(...).
      await act(async () => {
        await Promise.resolve();
      });

      // AND the chat component is initialized
      await assertChatInitialized();
      // AND time passes beyond the inactivity timeout and the check interval
      act(() => {
        // Trigger the check interval and satisfy the inactivity timeout
        jest.advanceTimersByTime(INACTIVITY_TIMEOUT + CHECK_INACTIVITY_INTERVAL + 1);
      });

      // THEN expect the backdrop to not be visible
      await waitFor(() => {
        expect(
          screen.queryByTestId(INACTIVE_BACKDROP_DATA_TEST_ID.INACTIVE_BACKDROP_CONTAINER),
        ).not.toBeInTheDocument();
      });
      // AND no errors or warnings were logged
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test.each([
      ["click", (userEventFakeTimer: UserEvent) => userEventFakeTimer.click(screen.getByTestId(DATA_TEST_ID.CHAT_CONTAINER))],
      ["type(foo)", (userEventFakeTimer: UserEvent) => userEventFakeTimer.type(screen.getByTestId(DATA_TEST_ID.CHAT_CONTAINER), "foo")],
      ["type(Space)", (userEventFakeTimer: UserEvent) => userEventFakeTimer.type(screen.getByTestId(DATA_TEST_ID.CHAT_CONTAINER), " ")],
      ["type(enter)", (userEventFakeTimer: UserEvent) => userEventFakeTimer.type(screen.getByTestId(DATA_TEST_ID.CHAT_CONTAINER), "\n")],
    ])("should hide backdrop on %s event", async (_, triggerEvent) => {

      // GIVEN a user is logged in
      const givenUser: TabiyaUser = getMockUser();
      AuthenticationStateService.getInstance().setUser(givenUser);
      // AND the user has an active session
      const givenActiveSessionId = 123;
      UserPreferencesStateService.getInstance().setUserPreferences(getMockUserPreferences(givenUser, givenActiveSessionId));

      // AND a chat service with some messages
      const givenMessages: ConversationResponse = getMockConversationResponse([
        {
          message: "ed1c8727-9716-4e69-8669-d8f6c8f4aabd",
          sent_at: new Date().toISOString(),
          sender: ConversationMessageSender.USER,
        },
      ]);
      jest.spyOn(ChatService.getInstance(), "getChatHistory").mockResolvedValueOnce(givenMessages);

      // AND the component is mounted
      render(<Chat />);

      // AND flush all microtasks unclear because they are not flushed in the waitFor when using  fake timers
      // the issue with the WARNING: An update to Chat inside a test was not wrapped in act(...).
      await act(async () => {
        await Promise.resolve();
      });

      // AND the chat component is initialized
      await assertChatInitialized();
      jest.useFakeTimers();
      // AND time passes beyond the inactivity timeout and the check interval
      act(() => {
        // Trigger the check interval and satisfy the inactivity timeout
        jest.advanceTimersByTime(INACTIVITY_TIMEOUT + CHECK_INACTIVITY_INTERVAL + 1);
      });

      // THEN expect the backdrop be visible
      await waitFor(() => {
        expect(
          screen.queryByTestId(INACTIVE_BACKDROP_DATA_TEST_ID.INACTIVE_BACKDROP_CONTAINER),
        ).toBeVisible();
      });

      // WHEN the user interacts
      const userEventFakeTimer = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      act(() => {
        triggerEvent(userEventFakeTimer);
      });


      // THEN expect the backdrop to be hidden
      await waitFor(() => {
        expect(
          screen.queryByTestId(INACTIVE_BACKDROP_DATA_TEST_ID.INACTIVE_BACKDROP_CONTAINER),
        ).not.toBeInTheDocument();
      });
      // AND no errors or warnings were logged
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();

      // reset the timers
      jest.useRealTimers();
    });
  });
});