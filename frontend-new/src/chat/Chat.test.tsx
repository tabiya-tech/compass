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

jest.mock("src/chat/ChatService/ChatService", () => {
  return jest.fn().mockImplementation(() => {
    return {
      sendMessage: jest.fn().mockResolvedValue({
        message_for_user: "Hello, I'm Compass",
      }),
      getSessionId: jest.fn().mockReturnValue("1234"),
    };
  });
});

// mock the ChatList component
jest.mock("src/chat/ChatList/ChatList", () => {
  const originalModule = jest.requireActual("src/chat/ChatList/ChatList");
  return {
    __esModule: true,
    ...originalModule,
    default: jest.fn(() => <div data-testid={originalModule.DATA_TEST_ID.CHAT_LIST_CONTAINER}></div>),
  };
});

test("should render the Chat Header", () => {
  // WHEN the chat header is rendered
  render(<Chat />);

  // THEN expect no errors or warning to have occurred
  expect(console.error).not.toHaveBeenCalled();
  expect(console.warn).not.toHaveBeenCalled();
  // AND the chat container to be visible
  expect(screen.getByTestId(DATA_TEST_ID.CHAT_CONTAINER)).toBeInTheDocument();
  // AND the chat header to be in the document
  expect(screen.getByTestId(CHAT_HEADER_TEST_ID.CHAT_HEADER_CONTAINER)).toBeInTheDocument();
});
