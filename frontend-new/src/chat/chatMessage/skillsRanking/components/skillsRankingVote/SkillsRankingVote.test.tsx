// mute the console
import "src/_test_utilities/consoleMock";

import { render, screen } from "src/_test_utilities/test-utils";
import SkillsRankingVote, {
  DATA_TEST_ID,
  QUESTION_TEXTS,
  OPTIONS,
} from "src/chat/chatMessage/skillsRanking/components/skillsRankingVote/SkillsRankingVote";
import { nanoid } from "nanoid";
import { ExperimentGroup } from "src/chat/chatMessage/skillsRanking/types";
import { ChatMessageType, IChatMessage } from "src/chat/Chat.types";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import { DATA_TEST_ID as CHAT_BUBBLE_DATA_TEST_ID } from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import userEvent from "@testing-library/user-event";

// mock SkillsRankingVoteItem component
jest.mock(
  "src/chat/chatMessage/skillsRanking/components/skillsRankingVote/components/skillsRankingVoteItem/SkillsRankingVoteItem",
  () => ({
    __esModule: true,
    default: (props: any) => (
      <div data-testid="skills-ranking-vote-item">
        <div data-testid="skills-ranking-vote-item-radio" onClick={() => props.onSelect?.(props.index)} />
        {!props.isLast && <div data-testid="skills-ranking-vote-item-divider" />}
      </div>
    ),
  })
);

describe("SkillsRankingVote tests", () => {
  describe("render tests", () => {
    test("should render component successfully", () => {
      // GIVEN a chat message
      const givenChatMessage: IChatMessage = {
        message_id: nanoid(),
        sender: ConversationMessageSender.COMPASS,
        message: "",
        sent_at: new Date().toISOString(),
        type: ChatMessageType.SKILLS_RANKING,
        reaction: null,
      };

      // WHEN the component is rendered
      render(
        <SkillsRankingVote group={ExperimentGroup.GROUP_A} onRankSelect={jest.fn()} chatMessage={givenChatMessage} />
      );

      // THEN expect the container to be in the document
      const container = screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_VOTE_CONTAINER);
      expect(container).toBeInTheDocument();
      // AND expect the message bubble to be visible
      expect(screen.getByTestId(CHAT_BUBBLE_DATA_TEST_ID.CHAT_MESSAGE_BUBBLE_CONTAINER)).toBeInTheDocument();
      // AND expect the text to be in the document
      expect(screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_VOTE_TEXT)).toBeInTheDocument();
      // AND the SkillsRankingVoteItem to be visible
      const voteItems = screen.getAllByTestId("skills-ranking-vote-item");
      expect(voteItems).toHaveLength(OPTIONS.length);
      // AND to match the snapshot
      expect(container).toMatchSnapshot();
      // AND no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test.each([
      [ExperimentGroup.GROUP_A, QUESTION_TEXTS[ExperimentGroup.GROUP_A]],
      [ExperimentGroup.GROUP_B, QUESTION_TEXTS[ExperimentGroup.GROUP_B]],
    ])("should render correct question text for %s", (group, expectedText) => {
      // GIVEN a chat message
      const givenChatMessage: IChatMessage = {
        message_id: nanoid(),
        sender: ConversationMessageSender.COMPASS,
        message: "",
        sent_at: new Date().toISOString(),
        type: ChatMessageType.SKILLS_RANKING,
        reaction: null,
      };

      // WHEN the component is rendered
      render(<SkillsRankingVote group={group} onRankSelect={jest.fn()} chatMessage={givenChatMessage} />);

      // THEN expect the correct question text to be in the document
      const questionText = screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_VOTE_TEXT);
      expect(questionText).toBeInTheDocument();
      expect(questionText).toHaveTextContent(expectedText);
      // AND no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });
  });

  describe("action tests", () => {
    test("should call onRankSelect when a rank icon is clicked", async () => {
      // GIVEN a chat message
      const givenChatMessage: IChatMessage = {
        message_id: nanoid(),
        sender: ConversationMessageSender.COMPASS,
        message: "",
        sent_at: new Date().toISOString(),
        type: ChatMessageType.SKILLS_RANKING,
        reaction: null,
      };
      // AND onRankSelect mock function
      const onRankSelect = jest.fn();

      // WHEN the component is rendered
      render(
        <SkillsRankingVote group={ExperimentGroup.GROUP_A} onRankSelect={onRankSelect} chatMessage={givenChatMessage} />
      );

      // AND the first rank icon is clicked
      const rankIcon = screen.getAllByTestId("skills-ranking-vote-item-radio")[0];
      await userEvent.click(rankIcon);

      // THEN expect the onRankSelect function to have been called with the correct argument
      expect(onRankSelect).toHaveBeenCalledWith(OPTIONS[0].value);
      // AND no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });
  });
});
