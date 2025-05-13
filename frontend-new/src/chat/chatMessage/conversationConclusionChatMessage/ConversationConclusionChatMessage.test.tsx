// mute the console
import "src/_test_utilities/consoleMock";

import ConversationConclusionChatMessage, { CONVERSATION_CONCLUSION_CHAT_MESSAGE_TYPE, DATA_TEST_ID } from "./ConversationConclusionChatMessage";
import ConversationConclusionFooter from "src/chat/chatMessage/conversationConclusionChatMessage/conversationConclusionFooter/ConversationConclusionFooter";
import {
  DATA_TEST_ID as CHAT_BUBBLE_DATA_TEST_ID,
} from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import { render, screen } from "src/_test_utilities/test-utils";
import { nanoid } from "nanoid";

jest.mock("src/chat/chatMessage/components/chatBubble/ChatBubble", () => {
  const originalModule = jest.requireActual("src/chat/chatMessage/components/chatBubble/ChatBubble");
  return {
    __esModule: true,
    ...originalModule,
    default: jest.fn(({children}) => <div data-testid={originalModule.DATA_TEST_ID.CHAT_MESSAGE_BUBBLE_CONTAINER}>{children}</div>),
  };
});

jest.mock(
  "src/chat/chatMessage/conversationConclusionChatMessage/conversationConclusionFooter/ConversationConclusionFooter",
  () => {
    const originalModule = jest.requireActual(
      "src/chat/chatMessage/conversationConclusionChatMessage/conversationConclusionFooter/ConversationConclusionFooter"
    );
    return {
      __esModule: true,
      ...originalModule,
      default: jest.fn(() => (
        <div data-testid={originalModule.DATA_TEST_ID.CONVERSATION_CONCLUSION_FOOTER_CONTAINER}></div>
      )),
    };
  }
);

describe("render tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  })
  test("should render the Chat message", () => {
    // GIVEN a basic chat message sent at a given time
    const givenDate = new Date().toISOString();
    const messageData = {
      message_id: nanoid(),
      message: "Thanks for having a conversation with me.",
      sent_at: givenDate,
      type: CONVERSATION_CONCLUSION_CHAT_MESSAGE_TYPE,
      reaction: null
    };

    // WHEN the conversation conclusion chat message is rendered
    render(
      <ConversationConclusionChatMessage
        {...messageData}
      />
    );

    // THEN expect the message container to be visible
    expect(screen.getByTestId(DATA_TEST_ID.CONVERSATION_CONCLUSION_CHAT_MESSAGE_CONTAINER)).toBeInTheDocument();
    // AND expect the message bubble to be visible
    expect(screen.getByTestId(CHAT_BUBBLE_DATA_TEST_ID.CHAT_MESSAGE_BUBBLE_CONTAINER)).toBeInTheDocument();

    // AND expect the conversation conclusion footer to be visible
    expect(ConversationConclusionFooter).toHaveBeenCalledTimes(1);

    // AND expect the component to match the snapshot
    expect(screen.getByTestId(DATA_TEST_ID.CONVERSATION_CONCLUSION_CHAT_MESSAGE_CONTAINER)).toMatchSnapshot();
  });

  test("should render with feedback in progress", () => {
    // GIVEN a basic chat message sent at a given time
    const givenDate = new Date().toISOString();
    const messageData = {
      message_id: nanoid(),
      message: "Thanks for having a conversation with me.",
      sent_at: givenDate,
      type: CONVERSATION_CONCLUSION_CHAT_MESSAGE_TYPE,
      reaction: null
    };

    // WHEN the conversation conclusion chat message is rendered
    render(
      <ConversationConclusionChatMessage
        {...messageData}
      />
    );

    // THEN expect the conversation conclusion footer to be visible
    expect(ConversationConclusionFooter).toHaveBeenCalledTimes(1);
  });

  test("should render with feedback submitted", () => {
    // GIVEN a basic chat message sent at a given time
    const givenDate = new Date().toISOString();
    const messageData = {
      message_id: nanoid(),
      message: "Thanks for having a conversation with me.",
      sent_at: givenDate,
      type: CONVERSATION_CONCLUSION_CHAT_MESSAGE_TYPE,
      reaction: null
    };

    // WHEN the conversation conclusion chat message is rendered
    render(
        <ConversationConclusionChatMessage
          {...messageData}
        />
    );

    // THEN expect the conversation conclusion footer to be visible
    expect(ConversationConclusionFooter).toHaveBeenCalledTimes(1);
  });
});
