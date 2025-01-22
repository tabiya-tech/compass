// mute the console
import "src/_test_utilities/consoleMock";

import Timestamp , { DATA_TEST_ID } from "src/chat/chatMessage/components/chatMessageFooter/components/timestamp/Timestamp";
import { render, screen } from "src/_test_utilities/test-utils";
import { getDurationFromNow } from "src/chat/chatMessage/components/chatMessageFooter/components/timestamp/getDurationFromNow/getDurationFromNow";

jest.mock("src/chat/chatMessage/components/chatMessageFooter/components/timestamp/getDurationFromNow/getDurationFromNow", () => {
  return {
    getDurationFromNow: jest.fn()
  }
})

describe("render tests", () => {
  test("should render the Chat Message Timestamp without a child if none is passed", () => {
    // GIVEN a sent at time
    const givenSentAt: string = new Date().toISOString()

    // AND a getDurationFromNow function that returns a given duration string
    const givenDuration = "a foo years ago";
    (getDurationFromNow as jest.Mock).mockReturnValueOnce(givenDuration);

    // WHEN the Chat Message Timestamp is rendered
    render(<Timestamp sentAt={givenSentAt} />);

    // THEN expect the timestamp to be visible
    expect(screen.getByTestId(DATA_TEST_ID.TIMESTAMP)).toBeInTheDocument();
    // AND expect the getDurationFromNow method to have been called with the given sentAt as a Date object
    expect(getDurationFromNow).toHaveBeenCalledWith(new Date(givenSentAt));
    // AND expect the given duration to be shown
    expect(screen.getByTestId(DATA_TEST_ID.TIMESTAMP)).toHaveTextContent(givenDuration);

    // AND expect the component to match the snapshot
    expect(screen.getByTestId(DATA_TEST_ID.TIMESTAMP)).toMatchSnapshot();
  });
});