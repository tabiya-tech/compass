// mute the console
import "src/_test_utilities/consoleMock";

// Mock react-markdown and remark-gfm to avoid ESM compatibility issues with Jest.
// The real library is used in the browser; here we simulate bold rendering for assertions.
jest.mock("react-markdown", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: ({ children }: { children: string }) => {
      const parts = children.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
      return (
        <div>
          {parts.map((part: string, i: number) => {
            const boldMatch = part.match(/^\*\*([^*]+)\*\*$/);
            const codeMatch = part.match(/^`([^`]+)`$/);
            if (boldMatch) return <strong key={i}>{boldMatch[1]}</strong>;
            if (codeMatch) return <code key={i}>{codeMatch[1]}</code>;
            return part;
          })}
        </div>
      );
    },
  };
});
jest.mock("remark-gfm", () => ({ __esModule: true, default: () => {} }));

import ChatBubble, { DATA_TEST_ID } from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import { render, screen } from "src/_test_utilities/test-utils";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";

describe("render tests", () => {
  test("should render the Chat Bubble without a child if none is passed", () => {
    // GIVEN a message
    const givenMessage: string = "Hello, I'm Compass";
    // AND a sender
    const givenSender: ConversationMessageSender = ConversationMessageSender.COMPASS;

    // WHEN the chat bubble is rendered
    render(<ChatBubble message={givenMessage} sender={givenSender} />);

    // THEN expect the message container to be visible
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_BUBBLE_CONTAINER)).toBeInTheDocument();
    // AND expect the message text to be visible
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_BUBBLE_MESSAGE_TEXT)).toBeInTheDocument();

    // AND expect the component to match the snapshot
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_BUBBLE_CONTAINER)).toMatchSnapshot();
  });

  test("should render the Chat Bubble with a child if one is passed", () => {
    // GIVEN a message
    const givenMessage: string = "Hello, I'm Compass";
    // AND a sender
    const givenSender: ConversationMessageSender = ConversationMessageSender.COMPASS;
    // AND a footer
    const givenFooter = <div data-testid={"foo-footer"}>foo child</div>;

    // WHEN the chat bubble is rendered
    render(
      <ChatBubble message={givenMessage} sender={givenSender}>
        {givenFooter}
      </ChatBubble>
    );

    // THEN expect the message container to be visible
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_BUBBLE_CONTAINER)).toBeInTheDocument();
    // AND expect the message text to be visible
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_BUBBLE_MESSAGE_TEXT)).toBeInTheDocument();
    // AND expect the child container to be visible
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_BUBBLE_MESSAGE_FOOTER_CONTAINER)).toBeInTheDocument();
    // AND expect the child to be visible
    expect(screen.getByTestId(givenFooter.props["data-testid"])).toBeInTheDocument();

    // AND expect the component to match the snapshot
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_BUBBLE_CONTAINER)).toMatchSnapshot();
  });

  test("should render bold markdown as <strong> in COMPASS messages", () => {
    // GIVEN a message with bold markdown formatting
    const givenMessage: string = "You are a **Farm producer** with great skills.";
    // AND the sender is COMPASS (AI)
    const givenSender: ConversationMessageSender = ConversationMessageSender.COMPASS;

    // WHEN the chat bubble is rendered
    render(<ChatBubble message={givenMessage} sender={givenSender} />);

    // THEN expect the bold text to be rendered as a <strong> element, not as raw asterisks
    expect(screen.getByText("Farm producer").tagName).toBe("STRONG");
    // AND expect the raw asterisks not to appear in the document
    expect(screen.queryByText(/\*\*Farm producer\*\*/)).not.toBeInTheDocument();
  });

  test("should render inline code markdown as <code> in COMPASS messages", () => {
    // GIVEN a message with inline code formatting (backticks)
    const givenMessage: string = "Use `git status` to check your changes.";
    // AND the sender is COMPASS (AI)
    const givenSender: ConversationMessageSender = ConversationMessageSender.COMPASS;

    // WHEN the chat bubble is rendered
    render(<ChatBubble message={givenMessage} sender={givenSender} />);

    // THEN expect the code text to be rendered as a <code> element, not raw backticks
    expect(screen.getByText("git status").tagName).toBe("CODE");
    // AND expect the raw backticks not to appear in the document
    expect(screen.queryByText(/`git status`/)).not.toBeInTheDocument();
  });

  test("should NOT render markdown in USER messages", () => {
    // GIVEN a message with bold markdown formatting
    const givenMessage: string = "I have **experience** in farming.";
    // AND the sender is USER
    const givenSender: ConversationMessageSender = ConversationMessageSender.USER;

    // WHEN the chat bubble is rendered
    render(<ChatBubble message={givenMessage} sender={givenSender} />);

    // THEN expect the message to be rendered as plain text (no markdown processing for user messages)
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_BUBBLE_MESSAGE_TEXT)).toHaveTextContent(givenMessage);
  });
});
