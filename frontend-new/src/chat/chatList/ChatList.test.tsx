// mute the console
import "src/_test_utilities/consoleMock";

import React from "react";
import { render, screen } from "src/_test_utilities/test-utils";
import { ChatProvider } from "src/chat/ChatContext";
import ChatList, { DATA_TEST_ID } from "./ChatList";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import { ChatMessageType, IChatMessage } from "src/chat/Chat.types";
import { nanoid } from "nanoid";
import CompassChatMessage, {
  DATA_TEST_ID as COMPASS_CHAT_MESSAGE_DATA_TEST_ID,
} from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";
import UserChatMessage, {
  DATA_TEST_ID as USER_CHAT_MESSAGE_DATA_TEST_ID,
} from "src/chat/chatMessage/userChatMessage/UserChatMessage";
import ChatBubble, {
  DATA_TEST_ID as CHAT_BUBBLE_DATA_TEST_ID,
} from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import { ReactionKind } from "src/chat/reaction/reaction.types";
import TypingChatMessage from "../chatMessage/typingChatMessage/TypingChatMessage";
import ConversationConclusionChatMessage from "../chatMessage/conversationConclusionChatMessage/ConversationConclusionChatMessage";

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
    const userMessageData = {
      message_id: nanoid(),
      sender: ConversationMessageSender.USER,
      message: "Hello",
      sent_at: givenDate,
      type: ChatMessageType.BASIC_CHAT,
      reaction: null,
    };

    // AND compass message data with reaction
    const compassMessageData = {
      message_id: nanoid(),
      sender: ConversationMessageSender.COMPASS,
      message: "Hi, I'm Compass",
      sent_at: givenDate,
      type: ChatMessageType.BASIC_CHAT,
      reaction: {
        id: nanoid(),
        kind: ReactionKind.DISLIKED,
      },
    };

    // AND another compass message data
    const compassMessageData2 = {
      message_id: nanoid(),
      sender: ConversationMessageSender.COMPASS,
      message: "Let's explore your experiences!",
      sent_at: givenDate,
      type: ChatMessageType.BASIC_CHAT,
      reaction: null,
    };

    // AND typing message data
    const typingMessageData = {
      message_id: nanoid(),
      sender: ConversationMessageSender.COMPASS,
      message: "Typing...",
      sent_at: givenDate,
      type: ChatMessageType.TYPING,
      reaction: null,
    };

    // AND conclusion message data
    const conclusionMessageData = {
      message_id: nanoid(),
      sender: ConversationMessageSender.COMPASS,
      message: "Thank you for using compass",
      sent_at: givenDate,
      type: ChatMessageType.CONVERSATION_CONCLUSION,
      reaction: null,
    };

    // AND error message data
    const errorMessageData = {
      message_id: nanoid(),
      sender: ConversationMessageSender.COMPASS,
      message: "Error message",
      sent_at: givenDate,
      type: ChatMessageType.ERROR,
      reaction: null,
    };

    // AND create full messages with components
    const givenMessages: IChatMessage[] = [
      {
        ...userMessageData,
        component: <UserChatMessage chatMessage={userMessageData} />,
      },
      {
        ...compassMessageData,
        component: <CompassChatMessage chatMessage={compassMessageData} />,
      },
      {
        ...compassMessageData2,
        component: <CompassChatMessage chatMessage={compassMessageData2} />,
      },
      {
        ...typingMessageData,
        component: <TypingChatMessage waitBeforeThinking={15000} />,
      },
      {
        ...conclusionMessageData,
        component: <ConversationConclusionChatMessage chatMessage={conclusionMessageData} />,
      },
      {
        ...errorMessageData,
        component: <ChatBubble message={errorMessageData.message} sender={errorMessageData.sender} />,
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
        chatMessage: {
          message_id: expect.any(String),
          sender: ConversationMessageSender.USER,
          message: "Hello",
          sent_at: givenDate,
          type: ChatMessageType.BASIC_CHAT,
          reaction: null,
        },
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
      {
        chatMessage: compassMessageData,
      },
      {}
    );
    expect(CompassChatMessage).toHaveBeenNthCalledWith(
      2,
      {
        chatMessage: compassMessageData2,
      },
      {}
    );

    // AND expect the Typing Chat Message component to be rendered
    expect(TypingChatMessage).toHaveBeenCalledWith({ waitBeforeThinking: 15000 }, {});

    // AND expect the Conversation Conclusion Chat Message component to be rendered
    expect(ConversationConclusionChatMessage).toHaveBeenCalledWith(
      {
        chatMessage: conclusionMessageData,
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
    // GIVEN a message list with one message
    const givenDate = new Date().toISOString();
    const givenUserMessageData = {
      message_id: nanoid(),
      sender: ConversationMessageSender.USER,
      message: "Hello",
      sent_at: givenDate,
      type: ChatMessageType.BASIC_CHAT,
      reaction: null
    }
    const givenCompassMessageData = {
      message_id: nanoid(),
      sender: ConversationMessageSender.COMPASS,
      message: "Hi",
      sent_at: new Date().toISOString(),
      type: ChatMessageType.BASIC_CHAT,
      reaction: null,
    }
    const givenMessages: IChatMessage[] = [
      {
        ...givenUserMessageData,
        component: <UserChatMessage chatMessage={givenUserMessageData} />
      },
      {
        ...givenCompassMessageData,
        component: <CompassChatMessage chatMessage={givenCompassMessageData} />
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
