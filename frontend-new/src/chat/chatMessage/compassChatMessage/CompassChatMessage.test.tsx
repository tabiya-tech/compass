// mute the console
import "src/_test_utilities/consoleMock";

import CompassChatMessage, { DATA_TEST_ID } from "./CompassChatMessage";
import ChatMessageFooter, {
  ChatMessageFooterChildren,
  DATA_TEST_ID as CHAT_MESSAGE_FOOTER_DATA_TEST_ID,
} from "src/chat/chatMessage/components/chatMessageFooter/ChatMessageFooter";
import ChatBubble, { DATA_TEST_ID  as CHAT_BUBBLE_DATA_TEST_ID } from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import { render, screen } from "src/_test_utilities/test-utils";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import { nanoid } from "nanoid";
import { ChatMessageType, IChatMessage } from "src/chat/Chat.types";

jest.mock("src/chat/chatMessage/components/chatMessageFooter/ChatMessageFooter", () => {
  const originalModule = jest.requireActual("src/chat/chatMessage/components/chatMessageFooter/ChatMessageFooter");
  return {
    __esModule: true,
    ...originalModule,
    default: jest.fn(() => <div data-testid={originalModule.DATA_TEST_ID.CHAT_MESSAGE_FOOTER_CONTAINER}></div>),
  }
})

jest.mock("src/chat/chatMessage/components/chatBubble/ChatBubble", () => {
  const originalModule = jest.requireActual("src/chat/chatMessage/components/chatBubble/ChatBubble");
  return {
    __esModule: true,
    ...originalModule,
    default: jest.fn(() => <div data-testid={originalModule.DATA_TEST_ID.CHAT_MESSAGE_BUBBLE_CONTAINER}></div>),
  }
})

describe("render tests", () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2020, 3, 1));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  test("should render the Compass Chat message with a timestamp", () => {
    // GIVEN a compass chat message sent at a given time
    const givenDate = new Date(2024, 6, 25).toISOString();
    const givenMessage: IChatMessage = {
      message_id: nanoid(),
      sender: ConversationMessageSender.COMPASS,
      message: "Hello, I'm Compass",
      sent_at: givenDate,
      type: ChatMessageType.BASIC_CHAT, // This component is designed for use with the BASIC chat type,
      reaction: null // User messages can never have a reaction
    };
    // WHEN the user chat message is rendered
    render(<CompassChatMessage chatMessage={givenMessage}/>);

    // THEN expect the message container to be visible
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_CONTAINER)).toBeInTheDocument();
    // AND expect the message bubble to be visible
    expect(screen.getByTestId(CHAT_BUBBLE_DATA_TEST_ID.CHAT_MESSAGE_BUBBLE_CONTAINER)).toBeInTheDocument();
    // AND expect the message footer to be visible
    expect(screen.getByTestId(CHAT_MESSAGE_FOOTER_DATA_TEST_ID.CHAT_MESSAGE_FOOTER_CONTAINER)).toBeInTheDocument();

    // AND the correct date to have been displayed
    expect(ChatMessageFooter).toHaveBeenNthCalledWith(
      1,
      {
        sentAt: givenDate,
        messageId: givenMessage.message_id,
        visibleChildren: [ChatMessageFooterChildren.TIMESTAMP, ChatMessageFooterChildren.REACTIONS],
        currentReaction: givenMessage.reaction
      },
      {}
    )
    // AND expect the Chat bubble to have been rendered with the expected message
    expect(ChatBubble).toHaveBeenNthCalledWith(
      1,
      {
        message: givenMessage.message,
        sender: givenMessage.sender
      },
      {}
    )

    // AND expect the component to match the snapshot
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_CONTAINER)).toMatchSnapshot();
  });
});
