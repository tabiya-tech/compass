// mute the console
import "src/_test_utilities/consoleMock";

import ChatMessage, { DATA_TEST_ID } from "./ChatMessage";
import { render, screen } from "src/_test_utilities/test-utils";
import { ChatMessageOrigin } from "./ChatMessage.types";

test("should render the Chat Header", () => {
  // WHEN the chat header is rendered
  const givenMessageOrigin = ChatMessageOrigin.ME;
  const givenMessage = "foo bar";
  const givenTime = new Date();
  render(<ChatMessage message={givenMessage} origin={givenMessageOrigin} time={givenTime} />);

  // THEN expect the chat header to be visible
  expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_CONTAINER)).toBeInTheDocument();
});
