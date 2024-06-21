// mute the console
import "src/_test_utilities/consoleMock";

import ChatMessageField, { DATA_TEST_ID } from "./ChatMessageField";
import { render, screen } from "src/_test_utilities/test-utils";

test("should render the Chat Header", () => {
  // WHEN the chat header is rendered
  render(<ChatMessageField />);

  // THEN expect the chat header to be visible
  expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FIELD_CONTAINER)).toBeInTheDocument();
});
