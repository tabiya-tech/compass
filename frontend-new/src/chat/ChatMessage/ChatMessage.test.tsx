// mute the console
import "src/_test_utilities/consoleMock";

import ChatMessage, { DATA_TEST_ID } from "./ChatMessage";
import { render, screen } from "src/_test_utilities/test-utils";
import { ChatMessageOrigin } from "src/chat/Chat.types";

test("should render the Chat Header", () => {
  // WHEN the chat header is rendered
  const givenMessage = {
    id: 1,
    origin: ChatMessageOrigin.COMPASS,
    message: "Hello, I'm Compass",
    timestamp: Date.now(),
  };

  render(<ChatMessage chatMessage={givenMessage} />);

  // THEN expect the chat header to be visible
  expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_CONTAINER)).toBeInTheDocument();
});
