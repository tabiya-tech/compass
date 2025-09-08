// silence chatty console
import "src/_test_utilities/consoleMock";

import { act, render, screen, waitFor } from "src/_test_utilities/test-utils";
import Chat, {
  CHECK_INACTIVITY_INTERVAL,
  DATA_TEST_ID,
  INACTIVITY_TIMEOUT,
  NOTIFICATION_MESSAGES_TEXT,
  TYPING_BEFORE_CONCLUSION_MESSAGE_TIMEOUT,
} from "src/chat/Chat";
import ChatHeader, { DATA_TEST_ID as CHAT_HEADER_TEST_ID } from "src/chat/ChatHeader/ChatHeader";
import ChatList, { DATA_TEST_ID as CHAT_LIST_TEST_ID } from "src/chat/chatList/ChatList";
import ChatMessageField, {
  DATA_TEST_ID as CHAT_MESSAGE_FIELD_TEST_ID,
} from "src/chat/ChatMessageField/ChatMessageField";
import ChatService from "./ChatService/ChatService";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { ConversationMessage, ConversationMessageSender, ConversationResponse } from "./ChatService/ChatService.types";
import AuthenticationStateService from "src/auth/services/AuthenticationState.service";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { ChatError } from "src/error/commonErrors";
import UserPreferencesService from "src/userPreferences/UserPreferencesService/userPreferences.service";
import ExperienceService from "src/experiences/experienceService/experienceService";
import ExperiencesDrawer, {
  DATA_TEST_ID as EXPERIENCE_DRAWER_TEST_ID,
} from "src/experiences/experiencesDrawer/ExperiencesDrawer";
import { DiveInPhase, WorkType } from "src/experiences/experienceService/experiences.types";
import {
  Language,
  SensitivePersonalDataRequirement,
  UserPreference,
} from "src/userPreferences/UserPreferencesService/userPreferences.types";
import ConfirmModalDialog, {
  DATA_TEST_ID as CONFIRM_MODAL_DIALOG_DATA_TEST_ID,
} from "src/theme/confirmModalDialog/ConfirmModalDialog";
import { DATA_TEST_ID as INACTIVE_BACKDROP_DATA_TEST_ID } from "src/theme/Backdrop/InactiveBackdrop";
import userEvent, { UserEvent } from "@testing-library/user-event";
import { IChatMessage } from "./Chat.types";
import { FIXED_MESSAGES_TEXT } from "./util";
import { TabiyaUser } from "src/auth/auth.types";
import { resetAllMethodMocks } from "src/_test_utilities/resetAllMethodMocks";
import { nanoid } from "nanoid";
import { ReactionKind } from "src/chat/reaction/reaction.types";
import { lazyWithPreload } from "src/utils/preloadableComponent/PreloadableComponent";
import { ConversationPhase, defaultCurrentPhase } from "./chatProgressbar/types";
import ChatProgressBar, {
  DATA_TEST_ID as CHAT_PROGRESS_BAR_DATA_TEST_ID,
} from "src/chat/chatProgressbar/ChatProgressBar";
import { ChatProvider } from "src/chat/ChatContext";
import { USER_CHAT_MESSAGE_TYPE } from "src/chat/chatMessage/userChatMessage/UserChatMessage";
import { COMPASS_CHAT_MESSAGE_TYPE } from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";
import { TYPING_CHAT_MESSAGE_TYPE } from "src/chat/chatMessage/typingChatMessage/TypingChatMessage";
import { ERROR_CHAT_MESSAGE_TYPE } from "src/chat/chatMessage/errorChatMessage/ErrorChatMessage";
import { CONVERSATION_CONCLUSION_CHAT_MESSAGE_TYPE } from "src/chat/chatMessage/conversationConclusionChatMessage/ConversationConclusionChatMessage";
import { mockExperiences } from "src/experiences/experienceService/_test_utilities/mockExperiencesResponses";
import { getRandomSessionID } from "src/features/skillsRanking/utils/getSkillsRankingState";
import CVService from "src/CV/CVService/CVService";
import { CV_TYPING_CHAT_MESSAGE_TYPE } from "src/CV/CVTypingChatMessage/CVTypingChatMessage";

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

// mock lazyWithPreload
jest.mock("src/utils/preloadableComponent/PreloadableComponent", () => {
  return {
    __esModule: true,
    lazyWithPreload: jest.fn(() => ({
      preload: jest.fn(() => Promise.resolve()),
    })),
  };
});

// mock the ChatProgressBar component
jest.mock("src/chat/chatProgressbar/ChatProgressBar", () => {
  const actual = jest.requireActual("src/chat/chatProgressbar/ChatProgressBar");
  return {
    __esModule: true,
    ...actual,
    default: jest.fn().mockImplementation((props) => (
      <div data-testid={actual.DATA_TEST_ID.CONTAINER}>
        {props.phase} - {props.percentage}%
      </div>
    )),
  };
});

// mock utils
jest.mock("src/chat/util", () => {
  const actual = jest.requireActual("src/chat/util");
  return {
    ...actual,
    parseConversationPhase: jest.fn().mockImplementation((arg1, _arg2) => arg1),
  };
});

//  mock the chat context
jest.mock("src/chat/ChatContext", () => {
  const actual = jest.requireActual("src/chat/ChatContext");
  return {
    ...actual,
    ChatProvider: jest.fn().mockImplementation(({ children }) => <div>{children}</div>),
  };
});

describe("Chat", () => {
  // ExperienceService methods to be mocked
  const mockGetExperiences = jest.fn();

  function assertResponseMessagesAreShown(
    givenConversationResponse: ConversationResponse,
    areLastMessages: boolean = true
  ) {
    assertMessagesAreShown(
      givenConversationResponse.messages.map((message) => ({
        message_id: message.sender === ConversationMessageSender.COMPASS ? expect.any(String) : undefined, // only compass messages are called with message_id
        type: expect.any(String), // The type field is inferred on the frontend
        component: expect.any(Function), // The component field will be a function that returns a react component
        sender: message.sender,
        payload: expect.any(Object),
      })),
      areLastMessages
    );
  }

  function assertMessagesAreShown(conversationMessages: IChatMessage<any>[], areLastMessages: boolean = true) {
    // eslint-disable-next-line jest/valid-expect
    const fn = areLastMessages ? expect(ChatList as jest.Mock).toHaveBeenLastCalledWith : expect(ChatList as jest.Mock).toHaveBeenCalledWith;
    fn(
      expect.objectContaining({
        messages: expect.arrayContaining(
          conversationMessages.map((msg) => ({
            ...msg,
            message_id: expect.any(String),
          }))
        ),
      }),
      {}
    );
  }

  function assertTypingMessageWasShown(nthCall: number = -1) {
    // AND expect a typing indicator to have been shown
    const assertion = () =>
      expect.objectContaining({
        messages: expect.arrayContaining([expect.objectContaining({ type: TYPING_CHAT_MESSAGE_TYPE })]),
      });
    if (nthCall < 0) {
      expect(ChatList as jest.Mock).toHaveBeenCalledWith(assertion(), {});
    } else {
      expect(ChatList as jest.Mock).toHaveBeenNthCalledWith(nthCall, assertion(), {});
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
      user_feedback_answered_questions: {},
      experiments: {},
    };
  }

  function getMockConversationResponse(
    messages: ConversationMessage[],
    phase: ConversationPhase,
    percentage: number
  ): ConversationResponse {
    return {
      messages: messages,
      conversation_completed: false,
      conversation_conducted_at: null,
      experiences_explored: 0,
      current_phase: {
        percentage: percentage,
        phase: phase,
        current: null,
        total: null,
      },
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
      UserPreferencesStateService.getInstance().setUserPreferences(
        getMockUserPreferences(givenUser, givenActiveSessionId)
      );
      // AND the conversation history has some messages
      const givenChatHistoryResponse: ConversationResponse = getMockConversationResponse(
        [
          {
            message_id: nanoid(),
            message: "eb0f8640-9d51-4e9b-a5b8-cd660aa1b08b",
            sent_at: new Date().toISOString(),
            sender: ConversationMessageSender.USER,
            reaction: null,
          },
          {
            message_id: nanoid(),
            message: "f564df06-799f-4e20-9b54-369515c0c222",
            sent_at: new Date().toISOString(),
            sender: ConversationMessageSender.COMPASS,
            reaction: null,
          },
        ],
        ConversationPhase.COLLECT_EXPERIENCES,
        50
      );
      jest.spyOn(ChatService.getInstance(), "getChatHistory").mockResolvedValueOnce(givenChatHistoryResponse);
      // AND when a chat message is sent, it returns some message
      jest
        .spyOn(ChatService.getInstance(), "sendMessage")
        .mockResolvedValueOnce(getMockConversationResponse([], ConversationPhase.COLLECT_EXPERIENCES, 0));

      // AND parse conversation phase function is mocked
      const parseConversationPhaseMock = jest.spyOn(require("src/chat/util"), "parseConversationPhase");

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
      // AND expect the chat progress bar to be visible
      expect(screen.getByTestId(CHAT_PROGRESS_BAR_DATA_TEST_ID.CONTAINER)).toBeInTheDocument();

      // AND parseConversationFn should be called with the right conversation phase.
      expect(parseConversationPhaseMock).toHaveBeenCalledWith(
        givenChatHistoryResponse.current_phase,
        defaultCurrentPhase
      );

      // AND expect the chat progress bar to be rendered with the correct phase and percentage.
      expect(ChatProgressBar as jest.Mock).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: givenChatHistoryResponse.current_phase.phase,
          percentage: givenChatHistoryResponse.current_phase.percentage,
        }),
        {}
      );
      // AND expect no console errors
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
      // AND the component to match the snapshot
      expect(screen.getByTestId(DATA_TEST_ID.CHAT_CONTAINER)).toMatchSnapshot();
      /// AND expect a snackbar notification was never shown
      expect(useSnackbar().enqueueSnackbar).not.toHaveBeenCalled();
      // AND expect input field to have been enabled
      expect(ChatMessageField as jest.Mock).toHaveBeenLastCalledWith(
        expect.objectContaining({ isChatFinished: false, aiIsTyping: false }),
        {}
      );
    });
  });

  describe("chat initialization", () => {
    describe("should initialize chat for a user with an active session", () => {
      test("should initialize chat and fetch history on mount when the user has an existing conversation that is not concluded", async () => {
        // GIVEN a logged-in user
        const givenUser: TabiyaUser = getMockUser();
        AuthenticationStateService.getInstance().setUser(givenUser);
        // AND the user has an active session
        const givenActiveSessionId = 123;
        UserPreferencesStateService.getInstance().setUserPreferences(
          getMockUserPreferences(givenUser, givenActiveSessionId)
        );
        // AND the conversation history has some messages
        const givenChatHistoryResponse: ConversationResponse = getMockConversationResponse(
          [
            {
              message_id: nanoid(),
              message: "bcf81460-54de-484a-822f-a96b27378224",
              sent_at: new Date().toISOString(),
              sender: ConversationMessageSender.USER,
              reaction: null,
            },
            {
              message_id: nanoid(),
              message: "52aea18a-4a0f-44ad-b690-e99ff8e4ddc7",
              sent_at: new Date().toISOString(),
              sender: ConversationMessageSender.COMPASS,
              reaction: {
                id: nanoid(),
                kind: ReactionKind.LIKED,
              },
            },
          ],
          ConversationPhase.COLLECT_EXPERIENCES,
          50
        );
        jest.spyOn(ChatService.getInstance(), "getChatHistory").mockResolvedValueOnce(givenChatHistoryResponse);
        // AND when a chat message is sent, it returns some message
        jest
          .spyOn(ChatService.getInstance(), "sendMessage")
          .mockResolvedValueOnce(getMockConversationResponse([], ConversationPhase.COLLECT_EXPERIENCES, 0));

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
        // wait for the chat list to be updated
        await waitFor(() => {
          assertResponseMessagesAreShown(givenChatHistoryResponse, true);
        });

        // Now check the final state
        assertResponseMessagesAreShown(givenChatHistoryResponse, true);
        // AND expect a snackbar notification was never shown
        expect(useSnackbar().enqueueSnackbar).not.toHaveBeenCalled();
        // AND expect input field to have been enabled
        expect(ChatMessageField as jest.Mock).toHaveBeenLastCalledWith(
          expect.objectContaining({ isChatFinished: false, aiIsTyping: false }),
          {}
        );
        // AND expect no errors or warning to have occurred
        expect(console.error).not.toHaveBeenCalled();
        expect(console.warn).not.toHaveBeenCalled();
      });

      test("should initialize chat and fetch history on mount when the user has a concluded existing conversation with experiences", async () => {
        // GIVEN a logged-in user
        const givenUser: TabiyaUser = getMockUser();
        AuthenticationStateService.getInstance().setUser(givenUser);
        // AND the user has an active session
        const givenActiveSessionId = 123;
        UserPreferencesStateService.getInstance().setUserPreferences(
          getMockUserPreferences(givenUser, givenActiveSessionId)
        );
        // AND the conversation history has some messages
        const givenChatHistoryResponse: ConversationResponse = {
          messages: [
            {
              message_id: nanoid(),
              message: "bcf81460-54de-484a-822f-a96b27378224",
              sent_at: new Date().toISOString(),
              sender: ConversationMessageSender.USER,
              reaction: null,
            },
            {
              message_id: nanoid(),
              message: "52aea18a-4a0f-44ad-b690-e99ff8e4ddc7",
              sent_at: new Date().toISOString(),
              sender: ConversationMessageSender.COMPASS,
              reaction: null,
            },
          ],
          conversation_completed: true, // completed conversation
          conversation_conducted_at: new Date().toISOString(),
          experiences_explored: 2,
          current_phase: {
            percentage: 0,
            phase: ConversationPhase.INTRO,
            current: null,
            total: null,
          },
        };
        jest.spyOn(ChatService.getInstance(), "getChatHistory").mockResolvedValueOnce(givenChatHistoryResponse);

        // AND the user has processed experiences
        const processedExperiences = mockExperiences
          .filter((exp) => exp.exploration_phase === DiveInPhase.PROCESSED)
          .slice(0, 2);
        mockGetExperiences.mockResolvedValueOnce(processedExperiences);

        // AND when a chat message is sent, it returns some messages and a conversation completed flag
        jest
          .spyOn(ChatService.getInstance(), "sendMessage")
          .mockResolvedValueOnce(getMockConversationResponse([], ConversationPhase.COLLECT_EXPERIENCES, 0));

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
        // the conversation conclusion message would be shown once the skills ranking is completed
        // AND expect a snackbar notification was never shown
        expect(useSnackbar().enqueueSnackbar).not.toHaveBeenCalled();
        // AND expect input field to have been disabled
        await waitFor(() => {
          expect(ChatMessageField as jest.Mock).toHaveBeenLastCalledWith(
            expect.objectContaining({ isChatFinished: true, aiIsTyping: false }),
            {}
          );
        });
        // AND expect the experiences notification to be shown
        expect(ChatHeader as jest.Mock).toHaveBeenLastCalledWith(
          expect.objectContaining({
            experiencesExplored: processedExperiences.length,
            exploredExperiencesNotification: true,
          }),
          {}
        );
        // AND expect the DownloadReportDropdown to be preloaded
        await waitFor(() => {
          expect(lazyWithPreload).toHaveBeenCalledWith(expect.any(Function));
        });
        expect((lazyWithPreload as jest.Mock).mock.results[0].value.preload).toHaveBeenCalled();
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
          UserPreferencesStateService.getInstance().setUserPreferences(
            getMockUserPreferences(givenUser, givenActiveSessionId)
          );
          // AND the conversation history has some messages
          const givenChatHistoryResponse: ConversationResponse = getMockConversationResponse(
            [],
            ConversationPhase.INTRO,
            0
          );
          jest.spyOn(ChatService.getInstance(), "getChatHistory").mockResolvedValueOnce(givenChatHistoryResponse);
          // AND when a chat message is sent, it returns a message
          const givenSendMessageResponse: ConversationResponse = getMockConversationResponse(
            [
              {
                message_id: nanoid(),
                message: "004448d3-f97a-484e-94a4-03951ba8b36f", // A RESPONSE FROM THE AI
                sent_at: new Date().toISOString(),
                sender: ConversationMessageSender.COMPASS,
                reaction: null,
              },
            ],
            ConversationPhase.COLLECT_EXPERIENCES,
            25
          );
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
          await expect((ChatService.getInstance().sendMessage as jest.Mock).mock.results[0].value).resolves.toBe(
            givenSendMessageResponse
          );
          // THEN expect the chat list to be updated with the response from the chat service
          assertResponseMessagesAreShown(givenSendMessageResponse, true);
          // AND expect a snackbar notification was never shown
          expect(useSnackbar().enqueueSnackbar).not.toHaveBeenCalled();
          // AND expect input field to have been enabled
          expect(ChatMessageField as jest.Mock).toHaveBeenLastCalledWith(
            expect.objectContaining({ isChatFinished: false, aiIsTyping: false }),
            {}
          );
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
          UserPreferencesStateService.getInstance().setUserPreferences(
            getMockUserPreferences(givenUser, givenActiveSessionId)
          );
          // AND the conversation history is empty
          const givenChatHistoryResponse: ConversationResponse = getMockConversationResponse(
            [],
            ConversationPhase.INTRO,
            0
          );
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
              messages: expect.arrayContaining([
                {
                  message_id: expect.any(String),
                  type: ERROR_CHAT_MESSAGE_TYPE,
                  sender: ConversationMessageSender.COMPASS,
                  component: expect.any(Function),
                  payload: {
                    message: FIXED_MESSAGES_TEXT.PLEASE_REPEAT,
                  },
                },
              ]),
            }),
            {}
          );
          // AND expect that a snackbar notification is not shown
          expect(useSnackbar().enqueueSnackbar).not.toHaveBeenCalled();
          // AND expect input field to have enabled
          expect(ChatMessageField as jest.Mock).toHaveBeenLastCalledWith(
            expect.objectContaining({ isChatFinished: false, aiIsTyping: false }),
            {}
          );
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
        UserPreferencesStateService.getInstance().setUserPreferences(
          getMockUserPreferences(givenUser, givenActiveSessionId)
        );
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
            { variant: "error" }
          );
        });
        // AND expect the chat to show a message that something went wrong
        assertMessagesAreShown(
          [
            {
              message_id: expect.any(String),
              type: ERROR_CHAT_MESSAGE_TYPE,
              sender: ConversationMessageSender.COMPASS,
              payload: {
                message: FIXED_MESSAGES_TEXT.SOMETHING_WENT_WRONG,
              },
              component: expect.any(Function),
            },
          ],
          true
        );

        // AND expect input field to have be disabled because the chat is finished
        expect(ChatMessageField as jest.Mock).toHaveBeenLastCalledWith(
          expect.objectContaining({ isChatFinished: true }),
          {}
        );
        // AND expect an error to have been logged
        expect(console.error).toHaveBeenCalledTimes(1);
        expect(console.error).toHaveBeenCalledWith(new ChatError("Failed to initialize chat", givenError));
      });

      test("should initialize chat and fetch history on mount and show a message if the conversation is completed", async () => {
        // GIVEN a logged-in user
        const givenUser: TabiyaUser = getMockUser();
        AuthenticationStateService.getInstance().setUser(givenUser);
        // AND the user has an active session
        const givenActiveSessionId = 123;
        UserPreferencesStateService.getInstance().setUserPreferences(
          getMockUserPreferences(givenUser, givenActiveSessionId)
        );
        // AND the conversation history has some messages
        const givenChatHistoryResponse: ConversationResponse = getMockConversationResponse(
          [
            {
              message_id: nanoid(),
              message: "bcf81460-54de-484a-822f-a96b27378224",
              sent_at: new Date().toISOString(),
              sender: ConversationMessageSender.USER,
              reaction: null,
            },
            {
              message_id: nanoid(),
              message: "52aea18a-4a0f-44ad-b690-e99ff8e4ddc7",
              sent_at: new Date().toISOString(),
              sender: ConversationMessageSender.COMPASS,
              reaction: null,
            },
          ],
          ConversationPhase.COLLECT_EXPERIENCES,
          50
        );
        jest.spyOn(ChatService.getInstance(), "getChatHistory").mockResolvedValueOnce(givenChatHistoryResponse);
        // AND the conversation is completed
        givenChatHistoryResponse.conversation_completed = true;
        // AND when a chat message is sent, it returns some message
        jest
          .spyOn(ChatService.getInstance(), "sendMessage")
          .mockResolvedValueOnce(getMockConversationResponse([], ConversationPhase.COLLECT_EXPERIENCES, 0));

        // WHEN the component is mounted
        render(<Chat />);

        // THEN expect the Chat component to be initialized
        await assertChatInitialized();
        // AND expect chat history was fetched with the active session ID
        expect(ChatService.getInstance().getChatHistory).toHaveBeenCalledWith(givenActiveSessionId);
        // AND no message to be sent to the chat service
        expect(ChatService.getInstance().sendMessage).not.toHaveBeenCalled();
        // AND input field to have been disabled
        expect(ChatMessageField as jest.Mock).toHaveBeenLastCalledWith(
          expect.objectContaining({ isChatFinished: true, aiIsTyping: false }),
          {}
        );
        // AND expect no errors or warning to have occurred
        expect(console.error).not.toHaveBeenCalled();
        expect(console.warn).not.toHaveBeenCalled();
      });
    });

    describe("should initialize chat for a user that does not have an active session", () => {
      test("should create a new chat session if the active session is not found", async () => {
        // GIVEN a logged-in user
        const givenUser: TabiyaUser = getMockUser();
        AuthenticationStateService.getInstance().setUser(givenUser);
        // AND the user has no active session
        const givenActiveSessionId = null;
        UserPreferencesStateService.getInstance().setUserPreferences(
          getMockUserPreferences(givenUser, givenActiveSessionId)
        );
        // AND the user preferences service returns a new session id
        const givenNewSessionId = 123;
        const givenUserPreferences: UserPreference = {
          user_id: givenUser.id,
          accepted_tc: new Date(),
          has_sensitive_personal_data: false,
          language: Language.en,
          sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
          sessions: [givenNewSessionId],
          user_feedback_answered_questions: {},
          experiments: {},
        };
        jest.spyOn(UserPreferencesService.getInstance(), "getNewSession").mockResolvedValueOnce(givenUserPreferences);
        // AND the conversation history is empty
        const givenChatHistoryResponse: ConversationResponse = getMockConversationResponse(
          [],
          ConversationPhase.INTRO,
          0
        );
        jest.spyOn(ChatService.getInstance(), "getChatHistory").mockResolvedValueOnce(givenChatHistoryResponse);
        // AND when a chat message is sent, it returns a message
        const givenSendMessageResponse: ConversationResponse = getMockConversationResponse(
          [
            {
              message_id: nanoid(),
              message: "c9afe141-3655-48d1-b558-cf69123ab803", // A RESPONSE FROM THE AI
              sent_at: new Date().toISOString(),
              sender: ConversationMessageSender.COMPASS,
              reaction: null,
            },
          ],
          ConversationPhase.COLLECT_EXPERIENCES,
          25
        );
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
        // AND expect an empty message to be sent to the chat service for the new session
        expect(ChatService.getInstance().sendMessage).toHaveBeenCalledWith(givenNewSessionId, "");
        // AND expect the chat list to be updated with the new (empty) messages list
        expect(ChatList as jest.Mock).toHaveBeenNthCalledWith(1, expect.objectContaining({ messages: [] }), {});
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
        UserPreferencesStateService.getInstance().setUserPreferences(
          getMockUserPreferences(givenUser, givenActiveSessionId)
        );

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
        assertMessagesAreShown(
          [
            {
              message_id: expect.any(String),
              type: ERROR_CHAT_MESSAGE_TYPE,
              sender: ConversationMessageSender.COMPASS,
              payload: {
                message: FIXED_MESSAGES_TEXT.SOMETHING_WENT_WRONG,
              },
              component: expect.any(Function),
            },
          ],
          true
        );
        // AND expect input field to have be disabled because the conversation is finished
        expect(ChatMessageField as jest.Mock).toHaveBeenLastCalledWith(
          expect.objectContaining({ isChatFinished: true }),
          {}
        );
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
        UserPreferencesStateService.getInstance().setUserPreferences(
          getMockUserPreferences(givenUser, givenActiveSessionId)
        );

        // AND the user preferences service will create a new session with the given id
        const givenNewSessionId = 123;
        const givenUserPreferences: UserPreference = {
          user_id: givenUser.id,
          accepted_tc: new Date(),
          has_sensitive_personal_data: false,
          sessions: [givenNewSessionId],
          user_feedback_answered_questions: {},
          sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
          language: Language.en,
          experiments: {},
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
        assertMessagesAreShown(
          [
            {
              message_id: expect.any(String),
              type: ERROR_CHAT_MESSAGE_TYPE,
              sender: ConversationMessageSender.COMPASS,
              payload: {
                message: FIXED_MESSAGES_TEXT.SOMETHING_WENT_WRONG,
              },
              component: expect.any(Function),
            },
          ],
          true
        );

        // AND expect input field to have be disabled because the conversation is finished
        expect(ChatMessageField as jest.Mock).toHaveBeenLastCalledWith(
          expect.objectContaining({ isChatFinished: true }),
          {}
        );
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
        UserPreferencesStateService.getInstance().setUserPreferences(
          getMockUserPreferences(givenUser, givenActiveSessionId)
        );

        // AND the preferences service will creates a new session and returns the id
        const givenNewSessionId = 123;
        const givenUserPreferences: UserPreference = {
          user_id: givenUser.id,
          language: Language.en,
          accepted_tc: new Date(),
          has_sensitive_personal_data: false,
          sessions: [givenNewSessionId],
          user_feedback_answered_questions: {},
          sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
          experiments: {},
        };
        jest.spyOn(UserPreferencesService.getInstance(), "getNewSession").mockResolvedValueOnce(givenUserPreferences);

        // AND the chat history is empty
        const givenChatHistoryResponse: ConversationResponse = getMockConversationResponse(
          [],
          ConversationPhase.INTRO,
          0
        );
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
        assertMessagesAreShown(
          [
            {
              message_id: expect.any(String),
              sender: ConversationMessageSender.COMPASS,
              type: ERROR_CHAT_MESSAGE_TYPE,
              payload: {
                message: FIXED_MESSAGES_TEXT.PLEASE_REPEAT,
              },
              component: expect.any(Function),
            },
          ],
          true
        );
        // AND expect input field to have be enabled
        expect(ChatMessageField as jest.Mock).toHaveBeenLastCalledWith(
          expect.objectContaining({ isChatFinished: false, aiIsTyping: false }),
          {}
        );
        // AND expect an error to have been logged
        expect(console.error).toHaveBeenCalledTimes(1);
        expect(console.error).toHaveBeenCalledWith(new ChatError("Failed to send message:", givenError));
      });
    });

    describe("fetching of conversation state", () => {
      test("should fetch explored experiences on initialization for the notification", async () => {
        const getChatHistorySpy = jest.spyOn(ChatService.getInstance(), "getChatHistory");
        const getExperiencesSpy = jest.spyOn(ExperienceService.getInstance(), "getExperiences");

        // GIVEN a logged-in user
        const givenUser: TabiyaUser = getMockUser();
        AuthenticationStateService.getInstance().setUser(givenUser);

        // AND the user has an active session id
        const givenActiveSessionId = getRandomSessionID();
        UserPreferencesStateService.getInstance().setUserPreferences(
          getMockUserPreferences(givenUser, givenActiveSessionId)
        );

        // AND the chat history will not return later
        let chatHistoryResolve
        getChatHistorySpy.mockReturnValue(new Promise((resolve) => {
          chatHistoryResolve = resolve
        }))

        // GUARD for typescript asserting chatHistoryResolve is defined
        expect(chatHistoryResolve).toBeDefined();

        // WHEN the component is mounted
        render(<Chat />);

        // THEN chatservice.getChatHistory should be called with the active session ID
        expect(getChatHistorySpy).toHaveBeenCalledWith(givenActiveSessionId)

        // AND expect the getExperiences method to be called with the active session ID
        expect(getExperiencesSpy).not.toHaveBeenCalledWith(givenActiveSessionId);

        // WHEN the getChatHistory resolves a current phase which is not INIT
        chatHistoryResolve!({
          messages: [],
          conversation_completed: false,
          conversation_conducted_at: null,
          experiences_explored: 0,
          current_phase: {
            percentage: 0,
            phase: ConversationPhase.INTRO,
            current: null,
            total: null,
          },
        })

        // THEN expect the getExperiences method to be called with the active session ID
        await waitFor(() => {
          expect(getExperiencesSpy).toHaveBeenCalledWith(givenActiveSessionId);
        });

        // AND expect the Chat component to be initialized
        await assertChatInitialized();
      })
    });
  });

  describe("sending a message", () => {
    test("should send a message successfully and recieve a conversation that is not concluded", async () => {
      // GIVEN a user is logged in
      const givenUser: TabiyaUser = getMockUser();
      AuthenticationStateService.getInstance().setUser(givenUser);
      // AND the user has an active session
      const givenActiveSessionId = 123;
      UserPreferencesStateService.getInstance().setUserPreferences(
        getMockUserPreferences(givenUser, givenActiveSessionId)
      );
      // AND the conversation history has some messages
      const givenPreviousConversation: ConversationResponse = getMockConversationResponse(
        [
          {
            message_id: nanoid(),
            message: "13a7d8b3-dcb8-4e5c-b377-97160eb2b814",
            sent_at: new Date().toISOString(),
            sender: ConversationMessageSender.COMPASS,
            reaction: null,
          },
          {
            message_id: nanoid(),
            message: "d27b6bf0-f060-4825-aeab-0f1b3d8e274d",
            sent_at: new Date().toISOString(),
            sender: ConversationMessageSender.COMPASS,
            reaction: null,
          },
          {
            message_id: nanoid(),
            message: "2c69dca6-fc07-4cdb-942c-0021c86ebe94",
            sent_at: new Date().toISOString(),
            sender: ConversationMessageSender.USER,
            reaction: null,
          },
          {
            message_id: nanoid(),
            message: "1c322d44-a232-494b-95be-af475abe36a8",
            sent_at: new Date().toISOString(),
            sender: ConversationMessageSender.COMPASS,
            reaction: null,
          },
        ],
        ConversationPhase.DIVE_IN,
        75
      );
      jest.spyOn(ChatService.getInstance(), "getChatHistory").mockResolvedValueOnce(givenPreviousConversation);
      // AND a chat service that can sends a message successfully
      const givenSendMessageResponse: ConversationResponse = {
        messages: [
          {
            message_id: nanoid(),
            message: "008f1449-4d70-4cc0-a876-553c11caad18",
            sent_at: new Date().toISOString(),
            sender: ConversationMessageSender.COMPASS,
            reaction: null,
          },
          {
            message_id: nanoid(),
            message: "51602db3-cf7f-490e-9ca8-4fae4427de30",
            sent_at: new Date().toISOString(),
            sender: ConversationMessageSender.COMPASS,
            reaction: null,
          },
        ],
        conversation_completed: false,
        conversation_conducted_at: null,
        experiences_explored: 0,
        current_phase: {
          percentage: 0,
          phase: ConversationPhase.INTRO,
          current: null,
          total: null,
        },
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
      // AND the user sends the message
      act(() => {
        (ChatMessageField as jest.Mock).mock.calls.at(-1)[0].handleSend(givenMessage);
      });

      // THEN expect the send message method to be called with the user's message
      expect(ChatService.getInstance().sendMessage).toHaveBeenCalledWith(givenActiveSessionId, givenMessage);
      // AND expect the user's message and a typing indicator to be shown in the chat
      await waitFor(() => {
        assertMessagesAreShown(
          [
            ...givenPreviousConversation.messages.map((message) => ({
              message_id: expect.any(String),
              type:
                message.sender === ConversationMessageSender.COMPASS
                  ? COMPASS_CHAT_MESSAGE_TYPE
                  : USER_CHAT_MESSAGE_TYPE,
              sender: message.sender,
              payload: {
                message_id: message.sender === ConversationMessageSender.COMPASS ? expect.any(String) : undefined,
                message: message.message,
                sent_at: message.sent_at,
                reaction: message.sender === ConversationMessageSender.COMPASS ? message.reaction : undefined,
              },
              component: expect.any(Function),
            })),
            {
              message_id: expect.any(String),
              type: USER_CHAT_MESSAGE_TYPE,
              sender: ConversationMessageSender.USER,
              payload: {
                message: givenMessage,
                sent_at: expect.any(String),
              },
              component: expect.any(Function),
            },
            {
              message_id: expect.any(String),
              type: TYPING_CHAT_MESSAGE_TYPE,
              sender: ConversationMessageSender.COMPASS,
              payload: {
                waitBeforeThinking: undefined,
              },
              component: expect.any(Function),
            },
          ],
          true
        );
      });
      // AND the input field to be disabled
      expect(ChatMessageField as jest.Mock).toHaveBeenLastCalledWith(
        expect.objectContaining({ isChatFinished: false, aiIsTyping: true }),
        {}
      );

      // AND WHEN the send message promise resolves
      act(() => {
        resolveSendMessage(givenSendMessageResponse);
      });

      // THEN expect the previous conversation and the response from the chat service to be shown in the chat
      await waitFor(() => {
        assertMessagesAreShown(
          [
            ...givenPreviousConversation.messages.map((message) => ({
              message_id: expect.any(String),
              type:
                message.sender === ConversationMessageSender.COMPASS
                  ? COMPASS_CHAT_MESSAGE_TYPE
                  : USER_CHAT_MESSAGE_TYPE,
              sender: message.sender,
              payload: {
                message_id: message.sender === ConversationMessageSender.COMPASS ? expect.any(String) : undefined,
                message: message.message,
                sent_at: message.sent_at,
                reaction: message.sender === ConversationMessageSender.COMPASS ? message.reaction : undefined,
              },
              component: expect.any(Function),
            })),
            {
              message_id: expect.any(String),
              type: USER_CHAT_MESSAGE_TYPE,
              sender: ConversationMessageSender.USER,
              payload: {
                message: givenMessage,
                sent_at: expect.any(String),
              },
              component: expect.any(Function),
            },
            ...givenSendMessageResponse.messages.map((message) => ({
              message_id: expect.any(String),
              type:
                message.sender === ConversationMessageSender.COMPASS
                  ? COMPASS_CHAT_MESSAGE_TYPE
                  : USER_CHAT_MESSAGE_TYPE,
              sender:
                message.sender === ConversationMessageSender.COMPASS
                  ? ConversationMessageSender.COMPASS
                  : ConversationMessageSender.USER,
              payload: {
                message_id: message.sender === ConversationMessageSender.COMPASS ? expect.any(String) : undefined,
                message: message.message,
                sent_at: message.sent_at,
                reaction: message.sender === ConversationMessageSender.COMPASS ? message.reaction : undefined,
              },
              component: expect.any(Function),
            })),
          ],
          true
        );
      });

      // AND expect that no errors or warnings were logged
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
      // AND no snackbar notification was shown
      expect(useSnackbar().enqueueSnackbar).not.toHaveBeenCalled();
      // AND expect that the chat input is cleared and enabled
      await waitFor(() => {
        expect(ChatMessageField as jest.Mock).toHaveBeenLastCalledWith(
          expect.objectContaining({
            isChatFinished: false,
            aiIsTyping: false,
          }),
          {}
        );
      });
    });

    test("should send a message successfully and receive a concluded conversation", async () => {
      // GIVEN a user is logged in
      const givenUser: TabiyaUser = getMockUser();
      AuthenticationStateService.getInstance().setUser(givenUser);
      // AND the user has an active session
      const givenActiveSessionId = 123;
      UserPreferencesStateService.getInstance().setUserPreferences(
        getMockUserPreferences(givenUser, givenActiveSessionId)
      );
      // AND the conversation history has some messages
      const givenPreviousConversation: ConversationResponse = getMockConversationResponse(
        [
          {
            message_id: nanoid(),
            message: "13a7d8b3-dcb8-4e5c-b377-97160eb2b814",
            sent_at: new Date().toISOString(),
            sender: ConversationMessageSender.COMPASS,
            reaction: null,
          },
          {
            message_id: nanoid(),
            message: "d27b6bf0-f060-4825-aeab-0f1b3d8e274d",
            sent_at: new Date().toISOString(),
            sender: ConversationMessageSender.COMPASS,
            reaction: null,
          },
          {
            message_id: nanoid(),
            message: "2c69dca6-fc07-4cdb-942c-0021c86ebe94",
            sent_at: new Date().toISOString(),
            sender: ConversationMessageSender.USER,
            reaction: null,
          },
          {
            message_id: nanoid(),
            message: "1c322d44-a232-494b-95be-af475abe36a8",
            sent_at: new Date().toISOString(),
            sender: ConversationMessageSender.COMPASS,
            reaction: null,
          },
        ],
        ConversationPhase.DIVE_IN,
        75
      );
      jest.spyOn(ChatService.getInstance(), "getChatHistory").mockResolvedValueOnce(givenPreviousConversation);
      // AND a chat service that can sends a message successfully
      const givenSendMessageResponse: ConversationResponse = {
        messages: [
          {
            message_id: nanoid(),
            message: "008f1449-4d70-4cc0-a876-553c11caad18",
            sent_at: new Date().toISOString(),
            sender: ConversationMessageSender.COMPASS,
            reaction: null,
          },
          {
            message_id: nanoid(),
            message: "51602db3-cf7f-490e-9ca8-4fae4427de30",
            sent_at: new Date().toISOString(),
            sender: ConversationMessageSender.COMPASS,
            reaction: null,
          },
        ],
        conversation_completed: true,
        conversation_conducted_at: new Date().toISOString(),
        experiences_explored: 3,
        current_phase: {
          percentage: 0,
          phase: ConversationPhase.INTRO,
          current: null,
          total: null,
        },
      };
      let resolveSendMessage!: (value: ConversationResponse) => void;
      const sendMessagePromise = new Promise<ConversationResponse>((resolve) => {
        resolveSendMessage = resolve;
      });
      jest.spyOn(ChatService.getInstance(), "sendMessage").mockResolvedValueOnce(sendMessagePromise);
      // AND the user has processed experiences
      const processedExperiences = mockExperiences
        .filter((exp) => exp.exploration_phase === DiveInPhase.PROCESSED)
        .slice(0, 2);
      mockGetExperiences.mockResolvedValueOnce(processedExperiences);

      // WHEN the component is mounted
      render(<Chat />);

      // THEN expect the Chat component to be initialized
      await assertChatInitialized();
      // AND the conversation history to be shown in the chat
      assertResponseMessagesAreShown(givenPreviousConversation, true);

      // AND WHEN the user types a message
      const givenMessage = "I loved the smell of the bread and the taste of the cake.";
      // AND the user sends the message
      act(() => {
        (ChatMessageField as jest.Mock).mock.calls.at(-1)[0].handleSend(givenMessage);
      });

      // THEN expect the send message method to be called with the user's message
      expect(ChatService.getInstance().sendMessage).toHaveBeenCalledWith(givenActiveSessionId, givenMessage);
      // AND expect the user's message and a typing indicator to be shown in the chat
      await waitFor(() => {
        assertMessagesAreShown(
          [
            ...givenPreviousConversation.messages.map((message) => ({
              message_id: expect.any(String),
              type:
                message.sender === ConversationMessageSender.COMPASS
                  ? COMPASS_CHAT_MESSAGE_TYPE
                  : USER_CHAT_MESSAGE_TYPE,
              sender: message.sender,
              payload: {
                message_id: message.sender === ConversationMessageSender.COMPASS ? expect.any(String) : undefined,
                message: message.message,
                sent_at: message.sent_at,
                reaction: message.sender === ConversationMessageSender.COMPASS ? message.reaction : undefined,
              },
              component: expect.any(Function),
            })),
            {
              message_id: expect.any(String),
              type: USER_CHAT_MESSAGE_TYPE,
              sender: ConversationMessageSender.USER,
              payload: {
                message: givenMessage,
                sent_at: expect.any(String),
              },
              component: expect.any(Function),
            },
            {
              message_id: expect.any(String),
              type: TYPING_CHAT_MESSAGE_TYPE,
              sender: ConversationMessageSender.COMPASS,
              payload: {
                waitBeforeThinking: undefined,
              },
              component: expect.any(Function),
            },
          ],
          true
        );
      });
      // AND the input field to be disabled
      expect(ChatMessageField as jest.Mock).toHaveBeenLastCalledWith(
        expect.objectContaining({ isChatFinished: false, aiIsTyping: true }),
        {}
      );

      // AND WHEN the send message promise resolves
      act(() => {
        resolveSendMessage(givenSendMessageResponse);
      });

      // THEN expect the previous conversation and the response from the chat service to be shown in the chat
      await waitFor(
        () => {
          assertMessagesAreShown(
            [
              ...givenPreviousConversation.messages.map((message) => ({
                message_id: expect.any(String),
                type: expect.any(String),
                sender: message.sender,
                payload: {
                  message_id: message.sender === ConversationMessageSender.COMPASS ? expect.any(String) : undefined,
                  message: message.message,
                  sent_at: message.sent_at,
                  reaction: message.sender === ConversationMessageSender.COMPASS ? message.reaction : undefined,
                },
                component: expect.any(Function),
              })),
              {
                message_id: expect.any(String),
                type: USER_CHAT_MESSAGE_TYPE,
                sender: ConversationMessageSender.USER,
                payload: {
                  message: givenMessage,
                  sent_at: expect.any(String),
                },
                component: expect.any(Function),
              },
              // the last message will be replaced with a conversation conclusion message
              ...givenSendMessageResponse.messages
                .filter((message, index) => index !== givenSendMessageResponse.messages.length - 1)
                .map((message) => ({
                  message_id: expect.any(String),
                  type: expect.any(String),
                  sender: message.sender,
                  payload: {
                    message_id: message.sender === ConversationMessageSender.COMPASS ? expect.any(String) : undefined,
                    message: message.message,
                    sent_at: message.sent_at,
                    reaction: message.sender === ConversationMessageSender.COMPASS ? message.reaction : undefined,
                  },
                  component: expect.any(Function),
                })),
              {
                message_id: expect.any(String),
                type: CONVERSATION_CONCLUSION_CHAT_MESSAGE_TYPE,
                sender: ConversationMessageSender.COMPASS,
                payload: {
                  message: expect.any(String),
                },
                component: expect.any(Function),
              },
            ],
            true
          );
        },
        { timeout: TYPING_BEFORE_CONCLUSION_MESSAGE_TIMEOUT * 2 }
      ); // TODO: fix. this is a workaround
      // AND expect input field to have been disabled
      await waitFor(() => {
        expect(ChatMessageField as jest.Mock).toHaveBeenLastCalledWith(
          expect.objectContaining({ isChatFinished: true, aiIsTyping: false }),
          {}
        );
      });
      // AND expect the experiences notification to be shown
      expect(ChatHeader as jest.Mock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          experiencesExplored: processedExperiences.length,
          exploredExperiencesNotification: true,
        }),
        {}
      );
      // AND expect the DownloadReportDropdown to be preloaded
      await waitFor(() => {
        expect(lazyWithPreload).toHaveBeenCalledWith(expect.any(Function));
      });
      expect((lazyWithPreload as jest.Mock).mock.results[0].value.preload).toHaveBeenCalled();

      // AND expect that no errors or warnings were logged
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
      // AND no snackbar notification was shown
      expect(useSnackbar().enqueueSnackbar).not.toHaveBeenCalled();
    });

    test("should handle send message error", async () => {
      // GIVEN a user is logged in
      const givenUser: TabiyaUser = getMockUser();
      AuthenticationStateService.getInstance().setUser(givenUser);
      // AND the user has an active session
      const givenActiveSessionId = 123;
      UserPreferencesStateService.getInstance().setUserPreferences(
        getMockUserPreferences(givenUser, givenActiveSessionId)
      );
      // AND the conversation history has some messages
      const givenPreviousConversation: ConversationResponse = getMockConversationResponse(
        [
          {
            message_id: nanoid(),
            message: "e8a727c6-1b49-4800-9925-03ee31f0a7b9",
            sent_at: new Date().toISOString(),
            sender: ConversationMessageSender.COMPASS,
            reaction: null,
          },
          {
            message_id: nanoid(),
            message: "91ca9c85-d27a-4987-b410-d687d13cbba6",
            sent_at: new Date().toISOString(),
            sender: ConversationMessageSender.COMPASS,
            reaction: null,
          },
          {
            message_id: nanoid(),
            message: "08731b79-2816-4d9d-9248-89fa6818634c",
            sent_at: new Date().toISOString(),
            sender: ConversationMessageSender.USER,
            reaction: null,
          },
          {
            message_id: nanoid(),
            message: "b7a59799-16c3-4bc0-bac4-8e8764053fb8",
            sent_at: new Date().toISOString(),
            sender: ConversationMessageSender.COMPASS,
            reaction: null,
          },
        ],
        ConversationPhase.DIVE_IN,
        75
      );
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

      // AND WHEN the user sends the message
      act(() => {
        (ChatMessageField as jest.Mock).mock.calls.at(-1)[0].handleSend(givenMessage);
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
        assertMessagesAreShown(
          [
            ...givenPreviousConversation.messages.map((message) => ({
              message_id: expect.any(String),
              type: expect.any(String),
              sender: message.sender,
              payload: {
                message_id: message.sender === ConversationMessageSender.COMPASS ? expect.any(String) : undefined,
                message: message.message,
                sent_at: message.sent_at,
                reaction: message.sender === ConversationMessageSender.COMPASS ? message.reaction : undefined,
              },
              component: expect.any(Function),
            })),
            {
              message_id: expect.any(String),
              type: ERROR_CHAT_MESSAGE_TYPE,
              sender: ConversationMessageSender.COMPASS,
              payload: {
                message: FIXED_MESSAGES_TEXT.PLEASE_REPEAT,
              },
              component: expect.any(Function),
            },
          ],
          true
        );
      });

      // AND expect no snackbar notification was shown
      expect(useSnackbar().enqueueSnackbar).not.toHaveBeenCalled();
      // AND expect the input field to be enabled
      expect(ChatMessageField as jest.Mock).toHaveBeenLastCalledWith(
        expect.objectContaining({ isChatFinished: false, aiIsTyping: false }),
        {}
      );
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
      UserPreferencesStateService.getInstance().setUserPreferences(
        getMockUserPreferences(givenUser, givenActiveSessionId)
      );
      // AND the conversation history has some messages
      const givenPreviousConversation: ConversationResponse = getMockConversationResponse(
        [
          {
            message_id: nanoid(),
            message: "90dac7d1-d396-4516-9078-00032539d8dc",
            sent_at: new Date().toISOString(),
            sender: ConversationMessageSender.COMPASS,
            reaction: null,
          },
        ],
        ConversationPhase.COLLECT_EXPERIENCES,
        50
      );
      jest.spyOn(ChatService.getInstance(), "getChatHistory").mockResolvedValueOnce(givenPreviousConversation);
      // AND the user has some experiences
      const givenExperiences = [
        {
          UUID: "1",
          timeline: {
            start: "2024-01-01",
            end: "2024-01-01",
          },
          experience_title: "Experience 1",
          company: "Company 1",
          location: "Location 1",
          work_type: WorkType.SELF_EMPLOYMENT,
          top_skills: [],
        },
      ];
      mockGetExperiences.mockResolvedValue(givenExperiences);

      // WHEN the component is rendered
      render(<Chat />);

      // THEN expect the Chat component to be initialized
      await assertChatInitialized();

      // AND the experiences button is clicked
      // we are using the last call to the ChatProvider mock because the first one is the initial call
      // and a bunch of calls are made when the component is re-rendered,
      // for example, due to the chat initialization
      act(() => {
        (ChatProvider as jest.Mock).mock.calls.at(-1)[0].handleOpenExperiencesDrawer();
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
            onExperiencesUpdated: expect.any(Function),
          },
          {}
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
      UserPreferencesStateService.getInstance().setUserPreferences(
        getMockUserPreferences(givenUser, givenActiveSessionId)
      );
      // AND the conversation history has some messages
      const givenPreviousConversation: ConversationResponse = {
        messages: [
          {
            message_id: nanoid(),
            message: "fad1a46e-1be8-43e8-a1d4-461a99322014",
            sent_at: new Date().toISOString(),
            sender: ConversationMessageSender.COMPASS,
            reaction: null,
          },
        ],
        conversation_completed: false,
        conversation_conducted_at: null,
        experiences_explored: 0,
        current_phase: {
          percentage: 0,
          phase: ConversationPhase.INTRO,
          current: null,
          total: null,
        },
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
      // we are using the last call to the ChatProvider mock because the first one is the initial call
      // and a bunch of calls are made when the component is re-rendered,
      // for example, due to the chat initialization
      act(() => {
        (ChatProvider as jest.Mock).mock.calls.at(-1)[0].handleOpenExperiencesDrawer();
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
      UserPreferencesStateService.getInstance().setUserPreferences(
        getMockUserPreferences(givenUser, givenActiveSessionId)
      );
      // AND the user preferences service will return a new session id
      const givenNewSessionId = 2000;
      const givenUserPreferences: UserPreference = {
        user_id: givenUser.id,
        accepted_tc: new Date(),
        has_sensitive_personal_data: false,
        language: Language.en,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
        sessions: [givenNewSessionId, givenActiveSessionId],
        user_feedback_answered_questions: {},
        experiments: {},
      };
      jest.spyOn(UserPreferencesService.getInstance(), "getNewSession").mockResolvedValueOnce(givenUserPreferences);

      // AND the conversation history has some messages for the current session, but is empty for the new session
      const givenInitialSessionChatHistoryResponse: ConversationResponse = getMockConversationResponse(
        [
          {
            message_id: nanoid(),
            message: "1584e645-e367-490d-bc5c-c14f41bc0e80",
            sent_at: new Date().toISOString(),
            sender: ConversationMessageSender.COMPASS,
            reaction: null,
          },
          {
            message_id: nanoid(),
            message: "904a1ceb-2bf0-478a-b28f-fa73c86efdb6",
            sent_at: new Date().toISOString(),
            sender: ConversationMessageSender.USER,
            reaction: null,
          },
        ],
        ConversationPhase.DIVE_IN,
        75
      );
      const givenNewSessionChatHistoryResponse: ConversationResponse = getMockConversationResponse(
        [],
        ConversationPhase.INTRO,
        0
      );
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
      const givenSendMessageResponse: ConversationResponse = getMockConversationResponse(
        [
          {
            message_id: nanoid(),
            message: "69eb00eb-4d55-44b2-bd47-0245df0ca9cc",
            sent_at: new Date().toISOString(),
            sender: ConversationMessageSender.COMPASS,
            reaction: null,
          },
        ],
        ConversationPhase.COLLECT_EXPERIENCES,
        25
      );
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

      // WHEN the user confirms,
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
      expect(ChatMessageField as jest.Mock).toHaveBeenLastCalledWith(
        expect.objectContaining({ isChatFinished: false, aiIsTyping: true }),
        {}
      );

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
      expect(ChatMessageField as jest.Mock).toHaveBeenLastCalledWith(
        expect.objectContaining({ isChatFinished: false, aiIsTyping: false }),
        {}
      );
    });

    test("should handle new conversation cancellation", async () => {
      // GIVEN a user is logged in
      const givenUser: TabiyaUser = getMockUser();
      AuthenticationStateService.getInstance().setUser(givenUser);
      // AND the user has an active session
      const givenActiveSessionId = 123;
      UserPreferencesStateService.getInstance().setUserPreferences(
        getMockUserPreferences(givenUser, givenActiveSessionId)
      );
      // AND a chat service that returns an existing conversation
      const givenPreviousConversation = getMockConversationResponse(
        [
          {
            message_id: nanoid(),
            message: "7f3f43fd-a203-4b4a-9f6a-da6dfb301558",
            sent_at: new Date().toISOString(),
            sender: ConversationMessageSender.COMPASS,
            reaction: {
              id: nanoid(),
              kind: ReactionKind.DISLIKED,
            },
          },
        ],
        ConversationPhase.DIVE_IN,
        75
      );
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
      assertMessagesAreShown(
        [
          ...givenPreviousConversation.messages.map((message) => ({
            message_id: message.message_id,
            sender: message.sender,
            type: COMPASS_CHAT_MESSAGE_TYPE,
            payload: {
              message_id: message.message_id,
              message: message.message,
              sent_at: message.sent_at,
              reaction: {
                id: message.reaction?.id,
                kind: message.reaction?.kind,
              },
            },
            component: expect.any(Function),
          })),
        ],
        true
      );
    });

    test("should handle new conversation error", async () => {
      // GIVEN a user is logged in
      const givenUser: TabiyaUser = getMockUser();
      AuthenticationStateService.getInstance().setUser(givenUser);
      // AND the user has an active session
      const givenActiveSessionId = 123;
      UserPreferencesStateService.getInstance().setUserPreferences(
        getMockUserPreferences(givenUser, givenActiveSessionId)
      );

      // AND a chat service that returns an existing conversation
      const givenPreviousConversation = getMockConversationResponse(
        [
          {
            message_id: nanoid(),
            message: "7a283c09-c4d4-4bf3-a480-1263e4d5282e",
            sent_at: new Date().toISOString(),
            sender: ConversationMessageSender.COMPASS,
            reaction: {
              id: nanoid(),
              kind: ReactionKind.LIKED,
            },
          },
        ],
        ConversationPhase.DIVE_IN,
        75
      );

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
        assertMessagesAreShown(
          [
            {
              message_id: expect.any(String),
              type: ERROR_CHAT_MESSAGE_TYPE,
              sender: ConversationMessageSender.COMPASS,
              payload: {
                message: FIXED_MESSAGES_TEXT.SOMETHING_WENT_WRONG,
              },
              component: expect.any(Function),
            },
          ],
          true
        );
      });

      // AND expect input field to have be disabled because the conversation is finished
      expect(ChatMessageField as jest.Mock).toHaveBeenLastCalledWith(
        expect.objectContaining({ isChatFinished: true }),
        {}
      );

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

  describe("handling inactivity backdrop", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test("should show inactive backdrop after inactivity timeout", async () => {
      // GIVEN a user is logged in
      const givenUser: TabiyaUser = getMockUser();
      AuthenticationStateService.getInstance().setUser(givenUser);
      // AND the user has an active session
      const givenActiveSessionId = 123;
      UserPreferencesStateService.getInstance().setUserPreferences(
        getMockUserPreferences(givenUser, givenActiveSessionId)
      );

      // AND the conversation history has some messages
      const givenMessages: ConversationResponse = getMockConversationResponse(
        [
          {
            message_id: nanoid(),
            message: "d3b57530-82ed-42b7-8621-95aeec4a60b4",
            sent_at: new Date().toISOString(),
            sender: ConversationMessageSender.USER,
            reaction: null,
          },
        ],
        ConversationPhase.DIVE_IN,
        75
      );
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
      UserPreferencesStateService.getInstance().setUserPreferences(
        getMockUserPreferences(givenUser, givenActiveSessionId)
      );

      // AND the conversation history has some messages
      const givenMessages: ConversationResponse = getMockConversationResponse(
        [
          {
            message_id: nanoid(),
            message: "5a7330e5-4f0c-4c1f-8a1c-f86d7ad59530",
            sent_at: new Date().toISOString(),
            sender: ConversationMessageSender.USER,
            reaction: null,
          },
        ],
        ConversationPhase.DIVE_IN,
        75
      );
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
          screen.queryByTestId(INACTIVE_BACKDROP_DATA_TEST_ID.INACTIVE_BACKDROP_CONTAINER)
        ).not.toBeInTheDocument();
      });
      // AND no errors or warnings were logged
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test.each([
      [
        "click",
        (userEventFakeTimer: UserEvent) => userEventFakeTimer.click(screen.getByTestId(DATA_TEST_ID.CHAT_CONTAINER)),
      ],
      [
        "type(foo)",
        (userEventFakeTimer: UserEvent) =>
          userEventFakeTimer.type(screen.getByTestId(DATA_TEST_ID.CHAT_CONTAINER), "foo"),
      ],
      [
        "type(Space)",
        (userEventFakeTimer: UserEvent) =>
          userEventFakeTimer.type(screen.getByTestId(DATA_TEST_ID.CHAT_CONTAINER), " "),
      ],
      [
        "type(enter)",
        (userEventFakeTimer: UserEvent) =>
          userEventFakeTimer.type(screen.getByTestId(DATA_TEST_ID.CHAT_CONTAINER), "\n"),
      ],
    ])("should hide backdrop on %s event", async (_, triggerEvent) => {
      // GIVEN a user is logged in
      const givenUser: TabiyaUser = getMockUser();
      AuthenticationStateService.getInstance().setUser(givenUser);
      // AND the user has an active session
      const givenActiveSessionId = 123;
      UserPreferencesStateService.getInstance().setUserPreferences(
        getMockUserPreferences(givenUser, givenActiveSessionId)
      );

      // AND a chat service with some messages
      const givenMessages: ConversationResponse = getMockConversationResponse(
        [
          {
            message_id: nanoid(),
            message: "ed1c8727-9716-4e69-8669-d8f6c8f4aabd",
            sent_at: new Date().toISOString(),
            sender: ConversationMessageSender.USER,
            reaction: null,
          },
        ],
        ConversationPhase.DIVE_IN,
        75
      );
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
        expect(screen.queryByTestId(INACTIVE_BACKDROP_DATA_TEST_ID.INACTIVE_BACKDROP_CONTAINER)).toBeVisible();
      });

      // WHEN the user interacts
      const userEventFakeTimer = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      act(() => {
        triggerEvent(userEventFakeTimer);
      });

      // THEN expect the backdrop to be hidden
      await waitFor(() => {
        expect(
          screen.queryByTestId(INACTIVE_BACKDROP_DATA_TEST_ID.INACTIVE_BACKDROP_CONTAINER)
        ).not.toBeInTheDocument();
      });
      // AND no errors or warnings were logged
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();

      // reset the timers
      jest.useRealTimers();
    });
  });

  describe("uploading a CV", () => {
    test("should upload a CV and add uploading CV message to chat", async () => {
      // GIVEN a logged-in user and active session
      const givenUser = getMockUser();
      AuthenticationStateService.getInstance().setUser(givenUser);
      const givenActiveSessionId = 123;
      UserPreferencesStateService.getInstance().setUserPreferences(
        getMockUserPreferences(givenUser, givenActiveSessionId)
      );

      // AND the conversation history has a welcome message
      const givenPreviousConversation: ConversationResponse = getMockConversationResponse(
        [
          {
            message_id: nanoid(),
            message: "90dac7d1-d396-4516-9078-00032539d8dc",
            sent_at: new Date().toISOString(),
            sender: ConversationMessageSender.COMPASS,
            reaction: null,
          },
        ],
        ConversationPhase.INTRO,
        0
      );
      jest.spyOn(ChatService.getInstance(), "getChatHistory").mockResolvedValueOnce(givenPreviousConversation);

      // AND a mock file to upload
      const file = new File(["dummy content"], "example.pdf", { type: "application/pdf" });
      // AND the upload service will resolve successfully
      jest.spyOn(CVService.getInstance(), "uploadCV").mockResolvedValueOnce(["line 1", "line 2"]);

      // WHEN the component is rendered
      render(<Chat />);
      // AND the Chat component is initialized
      await assertChatInitialized();
      // AND the file is uploaded via the ChatMessageField component
      await act(async () => {
        const onUploadCv = (ChatMessageField as jest.Mock).mock.calls.at(-1)[0].onUploadCv;
        await onUploadCv(file);
      });

      // THEN expect the upload service to be called with the file and user id
      expect(CVService.getInstance().uploadCV).toHaveBeenCalledWith(givenUser.id, file);
      // AND expect the snackbar messages to be shown
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith("Uploading example.pdf...", { variant: "info" });
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith("CV uploaded", { variant: "success" });
      // AND expect the success CV message to be added to the chat
      await waitFor(() => {
        assertMessagesAreShown(
          [
            {
              message_id: "success-cv-message-id",
              type: CV_TYPING_CHAT_MESSAGE_TYPE,
              sender: ConversationMessageSender.COMPASS,
              payload: {
                isUploaded: true,
              },
              component: expect.any(Function),
            },
          ],
          false
        );
      });
      // AND no errors or warnings were logged
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should handle CV upload failure gracefully", async () => {
      // GIVEN a logged-in user
      const givenUser = getMockUser();
      AuthenticationStateService.getInstance().setUser(givenUser);
      const givenActiveSessionId = 123;
      UserPreferencesStateService.getInstance().setUserPreferences(
        getMockUserPreferences(givenUser, givenActiveSessionId)
      );
      jest
        .spyOn(ChatService.getInstance(), "getChatHistory")
        .mockResolvedValueOnce(getMockConversationResponse([], ConversationPhase.INTRO, 0));

      // AND a mock file to upload
      const file = new File(["dummy content"], "example.pdf", { type: "application/pdf" });

      // AND the upload service will reject
      const uploadError = new Error("Upload failed");
      jest.spyOn(CVService.getInstance(), "uploadCV").mockRejectedValueOnce(uploadError);

      // WHEN the component is rendered
      render(<Chat />);
      // AND the Chat component is initialized
      await assertChatInitialized();
      // AND the CV file upload fails
      await act(async () => {
        const onUploadCv = (ChatMessageField as jest.Mock).mock.calls.at(-1)[0].onUploadCv;
        await onUploadCv(file);
      });

      // THEN expect the error to be logged
      expect(console.error).toHaveBeenCalledWith(uploadError);
      // AND expect the error snackbar to be shown
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith("Failed to upload CV. Please try again.", {
        variant: "error",
      });
    });
  });
});
