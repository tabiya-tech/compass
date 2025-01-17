// mute the console
import "src/_test_utilities/consoleMock";

import ChatMessageFooter, { ChatMessageFooterChildren, DATA_TEST_ID } from "./ChatMessageFooter";
import { render, screen } from "src/_test_utilities/test-utils";
import { getDurationFromNow } from "src/utils/getDurationFromNow/getDurationFromNow";
import { ReactionType } from "src/feedback/reaction/reaction.types";
import ReactionButtons, {
  DATA_TEST_ID as REACTION_BUTTONS_DATA_TEST_ID,
} from "src/feedback/reaction/components/reactionButtons/ReactionButtons";
import { ReactionResponse } from "src/chat/ChatService/ChatService.types";

jest.mock("src/utils/getDurationFromNow/getDurationFromNow", () => {
  return {
    getDurationFromNow: jest.fn(),
  };
});

jest.mock("src/feedback/reaction/components/reactionButtons/ReactionButtons", () => {
  const actual = jest.requireActual("src/feedback/reaction/components/reactionButtons/ReactionButtons");

  return {
    __esModule: true,
    ...actual,
    default: jest.fn().mockImplementation(() => <div data-testid={actual.DATA_TEST_ID.CONTAINER} />),
  };
});

describe("ChatMessageFooter", () => {
  const mockProps = {
    sentAt: new Date().toISOString(),
    messageId: "test-message-id",
    visibleChildren: [] as ChatMessageFooterChildren[],
    currentReaction: null as ReactionResponse | null,
    "data-testid": "test-footer",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // TIMESTAMP TESTS
  describe("timestamp rendering", () => {
    test("should render timestamp when TIMESTAMP is in visibleChildren", () => {
      // GIVEN a duration string
      const givenDuration = "2 hours ago";
      (getDurationFromNow as jest.Mock).mockReturnValueOnce(givenDuration);

      // WHEN rendering with TIMESTAMP in visibleChildren
      render(<ChatMessageFooter {...mockProps} visibleChildren={[ChatMessageFooterChildren.TIMESTAMP]} />);

      // THEN expect the timestamp to be visible
      expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FOOTER_TIMESTAMP)).toBeInTheDocument();
      // AND expect it to show the correct duration
      expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FOOTER_TIMESTAMP)).toHaveTextContent(`sent ${givenDuration}`);
    });

    test("should not render timestamp when TIMESTAMP is not in visibleChildren", () => {
      // WHEN rendering without TIMESTAMP in visibleChildren
      render(<ChatMessageFooter {...mockProps} visibleChildren={[]} />);

      // THEN expect the timestamp to not be in the document
      expect(screen.queryByTestId(DATA_TEST_ID.CHAT_MESSAGE_FOOTER_TIMESTAMP)).not.toBeInTheDocument();
    });

    test("should handle invalid date duration gracefully", () => {
      // GIVEN a date
      const givenDate = new Date();
      // AND getDurationFromNow throws an error
      const givenError = new Error("Invalid date");
      (getDurationFromNow as jest.Mock).mockImplementationOnce(() => {
        throw givenError;
      });

      // WHEN rendering with an invalid date
      render(
        <ChatMessageFooter
          {...mockProps}
          sentAt={givenDate.toISOString()}
          visibleChildren={[ChatMessageFooterChildren.TIMESTAMP]}
        />
      );

      // THEN expect the timestamp to still be rendered with a string version of the date
      expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FOOTER_TIMESTAMP)).toBeInTheDocument();
      // AND expect it to show "sent" without a duration
      expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FOOTER_TIMESTAMP)).toHaveTextContent(
        "sent " + givenDate.toString()
      );

      // AND an error to be logged to the console
      expect(console.error).toHaveBeenCalledWith(new Error("Failed to get message duration", { cause: givenError }));
    });
  });

  // REACTION TESTS
  describe("reaction rendering", () => {
    test("should render reaction buttons when REACTIONS is in visibleChildren", () => {
      // WHEN rendering with REACTIONS in visibleChildren
      render(<ChatMessageFooter {...mockProps} visibleChildren={[ChatMessageFooterChildren.REACTIONS]} />);

      // THEN expect the reactions container to be visible
      expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FOOTER_REACTIONS)).toBeInTheDocument();
      expect(screen.getByTestId(REACTION_BUTTONS_DATA_TEST_ID.CONTAINER)).toBeInTheDocument();
    });

    test("should not render reaction buttons when REACTIONS is not in visibleChildren", () => {
      // WHEN rendering without REACTIONS in visibleChildren
      render(<ChatMessageFooter {...mockProps} visibleChildren={[]} />);

      // THEN expect the reactions container to not be in the document
      expect(screen.queryByTestId(DATA_TEST_ID.CHAT_MESSAGE_FOOTER_REACTIONS)).not.toBeInTheDocument();
    });

    test("should pass correct props to reaction buttons", () => {
      // GIVEN a current reaction
      const currentReaction = {
        id: "foo-reaction-id",
        kind: ReactionType.LIKED,
      };
      // AND a message ID
      const messageId = "test-message-id";

      // WHEN rendering with reactions
      render(
        <ChatMessageFooter
          {...mockProps}
          messageId={messageId}
          currentReaction={currentReaction}
          visibleChildren={[ChatMessageFooterChildren.REACTIONS]}
        />
      );

      // THEN expect the reaction buttons to receive the correct props
      const reactionButtons = screen.getByTestId(REACTION_BUTTONS_DATA_TEST_ID.CONTAINER);
      expect(reactionButtons).toBeInTheDocument();

      expect(ReactionButtons).toHaveBeenCalledWith(
        {
          messageId,
          currentReaction,
        },
        {}
      );
    });
  });

  // COMBINED RENDERING TESTS
  describe("combined rendering", () => {
    test("should render both timestamp and reactions when both are in visibleChildren", () => {
      // GIVEN a duration string
      const givenDuration = "3 minutes ago";
      (getDurationFromNow as jest.Mock).mockReturnValueOnce(givenDuration);

      // WHEN rendering with both children visible
      render(
        <ChatMessageFooter
          {...mockProps}
          visibleChildren={[ChatMessageFooterChildren.TIMESTAMP, ChatMessageFooterChildren.REACTIONS]}
        />
      );

      // THEN expect both components to be visible
      expect(screen.getByTestId(DATA_TEST_ID.CHAT_MESSAGE_FOOTER_TIMESTAMP)).toBeInTheDocument();
      expect(screen.getByTestId(REACTION_BUTTONS_DATA_TEST_ID.CONTAINER)).toBeInTheDocument();
    });

    test("should render nothing when visibleChildren is empty", () => {
      // WHEN rendering with no children visible
      render(<ChatMessageFooter {...mockProps} visibleChildren={[]} />);

      // THEN expect neither component to be in the document
      expect(screen.queryByTestId(DATA_TEST_ID.CHAT_MESSAGE_FOOTER_TIMESTAMP)).not.toBeInTheDocument();
      expect(screen.queryByTestId(REACTION_BUTTONS_DATA_TEST_ID.CONTAINER)).not.toBeInTheDocument();
    });
  });
});
