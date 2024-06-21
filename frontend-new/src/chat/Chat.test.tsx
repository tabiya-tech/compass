// mute the console
import "src/_test_utilities/consoleMock";

import Chat, { DATA_TEST_ID } from "./Chat";
import { render, screen } from "src/_test_utilities/test-utils";

test("should render the Chat Header", () => {
  // WHEN the chat header is rendered
  render(<Chat />);

  // THEN expect the chat header to be visible
  expect(screen.getByTestId(DATA_TEST_ID.CHAT_CONTAINER)).toBeInTheDocument();
});
