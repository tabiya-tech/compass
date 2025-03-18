// mute the console
import "src/_test_utilities/consoleMock";

import ChatList, { DATA_TEST_ID } from "./ChatList";
import { render, screen } from "src/_test_utilities/test-utils";
import UserChatMessage, {
  DATA_TEST_ID as USER_CHAT_MESSAGE_DATA_TEST_ID,
} from "src/chat/chatMessage/userChatMessage/UserChatMessage";
import CompassChatMessage, {
  DATA_TEST_ID as COMPASS_CHAT_MESSAGE_DATA_TEST_ID,
} from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import { nanoid } from "nanoid";
import { ChatMessageType } from "src/chat/Chat.types";
import ChatBubble, {
  DATA_TEST_ID as CHAT_BUBBLE_DATA_TEST_ID,
} from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import ConversationConclusionChatMessage from "src/chat/chatMessage/conversationConclusionChatMessage/ConversationConclusionChatMessage";
import { ReactionKind } from "src/chat/reaction/reaction.types";
import { ChatProvider } from "src/chat/ChatContext";
import TypingChatMessage from "src/chat/chatMessage/typingChatMessage/TypingChatMessage";

// mock the chat message component
jest.mock("src/chat/chatMessage/userChatMessage/UserChatMessage", () => {
  const originalModule = jest.requireActual("src/chat/chatMessage/userChatMessage/UserChatMessage");
  return {
    __esModule: true,
    ...originalModule,
    default: jest.fn(() => <div data-testid={originalModule.DATA_TEST_ID.CHAT_MESSAGE_CONTAINER}></div>),
  };
});

jest.mock("src/chat/chatMessage/compassChatMessage/CompassChatMessage", () => {
  const originalModule = jest.requireActual("src/chat/chatMessage/compassChatMessage/CompassChatMessage");
  return {
    __esModule: true,
    ...originalModule,
    default: jest.fn(() => <div data-testid={originalModule.DATA_TEST_ID.CHAT_MESSAGE_CONTAINER}></div>),
  };
});

jest.mock("src/chat/chatMessage/components/chatBubble/ChatBubble", () => {
  const originalModule = jest.requireActual("src/chat/chatMessage/components/chatBubble/ChatBubble");
  return {
    __esModule: true,
    ...originalModule,
    default: jest.fn(() => <div data-testid={originalModule.DATA_TEST_ID.CHAT_MESSAGE_BUBBLE_CONTAINER}></div>),
  };
});

jest.mock("src/chat/chatMessage/conversationConclusionChatMessage/ConversationConclusionChatMessage", () => {
  const originalModule = jest.requireActual(
    "src/chat/chatMessage/conversationConclusionChatMessage/ConversationConclusionChatMessage"
  );
  return {
    __esModule: true,
    ...originalModule,
    default: jest.fn(() => (
      <div data-testid={originalModule.DATA_TEST_ID.CONVERSATION_CONCLUSION_CHAT_MESSAGE_CONTAINER}></div>
    )),
  };
});

jest.mock("src/chat/chatMessage/typingChatMessage/TypingChatMessage", () => {
  const originalModule = jest.requireActual("src/chat/chatMessage/typingChatMessage/TypingChatMessage");
  return {
    __esModule: true,
    ...originalModule,
    default: jest.fn(() => <div data-testid={originalModule.DATA_TEST_ID.TYPING_CHAT_MESSAGE_CONTAINER}></div>),
  };
});

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

describe("ChatList", () => {
  beforeAll(() => {
    window.HTMLElement.prototype.scrollIntoView = jest.fn();
  });
  afterEach(() => {
    jest.clearAllMocks();
  });

  const mockHandleOpenExperiencesDrawer = jest.fn();

  test("should render the Chat List and show the appropriate message type for each message", () => {
    // GIVEN a message list
    const givenMessages = [
      {
        message_id: nanoid(),
        sender: ConversationMessageSender.USER,
        message: "Hello",
        sent_at: new Date().toISOString(),
        type: ChatMessageType.BASIC_CHAT,
        reaction: null,
      },
      {
        message_id: nanoid(),
        sender: ConversationMessageSender.COMPASS,
        message: "Hi, I'm Compass",
        sent_at: new Date().toISOString(),
        type: ChatMessageType.BASIC_CHAT,
        reaction: {
          id: nanoid(),
          kind: ReactionKind.DISLIKED,
        },
      },
      {
        message_id: nanoid(),
        sender: ConversationMessageSender.COMPASS,
        message: "Let's explore your experiences!",
        sent_at: new Date().toISOString(),
        type: ChatMessageType.BASIC_CHAT,
        reaction: null,
      },
      {
        message_id: nanoid(),
        sender: ConversationMessageSender.COMPASS,
        message: "Typing...",
        sent_at: new Date().toString(),
        type: ChatMessageType.TYPING,
        reaction: null,
      },
      {
        message_id: nanoid(),
        sender: ConversationMessageSender.COMPASS,
        message: "Thank you for using compass",
        sent_at: new Date().toString(),
        type: ChatMessageType.CONVERSATION_CONCLUSION,
        reaction: null,
      },
      {
        message_id: nanoid(),
        sender: ConversationMessageSender.COMPASS,
        message: "Error message",
        sent_at: new Date().toString(),
        type: ChatMessageType.ERROR,
        reaction: null,
      }
    ];

    // AND a function to notify when the reaction changes

    // WHEN the chat list is rendered
    render(
      <ChatProvider handleOpenExperiencesDrawer={mockHandleOpenExperiencesDrawer}>
        <ChatList messages={givenMessages} />
      </ChatProvider>
    );

    // THEN expect the chat list container to be visible
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_LIST_CONTAINER)).toBeInTheDocument();

    // AND expect the User Chat message component to be shown for each of the User chat messages
    const userChatMessages = screen.getAllByTestId(USER_CHAT_MESSAGE_DATA_TEST_ID.CHAT_MESSAGE_CONTAINER);
    expect(userChatMessages).toHaveLength(1);
    userChatMessages.forEach((chatMessage) => {
      expect(chatMessage).toBeInTheDocument();
    });

    // AND expect the User Chat message component to be called with the correct messages
    expect(UserChatMessage).toHaveBeenNthCalledWith(
      1,
      {
        chatMessage: givenMessages[0],
      },
      {}
    );

    // AND expect the Compass Chat message component to be shown for each of the compass chat messages
    const compassChatMessages = screen.getAllByTestId(COMPASS_CHAT_MESSAGE_DATA_TEST_ID.CHAT_MESSAGE_CONTAINER);
    expect(compassChatMessages).toHaveLength(2);
    compassChatMessages.forEach((chatMessage) => {
      expect(chatMessage).toBeInTheDocument();
    });
    // AND expect the Compass Chat message component to be called with the correct messages
    expect(CompassChatMessage).toHaveBeenNthCalledWith(
      1,
      {
        chatMessage: givenMessages[1],
      },
      {}
    );
    expect(CompassChatMessage).toHaveBeenNthCalledWith(
      2,
      {
        chatMessage: givenMessages[2],
      },
      {}
    );

    // AND expect the Typing Chat Message component to be rendered for the typing message
    expect(TypingChatMessage).toHaveBeenNthCalledWith(1, {}, {});

    // AND expect the Conversation Conclusion Chat Message component to be rendered for the conversation conclusion message
    expect(ConversationConclusionChatMessage).toHaveBeenNthCalledWith(
      1,
      {
        chatMessage: givenMessages[4],
      },
      {}
    );

    // AND expect the Chat Bubble component to be rendered for the error message
    expect(screen.getByTestId(CHAT_BUBBLE_DATA_TEST_ID.CHAT_MESSAGE_BUBBLE_CONTAINER)).toBeInTheDocument();
    // AND the chat bubble to be called with the correct message
    // --> The chat bubble is called by the other components as well, but since they are being mocked,
    // and since the typing message is the only one calling the "naked" bubble, we expect it to be the first time it's called
    expect(ChatBubble).toHaveBeenNthCalledWith(
      1,
      {
        message: givenMessages[5].message,
        sender: givenMessages[5].sender,
      },
      {}
    );

    // AND expect the scrollIntoView function to be called
    expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();

    // AND expect the component to match the snapshot
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_LIST_CONTAINER)).toMatchSnapshot();
  });

  test("should call resizeChatMessage when the window is resized", () => {
    // GIVEN a message list
    const givenMessages = [
      {
        message_id: nanoid(),
        sender: ConversationMessageSender.USER,
        message: "Hello",
        sent_at: new Date().toISOString(),
        type: ChatMessageType.BASIC_CHAT,
        reaction: null,
      },
      {
        message_id: nanoid(),
        sender: ConversationMessageSender.COMPASS,
        message: "Hi",
        sent_at: new Date().toISOString(),
        type: ChatMessageType.BASIC_CHAT,
        reaction: null,
      },
    ];
    // AND the chat list is rendered
    render(<ChatList messages={givenMessages} />);

    // WHEN the window is resized
    window.dispatchEvent(new Event("resize"));

    // THEN expect the scrollIntoView function to be called
    expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
  });
});
