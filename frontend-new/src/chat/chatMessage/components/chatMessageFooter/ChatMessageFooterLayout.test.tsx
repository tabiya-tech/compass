// mute the console
import "src/_test_utilities/consoleMock";

import ChatMessageFooter, { DATA_TEST_ID } from "src/chat/chatMessage/components/chatMessageFooter/ChatMessageFooterLayout";
import { render, screen } from "src/_test_utilities/test-utils";
import { Box } from "@mui/material";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";

describe("render tests", () => {
  // GIVEN some test children components
  const Child = (id: string) => <Box data-testid={id} key={id}>Child</Box>;

  test.each([
    {
      name: "without children",
      children: [],
      expectedTestIds: []
    },
    {
      name: "with a single child",
      children: [Child("foo-child-1")],
      expectedTestIds: ["foo-child-1"]
    },
    {
      name: "with multiple children",
      children: [Child("foo-child-1"), Child("foo-child-2")],
      expectedTestIds: ["foo-child-1", "foo-child-2"]
    }
  ])("should render a compass chat message footer %s", ({ children, expectedTestIds }) => {
    // WHEN the component is rendered
    render(<ChatMessageFooter sender={ConversationMessageSender.COMPASS}>{children}</ChatMessageFooter>);

    // THEN expect the container to be in the document
    const container = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FOOTER_LAYOUT_CONTAINER);
    expect(container).toBeInTheDocument();

    // AND expect all children to be rendered if any
    expectedTestIds.forEach(testId => {
      expect(screen.getByTestId(testId)).toBeInTheDocument();
    });

    // AND expect no errors or warnings
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();

    // AND expect the component to match snapshot
    expect(container).toMatchSnapshot();
  });

  test.each([
    {
      name: "without children",
      children: [],
      expectedTestIds: []
    },
    {
      name: "with a single child",
      children: [Child("foo-child-1")],
      expectedTestIds: ["foo-child-1"]
    },
    {
      name: "with multiple children",
      children: [Child("foo-child-1"), Child("foo-child-2")],
      expectedTestIds: ["foo-child-1", "foo-child-2"]
    }
  ])("should render a user chat message footer %s", ({ children, expectedTestIds }) => {
    // WHEN the component is rendered
    render(<ChatMessageFooter sender={ConversationMessageSender.USER}>{children}</ChatMessageFooter>);

    // THEN expect the container to be in the document
    const container = screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FOOTER_LAYOUT_CONTAINER);
    expect(container).toBeInTheDocument();

    // AND expect all children to be rendered if any
    expectedTestIds.forEach(testId => {
      expect(screen.getByTestId(testId)).toBeInTheDocument();
    });

    // AND expect no errors or warnings
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();

    // AND expect the component to match snapshot
    expect(container).toMatchSnapshot();
  });
});