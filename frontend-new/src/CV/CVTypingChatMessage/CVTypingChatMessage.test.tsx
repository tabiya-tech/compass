// mute the console
import "src/_test_utilities/consoleMock";

import { render, screen } from "src/_test_utilities/test-utils";
import CVTypingChatMessage, { DATA_TEST_ID, UI_TEXT } from "src/CV/CVTypingChatMessage/CVTypingChatMessage";
import i18n from "src/i18n/i18n";
import { DATA_TEST_ID as CHAT_BUBBLE_DATA_TEST_ID } from "src/chat/chatMessage/components/chatBubble/ChatBubble";

// mock chat bubble component
jest.mock("src/chat/chatMessage/components/chatBubble/ChatBubble", () => {
  const originalModule = jest.requireActual("src/chat/chatMessage/components/chatBubble/ChatBubble");
  return {
    __esModule: true,
    ...originalModule,
    default: jest.fn(({ children }) => (
      <div data-testid={originalModule.DATA_TEST_ID.CHAT_MESSAGE_BUBBLE_CONTAINER}>{children}</div>
    )),
  };
});

describe("CVTypingChatMessage", () => {
  test("should render the CV Typing Chat message correctly when CV is uploading", () => {
    // GIVEN a CV Typing Chat message component
    const givenComponent = <CVTypingChatMessage isUploaded={false} />;

    // WHEN the CV Typing Chat message is rendered
    render(givenComponent);

    // THEN expect the message container to be visible
    const cvTypingChatMessageContainer = screen.getByTestId(DATA_TEST_ID.CV_TYPING_CHAT_MESSAGE_CONTAINER);
    expect(cvTypingChatMessageContainer).toBeInTheDocument();
    // AND expect the message bubble to be visible
    expect(screen.getByTestId(CHAT_BUBBLE_DATA_TEST_ID.CHAT_MESSAGE_BUBBLE_CONTAINER)).toBeInTheDocument();
    // AND expect the uploading CV text to be displayed
  expect(screen.getByText(i18n.t(UI_TEXT.UPLOADING_CV) as string)).toBeInTheDocument();
    // AND expect to find 3 dots (periods)
    const dots = screen.getAllByText(".");
    expect(dots).toHaveLength(3);
    // AND the component to match the snapshot
    expect(cvTypingChatMessageContainer).toMatchSnapshot();
    // THEN expect no errors or warnings to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should render the CV Typing Chat message correctly when CV is uploaded", () => {
    // GIVEN the CV is uploaded
    const isUploaded = true;
    // AND a CV Typing Chat message component
    const givenComponent = <CVTypingChatMessage isUploaded={isUploaded} />;

    // WHEN the CV Typing Chat message is rendered
    render(givenComponent);

    // THEN expect the message container to be visible
    const cvTypingChatMessageContainer = screen.getByTestId(DATA_TEST_ID.CV_TYPING_CHAT_MESSAGE_CONTAINER);
    expect(cvTypingChatMessageContainer).toBeInTheDocument();
    // AND expect the message bubble to be visible
    expect(screen.getByTestId(CHAT_BUBBLE_DATA_TEST_ID.CHAT_MESSAGE_BUBBLE_CONTAINER)).toBeInTheDocument();
    // AND expect the CV uploaded text to be displayed
  expect(screen.getByText(i18n.t(UI_TEXT.CV_UPLOADED) as string)).toBeInTheDocument();
    // AND the component to match the snapshot
    expect(cvTypingChatMessageContainer).toMatchSnapshot();
    // THEN expect no errors or warnings to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });
});
