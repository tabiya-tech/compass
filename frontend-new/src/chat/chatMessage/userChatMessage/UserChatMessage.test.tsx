// mute the console
import "src/_test_utilities/consoleMock";

import UserChatMessage, { DATA_TEST_ID, USER_CHAT_MESSAGE_TYPE } from "./UserChatMessage";
import ChatMessageFooter, {
  DATA_TEST_ID as CHAT_MESSAGE_FOOTER_DATA_TEST_ID,
} from "src/chat/chatMessage/components/chatMessageFooter/ChatMessageFooterLayout";
import ChatBubble, {
  DATA_TEST_ID as CHAT_BUBBLE_DATA_TEST_ID,
} from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import { render, screen } from "src/_test_utilities/test-utils";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import { nanoid } from "nanoid";
import Timestamp from "src/chat/chatMessage/components/chatMessageFooter/components/timestamp/Timestamp";

jest.mock("src/chat/chatMessage/components/chatMessageFooter/ChatMessageFooterLayout", () => {
  const originalModule = jest.requireActual("src/chat/chatMessage/components/chatMessageFooter/ChatMessageFooterLayout");
  return {
    __esModule: true,
    ...originalModule,
    default: jest.fn(() => <div data-testid={originalModule.DATA_TEST_ID.CHAT_MESSAGE_FOOTER_LAYOUT_CONTAINER}></div>),
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

jest.mock("src/chat/chatMessage/components/chatMessageFooter/components/timestamp/Timestamp", () => {
  const originalModule = jest.requireActual("src/chat/chatMessage/components/chatMessageFooter/components/timestamp/Timestamp");
  return {
    __esModule: true,
    ...originalModule,
    default: jest.fn(() => <div data-testid={originalModule.DATA_TEST_ID.TIMESTAMP}></div>),
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

  test("should render the User Chat message with a timestamp", () => {
    // GIVEN a user chat message sent at a given time
    const givenDate = new Date(2024, 6, 25).toISOString();
    const messageData = {
      message_id: nanoid(),
      sender: ConversationMessageSender.COMPASS,
      message: "Hello, I'm Brújula",
      sent_at: givenDate,
      type: USER_CHAT_MESSAGE_TYPE,
      reaction: null,
    };
    // WHEN the user chat message is rendered
    render(<UserChatMessage {...messageData} />);

    // THEN expect the message container to be visible
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_CONTAINER)).toBeInTheDocument();
    // AND expect the message bubble to be visible
    expect(screen.getByTestId(CHAT_BUBBLE_DATA_TEST_ID.CHAT_MESSAGE_BUBBLE_CONTAINER)).toBeInTheDocument();
    // AND expect the footer to be visible
    expect(screen.getByTestId(CHAT_MESSAGE_FOOTER_DATA_TEST_ID.CHAT_MESSAGE_FOOTER_LAYOUT_CONTAINER)).toBeInTheDocument();

    // AND the footer to have been called with a timestamp component
    const footerCall = (ChatMessageFooter as jest.Mock).mock.calls[0][0];
    expect(footerCall.children.type).toBe(Timestamp);
    expect(footerCall.children.props).toEqual({ sentAt: givenDate });

    // AND expect the Chat bubble to have been rendered with the expected message
    expect(ChatBubble).toHaveBeenNthCalledWith(
      1,
      {
        message: messageData.message,
        sender: ConversationMessageSender.USER,
      },
      {}
    );

    // AND expect the component to match the snapshot
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_CONTAINER)).toMatchSnapshot();
  });
});
