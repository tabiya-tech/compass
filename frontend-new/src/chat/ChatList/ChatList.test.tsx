// mute the console
import "src/_test_utilities/consoleMock";

import ChatList, { DATA_TEST_ID } from "./ChatList";
import { render, screen } from "src/_test_utilities/test-utils";
import { ChatMessageOrigin } from "../Chat.types";

test("should render the Chat Header", () => {
  // GIVEN a message list, a clear message function, a send message function, and a typing status
  const givenMessages = [
    {
      id: 1,
      origin: ChatMessageOrigin.ME,
      message: "Hello",
      timestamp: Date.now(),
    },
    {
      id: 2,
      origin: ChatMessageOrigin.COMPASS,
      message: "Hi",
      timestamp: Date.now(),
    },
  ];
  const givenClearMessages = jest.fn();
  const givenSendMessage = jest.fn();
  const givenIsTyping = false;
  // WHEN the chat header is rendered
  render(
    <ChatList
      messages={givenMessages}
      sendMessage={givenSendMessage}
      clearMessages={givenClearMessages}
      isTyping={givenIsTyping}
    />
  );

  // THEN expect the chat header to be visible
  expect(screen.getByTestId(DATA_TEST_ID.CHAT_LIST_CONTAINER)).toBeInTheDocument();
});
