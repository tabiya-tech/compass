// mute the console
import "src/_test_utilities/consoleMock";

import ChatList, { DATA_TEST_ID } from "./ChatList";
import { render, screen } from "src/_test_utilities/test-utils";
import BasicChatMessage, {
  DATA_TEST_ID as BASIC_CHAT_MESSAGE_DATA_TEST_ID,
} from "src/chat/chatMessage/basicChatMessage/BasicChatMessage";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import { nanoid } from "nanoid";
import { ChatMessageType } from "src/chat/Chat.types";
import ChatBubble, {
  DATA_TEST_ID as CHAT_BUBBLE_DATA_TEST_ID,
} from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import ConversationConclusionChatMessage from "src/chat/chatMessage/conversationConclusionChatMessage/ConversationConclusionChatMessage";

// mock the chat message component
jest.mock("src/chat/chatMessage/basicChatMessage/BasicChatMessage", () => {
  const originalModule = jest.requireActual("src/chat/chatMessage/basicChatMessage/BasicChatMessage");
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

  test("should render the Chat List and show the appropriate message type for each message", () => {
    // GIVEN a message list
    const givenMessages = [
      {
        id: nanoid(),
        sender: ConversationMessageSender.USER,
        message: "Hello",
        sent_at: new Date().toISOString(),
        type: ChatMessageType.BASIC_CHAT,
      },
      {
        id: nanoid(),
        sender: ConversationMessageSender.COMPASS,
        message: "Hi",
        sent_at: new Date().toISOString(),
        type: ChatMessageType.BASIC_CHAT,
      },
      {
        id: nanoid(),
        sender: ConversationMessageSender.COMPASS,
        message: "Typing...",
        sent_at: new Date().toString(),
        type: ChatMessageType.TYPING,
      },
      {
        id: nanoid(),
        sender: ConversationMessageSender.COMPASS,
        message: "Thank you for using compass",
        sent_at: new Date().toString(),
        type: ChatMessageType.CONVERSATION_CONCLUSION,
      },
    ];
    // AND a function to open the feedback form
    const givenNotifyOpenFeedbackForm = jest.fn();

    // WHEN the chat list is rendered
    render(<ChatList messages={givenMessages} notifyOnFeedbackFormOpened={givenNotifyOpenFeedbackForm} />);

    // THEN expect the chat list container to be visible
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_LIST_CONTAINER)).toBeInTheDocument();

    // AND expect the Basic Chat message component to be shown for each of the Basic chat messages
    const basicChatMessages = screen.getAllByTestId(BASIC_CHAT_MESSAGE_DATA_TEST_ID.CHAT_MESSAGE_CONTAINER);
    expect(basicChatMessages).toHaveLength(2);
    basicChatMessages.forEach((chatMessage) => {
      expect(chatMessage).toBeInTheDocument();
    });
    // THEN expect the Basic Chat message component to be called with the correct messages
    expect(BasicChatMessage).toHaveBeenNthCalledWith(
      1,
      {
        chatMessage: givenMessages[0],
      },
      {}
    );
    expect(BasicChatMessage).toHaveBeenNthCalledWith(
      2,
      {
        chatMessage: givenMessages[1],
      },
      {}
    );

    // AND expect the Chat Bubble component to be rendered for the typing message
    expect(screen.getByTestId(CHAT_BUBBLE_DATA_TEST_ID.CHAT_MESSAGE_BUBBLE_CONTAINER)).toBeInTheDocument();
    // AND the chat bubble to be called with the correct message
    // --> The chat bubble is called by the other components as well, but since they are being mocked,
    // and since the typing message is the only one calling the "naked" bubble, we expect it to be the first time it's called
    expect(ChatBubble).toHaveBeenNthCalledWith(
      1,
      {
        message: givenMessages[2].message,
        sender: givenMessages[2].sender,
      },
      {}
    );

    // AND expect the Conversation Conclusion Chat Message component to be rendered for the conversation conclusion message
    expect(ConversationConclusionChatMessage).toHaveBeenNthCalledWith(
      1,
      {
        chatMessage: givenMessages[3],
        notifyOnFeedbackFormOpened: givenNotifyOpenFeedbackForm,
      },
      {}
    );

    // AND expect the scrollIntoView function to be called
    expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();

    // AND expect the component to match the snapshot
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_LIST_CONTAINER)).toMatchSnapshot();
  });
});
