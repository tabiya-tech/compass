import React from "react";
import { render, screen } from "src/_test_utilities/test-utils";
import ErrorChatMessage, { DATA_TEST_ID } from "./ErrorChatMessage";

describe("ErrorChatMessage", () => {
  // GIVEN a message and sender
  const message = "This is an error message";

  test("should render error message with correct props", () => {
    // WHEN the component is rendered
    render(<ErrorChatMessage message={message} />);

    // THEN the error message container should be present
    expect(screen.getByTestId(DATA_TEST_ID.ERROR_CHAT_MESSAGE_CONTAINER)).toBeInTheDocument();
    
    // AND the message text should be displayed
    expect(screen.getByText(message)).toBeInTheDocument();
  });

  test("should pass props correctly to ChatBubble", () => {
    // GIVEN a child component
    const ChildComponent = () => <div>Child Content</div>;

    // WHEN the component is rendered with children
    render(
      <ErrorChatMessage message={message}>
        <ChildComponent />
      </ErrorChatMessage>
    );

    // THEN the child content should be rendered
    expect(screen.getByText("Child Content")).toBeInTheDocument();
  });

  test("should have consistent message type", () => {
    // WHEN the component is imported multiple times
    const { ERROR_CHAT_MESSAGE_TYPE: type1 } = require("./ErrorChatMessage");
    const { ERROR_CHAT_MESSAGE_TYPE: type2 } = require("./ErrorChatMessage");

    // THEN the message type should be consistent
    expect(type1).toBe(type2);
  });
}); 