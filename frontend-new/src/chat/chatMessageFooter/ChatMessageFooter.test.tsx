// mute the console
import "src/_test_utilities/consoleMock";

import { render, screen } from "src/_test_utilities/test-utils";
import ChatMessageFooter, { DATA_TEST_ID } from "src/chat/chatMessageFooter/ChatMessageFooter";

describe("ChatMessageFooter", () => {
  test("should render component successfully with default props", () => {
    // GIVEN a ChatMessageFooter component
    const givenComponent = (
      <ChatMessageFooter>
        {" "}
        <div>Test children</div>v
      </ChatMessageFooter>
    );

    // WHEN the component is rendered
    render(givenComponent);

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    // AND the chat message footer component to be displayed
    const chatMessageFooterComponent = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FOOTER);
    expect(chatMessageFooterComponent).toBeInTheDocument();
    // AND the divider to be displayed
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FOOTER_DIVIDER)).toBeInTheDocument();
    // AND the children to be displayed
    expect(screen.getByText("Test children")).toBeInTheDocument();
    // AND the component to match the snapshot
    expect(chatMessageFooterComponent).toMatchSnapshot();
  });
});
