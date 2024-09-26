// mute the console
import "src/_test_utilities/consoleMock";

import ChatMessage, { DATA_TEST_ID } from "./ChatMessage";
import { render, screen } from "src/_test_utilities/test-utils";
import * as GetDurationFromNow from "src/utils/getDurationFromNow/getDurationFromNow";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import { nanoid } from "nanoid";

jest.mock("src/auth/services/socialAuth/SocialAuth.service", () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => {
      return {
        logout: jest.fn(),
      };
    }),
  };
});

describe("render tests", () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2020, 3, 1));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  test("should render the Chat message with sent_at when typing is set to false", () => {
    // WHEN the chat header is rendered
    const givenDate = new Date(2024, 6, 25).toISOString();
    const givenMessage = {
      id: nanoid(),
      sender: ConversationMessageSender.COMPASS,
      message: "Hello, I'm Compass",
      sent_at: givenDate,
    };

    jest.spyOn(GetDurationFromNow, "getDurationFromNow").mockReturnValue("Some Date");

    render(<ChatMessage chatMessage={givenMessage} isTyping={false} />);

    // THEN expect the chat header to be visible
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_CONTAINER)).toBeInTheDocument();
    // AND expect the timeout to be visible
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_TIMESTAMP)).toBeInTheDocument();
    // AND the getDurationBetweenDates to have been called with the given date
    expect(GetDurationFromNow.getDurationFromNow).toHaveBeenCalledWith(new Date(givenDate));
    // AND the correct date to have been displayed
    expect(screen.getByText("sent Some Date", { exact: false })).toBeInTheDocument();
    // AND expect the message to be visible
    expect(screen.getByText(givenMessage.message)).toBeInTheDocument();

    // AND expect the component to match the snapshot
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_CONTAINER)).toMatchSnapshot();
  });
  test("should render the Chat message without a sent_at when typing is set to true", () => {
    // WHEN the chat header is rendered
    const givenMessage = {
      id: nanoid(),
      sender: ConversationMessageSender.COMPASS,
      message: "Hello, I'm Compass",
      sent_at: new Date().toISOString(),
    };

    render(<ChatMessage chatMessage={givenMessage} isTyping={true} />);

    // THEN expect the chat header to be visible
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_CONTAINER)).toBeInTheDocument();

    // AND expect the timeout to not be visible
    expect(screen.queryByTestId(DATA_TEST_ID.CHAT_MESSAGE_TIMESTAMP)).not.toBeInTheDocument();
  });
});
