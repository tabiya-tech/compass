// mute the console
import "src/_test_utilities/consoleMock";

import ChatBubble, { DATA_TEST_ID } from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import { render, screen } from "src/_test_utilities/test-utils";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";

describe("render tests", () => {
  test("should render the Chat Bubble without a child if none is passed", () => {
    // GIVEN a message
    const givenMessage: string = "Hello, I'm Brújula";
    // AND a sender
    const givenSender: ConversationMessageSender = ConversationMessageSender.COMPASS;

    // WHEN the chat bubble is rendered
    render(<ChatBubble message={givenMessage} sender={givenSender} />);

    // THEN expect the message container to be visible
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_BUBBLE_CONTAINER)).toBeInTheDocument();
    // AND expect the message text to be visible
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_BUBBLE_MESSAGE_TEXT)).toBeInTheDocument();

    // AND expect the component to match the snapshot
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_BUBBLE_CONTAINER)).toMatchSnapshot();
  });

  test("should render the Chat Bubble with a child if one is passed", () => {
    // GIVEN a message
    const givenMessage: string = "Hello, I'm Brújula";
    // AND a sender
    const givenSender: ConversationMessageSender = ConversationMessageSender.COMPASS;
    // AND a footer
    const givenFooter = <div data-testid={"foo-footer"}>foo child</div>;

    // WHEN the chat bubble is rendered
    render(
      <ChatBubble message={givenMessage} sender={givenSender}>
        {givenFooter}
      </ChatBubble>
    );

    // THEN expect the message container to be visible
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_BUBBLE_CONTAINER)).toBeInTheDocument();
    // AND expect the message text to be visible
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_BUBBLE_MESSAGE_TEXT)).toBeInTheDocument();
    // AND expect the child container to be visible
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_BUBBLE_MESSAGE_FOOTER_CONTAINER)).toBeInTheDocument();
    // AND expect the child to be visible
    expect(screen.getByTestId(givenFooter.props["data-testid"])).toBeInTheDocument();

    // AND expect the component to match the snapshot
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_BUBBLE_CONTAINER)).toMatchSnapshot();
  });
});
