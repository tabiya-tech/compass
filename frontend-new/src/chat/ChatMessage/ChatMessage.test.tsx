// mute the console
import "src/_test_utilities/consoleMock";

import ChatMessage, { DATA_TEST_ID } from "./ChatMessage";
import { render, screen } from "src/_test_utilities/test-utils";
import { ChatMessageOrigin } from "src/chat/Chat.types";
import * as getDurationBetweenDates from "src/utils/getDurationBetweenDates";

describe("render tests", () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2020, 3, 1));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  test("should render the Chat message with timestamp when typing is set to false", () => {
    // WHEN the chat header is rendered
    const givenDate = new Date(2024, 6, 25).getTime();
    const givenMessage = {
      id: 1,
      origin: ChatMessageOrigin.COMPASS,
      message: "Hello, I'm Compass",
      timestamp: givenDate,
    };

    jest.spyOn(getDurationBetweenDates, "getDurationBetweenDates").mockReturnValue("Some Date");

    render(<ChatMessage chatMessage={givenMessage} isTyping={false} />);

    // THEN expect the chat header to be visible
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_CONTAINER)).toBeInTheDocument();
    // AND expect the timeout to be visible
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_TIMESTAMP)).toBeInTheDocument();
    // AND the getDurationBetweenDates to have been called with the given date
    expect(getDurationBetweenDates.getDurationBetweenDates).toHaveBeenCalledWith(new Date(givenDate), new Date());
    // AND the correct date to have been displayed
    expect(screen.getByText("sent Some Date", { exact: false })).toBeInTheDocument();
    // AND expect the message to be visible
    expect(screen.getByText(givenMessage.message)).toBeInTheDocument();
  });
  test("should render the Chat message without a timestamp when typing is set to true", () => {
    // WHEN the chat header is rendered
    const givenMessage = {
      id: 1,
      origin: ChatMessageOrigin.COMPASS,
      message: "Hello, I'm Compass",
      timestamp: Date.now(),
    };

    render(<ChatMessage chatMessage={givenMessage} isTyping={true} />);

    // THEN expect the chat header to be visible
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_CONTAINER)).toBeInTheDocument();

    // AND expect the timeout to not be visible
    expect(screen.queryByTestId(DATA_TEST_ID.CHAT_MESSAGE_TIMESTAMP)).not.toBeInTheDocument();
  });
});
