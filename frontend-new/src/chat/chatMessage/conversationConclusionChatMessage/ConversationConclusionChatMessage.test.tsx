// mute the console
import "src/_test_utilities/consoleMock";

import ConversationConclusionChatMessage, { DATA_TEST_ID } from "./ConversationConclusionChatMessage";
import ConversationConclusionFooter from "src/chat/chatMessage/conversationConclusionChatMessage/conversationConclusionFooter/ConversationConclusionFooter";
import ChatBubble, {
  DATA_TEST_ID as CHAT_BUBBLE_DATA_TEST_ID,
} from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import { render, screen } from "src/_test_utilities/test-utils";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import { nanoid } from "nanoid";
import { ChatMessageType, IChatMessage } from "src/chat/Chat.types";

jest.mock("src/chat/chatMessage/components/chatBubble/ChatBubble", () => {
  const originalModule = jest.requireActual("src/chat/chatMessage/components/chatBubble/ChatBubble");
  return {
    __esModule: true,
    ...originalModule,
    default: jest.fn(() => <div data-testid={originalModule.DATA_TEST_ID.CHAT_MESSAGE_BUBBLE_CONTAINER}></div>),
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
  test("should render the Chat message", () => {
    // GIVEN a basic chat message sent at a given time
    const givenDate = new Date().toISOString();
    const givenMessage: IChatMessage = {
      id: nanoid(),
      sender: ConversationMessageSender.COMPASS,
      message: "Thanks for having a conversation with me.",
      sent_at: givenDate,
      type: ChatMessageType.CONVERSATION_CONCLUSION, // This component is designed for use with the Conversation conclusion chat type
    };
    // AND a callback to notify when the feedback form is opened
    const givenNotifyOnFeedbackFormOpen = jest.fn();
    // AND a callback to notify when the experiences drawer is opened
    const givenNotifyOnExperiencesDrawerOpen = jest.fn();

    // WHEN the conversation conclusion chat message is rendered
    render(
      <ConversationConclusionChatMessage
        chatMessage={givenMessage}
        notifyOnFeedbackFormOpen={givenNotifyOnFeedbackFormOpen}
        notifyOnExperiencesDrawerOpen={givenNotifyOnExperiencesDrawerOpen}
        isFeedbackSubmitted={false}
        isFeedbackStarted={false}
      />
    );

    // THEN expect the message container to be visible
    expect(screen.getByTestId(DATA_TEST_ID.CONVERSATION_CONCLUSION_CHAT_MESSAGE_CONTAINER)).toBeInTheDocument();
    // AND expect the message bubble to be visible
    expect(screen.getByTestId(CHAT_BUBBLE_DATA_TEST_ID.CHAT_MESSAGE_BUBBLE_CONTAINER)).toBeInTheDocument();

    // AND expect the conversation conclusion footer to be visible
    const call = (ChatBubble as jest.Mock).mock.calls.at(-1)[0];
    expect(call.children).toEqual(
      expect.objectContaining({
        type: ConversationConclusionFooter,
        props: expect.objectContaining({
          notifyOnFeedbackFormOpen: givenNotifyOnFeedbackFormOpen,
          notifyOnExperiencesDrawerOpen: givenNotifyOnExperiencesDrawerOpen,
          isFeedbackSubmitted: false,
          isFeedbackStarted: false,
        }),
      })
    );

    // AND expect the Chat bubble to have been rendered with the expected message
    expect(call).toEqual(
      expect.objectContaining({
        message: givenMessage.message,
        sender: givenMessage.sender,
      })
    );

    // AND expect the component to match the snapshot
    expect(screen.getByTestId(DATA_TEST_ID.CONVERSATION_CONCLUSION_CHAT_MESSAGE_CONTAINER)).toMatchSnapshot();
  });
});
