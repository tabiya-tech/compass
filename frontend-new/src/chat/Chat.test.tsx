// mute the console
import "src/_test_utilities/consoleMock";

import Chat, { DATA_TEST_ID } from "./Chat";
import { render, screen } from "src/_test_utilities/test-utils";
import { DATA_TEST_ID as CHAT_HEADER_TEST_ID } from "./ChatHeader/ChatHeader";

// mock chat header
jest.mock("src/chat/ChatHeader/ChatHeader", () => {
  const actual = jest.requireActual("src/chat/ChatHeader/ChatHeader");
  const mockedChatHeader = jest
    .fn()
    .mockImplementation(() => <div data-testid={actual.DATA_TEST_ID.CHAT_HEADER_CONTAINER}>Mocked ChatHeader</div>);

  return {
    __esModule: true,
    ...actual,
    default: mockedChatHeader,
  };
});

test("should render the Chat", () => {
  // WHEN the chat is rendered
  render(<Chat />);

  // THEN expect no errors or warning to have occurred
  expect(console.error).not.toHaveBeenCalled();
  expect(console.warn).not.toHaveBeenCalled();
  // AND the chat container to be visible
  expect(screen.getByTestId(DATA_TEST_ID.CHAT_CONTAINER)).toBeInTheDocument();
  // AND the chat header to be in the document
  expect(screen.getByTestId(CHAT_HEADER_TEST_ID.CHAT_HEADER_CONTAINER)).toBeInTheDocument();
});
