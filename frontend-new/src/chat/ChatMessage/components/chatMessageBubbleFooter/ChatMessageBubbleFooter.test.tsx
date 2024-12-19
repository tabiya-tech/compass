import "src/_test_utilities/consoleMock";

import { render, screen } from "src/_test_utilities/test-utils";
import ChatMessageBubbleFooter, { DATA_TEST_ID } from "./ChatMessageBubbleFooter";
import { ChatMessageFooterType } from "src/chat/ChatMessage/ChatMessage";
import { DATA_TEST_ID as FEEDBACK_FORM_BUTTON_DATA_TEST_ID } from "src/feedback/feedbackForm/components/feedbackFormButton/FeedbackFormFooter";

describe("ChatMessageBubbleFooter", () => {
  test("should render component with feedback form button", () => {
    // GIVEN a ChatMessageBubbleFooter component with feedback form button type
    const givenNotifyOpenFeedbackForm = jest.fn();

    // WHEN the component is rendered
    render(
      <ChatMessageBubbleFooter
        footerType={ChatMessageFooterType.FEEDBACK_FORM}
        notifyOpenFeedbackForm={givenNotifyOpenFeedbackForm}
      />
    );

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();

    // AND expect the footer container to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_BUBBLE_FOOTER)).toBeInTheDocument();

    // AND expect the divider to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_BUBBLE_FOOTER_DIVIDER)).toBeInTheDocument();

    // AND expect the feedback form footer to be in the document
    expect(screen.getByTestId(FEEDBACK_FORM_BUTTON_DATA_TEST_ID.FEEDBACK_FORM_FOOTER_CONTAINER)).toBeInTheDocument();

    // AND expect the component to match the snapshot
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_BUBBLE_FOOTER)).toMatchSnapshot();
  });
});
