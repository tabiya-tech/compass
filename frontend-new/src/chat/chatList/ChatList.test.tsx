// mute the console
import "src/_test_utilities/consoleMock";

import React from "react";
import { render, screen } from "src/_test_utilities/test-utils";
import { ChatProvider } from "src/chat/ChatContext";
import ChatList, { DATA_TEST_ID } from "./ChatList";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import { IChatMessage } from "src/chat/Chat.types";
import { nanoid } from "nanoid";
import { USER_CHAT_MESSAGE_TYPE } from "src/chat/chatMessage/userChatMessage/UserChatMessage";
import { COMPASS_CHAT_MESSAGE_TYPE } from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";
import { TYPING_CHAT_MESSAGE_TYPE } from "src/chat/chatMessage/typingChatMessage/TypingChatMessage";
import { ERROR_CHAT_MESSAGE_TYPE } from "src/chat/chatMessage/errorChatMessage/ErrorChatMessage";
import { CONVERSATION_CONCLUSION_CHAT_MESSAGE_TYPE } from "src/chat/chatMessage/conversationConclusionChatMessage/ConversationConclusionChatMessage";
import CompassChatMessage, {
  DATA_TEST_ID as COMPASS_CHAT_MESSAGE_DATA_TEST_ID,
  CompassChatMessageProps,
} from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";
import UserChatMessage, {
  DATA_TEST_ID as USER_CHAT_MESSAGE_DATA_TEST_ID,
  UserChatMessageProps,
} from "src/chat/chatMessage/userChatMessage/UserChatMessage";
import ChatBubble, {
  DATA_TEST_ID as CHAT_BUBBLE_DATA_TEST_ID,
  ChatBubbleProps,
} from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import { ReactionKind } from "src/chat/reaction/reaction.types";
import TypingChatMessage, { TypingChatMessageProps } from "../chatMessage/typingChatMessage/TypingChatMessage";
import ConversationConclusionChatMessage, { ConversationConclusionChatMessageProps } from "../chatMessage/conversationConclusionChatMessage/ConversationConclusionChatMessage";

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
  const mockRemoveMessage = jest.fn();
  const mockAddMessage = jest.fn();

  test("should render the Chat List and show the appropriate message type for each message", () => {
    // GIVEN message data for different types of messages
    const givenDate = new Date().toISOString();
    
    // AND user message data
    const userMessageData: UserChatMessageProps = {
      message: "Hello",
      sent_at: givenDate,
    };

    // AND compass message data with reaction
    const compassMessageData: CompassChatMessageProps = {
      message_id: nanoid(),
      message: "Hi, I'm Compass",
      sent_at: givenDate,
      reaction: {
        id: nanoid(),
        kind: ReactionKind.DISLIKED,
      },
    };

    // AND another compass message data
    const compassMessageData2: CompassChatMessageProps = {
      message_id: nanoid(),
      message: "Let's explore your experiences!",
      sent_at: givenDate,
      reaction: null,
    };

    // AND typing message data
    const typingMessageData: TypingChatMessageProps = {
      waitBeforeThinking: 15000,
    };

    // AND conclusion message data
    const conclusionMessageData: ConversationConclusionChatMessageProps = {
      message: "Thank you for using compass",
    };

    // AND error message data
    const errorMessageData: ChatBubbleProps = {
      message: "Error message",
      sender: ConversationMessageSender.COMPASS,
    };

    // AND create full messages with components
    const givenMessages: IChatMessage<any>[] = [
      {
        type: USER_CHAT_MESSAGE_TYPE,
        message_id: nanoid(),
        sender: ConversationMessageSender.USER,
        payload: userMessageData,
        component: (props) => <UserChatMessage {...(props as UserChatMessageProps)} />,
      },
      {
        type: COMPASS_CHAT_MESSAGE_TYPE,
        message_id: nanoid(),
        sender: ConversationMessageSender.COMPASS,
        payload: compassMessageData,
        component: (props) => <CompassChatMessage {...(props as CompassChatMessageProps)} />,
      },
      {
        type: COMPASS_CHAT_MESSAGE_TYPE,
        message_id: nanoid(),
        sender: ConversationMessageSender.COMPASS,
        payload: compassMessageData2,
        component: (props) => <CompassChatMessage {...(props as CompassChatMessageProps)} />,
      },
      {
        type: TYPING_CHAT_MESSAGE_TYPE,
        message_id: nanoid(),
        sender: ConversationMessageSender.COMPASS,
        payload: typingMessageData,
        component: (props) => <TypingChatMessage {...(props as TypingChatMessageProps)} />,
      },
      {
        type: CONVERSATION_CONCLUSION_CHAT_MESSAGE_TYPE,
        message_id: nanoid(),
        sender: ConversationMessageSender.COMPASS,
        payload: conclusionMessageData,
        component: (props) => <ConversationConclusionChatMessage {...(props as ConversationConclusionChatMessageProps)} />,
      },
      {
        type: ERROR_CHAT_MESSAGE_TYPE,
        message_id: nanoid(),
        sender: ConversationMessageSender.COMPASS,
        payload: errorMessageData,
        component: (props) => <ChatBubble {...(props as ChatBubbleProps)} />,
      },
    ];

    // WHEN the chat list is rendered
    render(
      <ChatProvider
        handleOpenExperiencesDrawer={mockHandleOpenExperiencesDrawer}
        removeMessage={mockRemoveMessage}
        addMessage={mockAddMessage}
      >
        <ChatList messages={givenMessages} />
      </ChatProvider>
    );

    // THEN expect the chat list container to be visible
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_LIST_CONTAINER)).toBeInTheDocument();

    // AND expect the User Chat message component to be shown
    const userChatMessages = screen.getAllByTestId(USER_CHAT_MESSAGE_DATA_TEST_ID.CHAT_MESSAGE_CONTAINER);
    expect(userChatMessages).toHaveLength(1);
    userChatMessages.forEach((chatMessage) => {
      expect(chatMessage).toBeInTheDocument();
    });

    // AND expect the User Chat message component to be called with the correct messages
    expect(UserChatMessage).toHaveBeenNthCalledWith(
      1,
      {
        message: "Hello",
        sent_at: givenDate,
      },
      {}
    );

    // AND expect the Compass Chat message components to be shown
    const compassChatMessages = screen.getAllByTestId(COMPASS_CHAT_MESSAGE_DATA_TEST_ID.CHAT_MESSAGE_CONTAINER);
    expect(compassChatMessages).toHaveLength(2);
    compassChatMessages.forEach((chatMessage) => {
      expect(chatMessage).toBeInTheDocument();
    });

    // AND expect the Compass Chat message components to be called with the correct messages
    expect(CompassChatMessage).toHaveBeenNthCalledWith(
      1,
      compassMessageData,
      {}
    );
    expect(CompassChatMessage).toHaveBeenNthCalledWith(
      2,
        compassMessageData2,
      {}
    );

    // AND expect the Typing Chat Message component to be rendered
    expect(TypingChatMessage).toHaveBeenCalledWith({ waitBeforeThinking: 15000 }, {});

    // AND expect the Conversation Conclusion Chat Message component to be rendered
    expect(ConversationConclusionChatMessage).toHaveBeenCalledWith(
      conclusionMessageData,
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
        message: (givenMessages[5] as IChatMessage<ChatBubbleProps>).payload.message,
        sender: (givenMessages[5] as IChatMessage<ChatBubbleProps>).payload.sender,
      },
      {}
    );

    // AND expect the scrollIntoView function to be called
    expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();

    // AND expect the component to match the snapshot
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_LIST_CONTAINER)).toMatchSnapshot();
  });

  test("should call resizeChatMessage when the window is resized", () => {
    // GIVEN a message list with one message
    const givenDate = new Date().toISOString();
    const givenUserMessageData = {
      message_id: nanoid(),
      sender: ConversationMessageSender.USER,
      message: "Hello",
      sent_at: givenDate,
      type: USER_CHAT_MESSAGE_TYPE,
      reaction: null
    }
    const givenCompassMessageData = {
      message_id: nanoid(),
      sender: ConversationMessageSender.COMPASS,
      message: "Hi",
      sent_at: new Date().toISOString(),
      type: USER_CHAT_MESSAGE_TYPE,
      reaction: null,
    }
    const givenMessages: IChatMessage<any>[] = [
      {
        type: USER_CHAT_MESSAGE_TYPE,
        message_id: nanoid(),
        sender: ConversationMessageSender.USER,
        payload: givenUserMessageData,
        component: (props) => <UserChatMessage {...(props as UserChatMessageProps)} />,
      },
      {
        type: USER_CHAT_MESSAGE_TYPE,
        message_id: nanoid(),
        sender: ConversationMessageSender.COMPASS,
        payload: givenCompassMessageData,
        component: (props) => <CompassChatMessage {...(props as CompassChatMessageProps)} />,
      }
    ];

    // WHEN the chat list is rendered
    render(
      <ChatProvider
        handleOpenExperiencesDrawer={mockHandleOpenExperiencesDrawer}
        removeMessage={mockRemoveMessage}
        addMessage={mockAddMessage}
      >
        <ChatList messages={givenMessages} />
      </ChatProvider>
    );

    // AND the window is resized
    window.dispatchEvent(new Event("resize"));

    // THEN expect the scrollIntoView function to be called
    expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
  });
});
