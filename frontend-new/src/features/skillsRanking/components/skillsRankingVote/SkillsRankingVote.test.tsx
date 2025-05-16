// mute the console
import "src/_test_utilities/consoleMock";

import { render, screen } from "src/_test_utilities/test-utils";
import SkillsRankingVote, {
  DATA_TEST_ID,
  QUESTION_TEXTS,
  OPTIONS,
} from "src/features/skillsRanking/components/skillsRankingVote/SkillsRankingVote";
import { CompareAgainstGroup, ButtonOrderGroup } from "src/features/skillsRanking/types";
import { SkillsRankingPhase, SkillsRankingState } from "src/features/skillsRanking/types";
import { DATA_TEST_ID as CHAT_BUBBLE_DATA_TEST_ID } from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import userEvent from "@testing-library/user-event";

// mock SkillsRankingVoteItem component
jest.mock("src/features/skillsRanking/components/skillsRankingVote/components/SkillsRankingVoteItem", () => ({
  __esModule: true,
  default: (props: any) => (
    <div data-testid="skills-ranking-vote-item">
      <div data-testid="skills-ranking-vote-item-radio" onClick={() => props.onSelect?.(props.index)} />
      {!props.isLast && <div data-testid="skills-ranking-vote-item-divider" />}
    </div>
  ),
}));

describe("SkillsRankingVote tests", () => {
  describe("render tests", () => {
    test("should render component successfully", () => {
      // GIVEN a skills ranking state
      const givenSkillsRankingState: SkillsRankingState = {
        phase: SkillsRankingPhase.SELF_EVALUATING,
        experiment_groups: {
          compare_against: CompareAgainstGroup.AGAINST_OTHER_JOB_SEEKERS,
          delayed_results: false,
          button_order: ButtonOrderGroup.SKIP_BUTTON_FIRST,
        },
        session_id: 1,
        ranking: "",
        self_ranking: null,
      };

      // WHEN the component is rendered
      render(
        <SkillsRankingVote
          message="Please rate your skills"
          onRankSelect={jest.fn()}
          skillsRankingState={givenSkillsRankingState}
        />
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
      [CompareAgainstGroup.AGAINST_OTHER_JOB_SEEKERS, QUESTION_TEXTS[CompareAgainstGroup.AGAINST_OTHER_JOB_SEEKERS]],
      [CompareAgainstGroup.AGAINST_JOB_MARKET, QUESTION_TEXTS[CompareAgainstGroup.AGAINST_JOB_MARKET]],
    ])("should render correct question text for %s", (experimentGroup, expectedText) => {
      // GIVEN a skills ranking state
      const givenSkillsRankingState: SkillsRankingState = {
        phase: SkillsRankingPhase.SELF_EVALUATING,
        experiment_groups: {
          compare_against: experimentGroup,
          button_order: ButtonOrderGroup.SKIP_BUTTON_FIRST,
          delayed_results: false,
        },
        session_id: 1,
        ranking: "",
        self_ranking: null,
      };

      // WHEN the component is rendered
      render(
        <SkillsRankingVote
          message="Please rate your skills"
          onRankSelect={jest.fn()}
          skillsRankingState={givenSkillsRankingState}
        />
      );

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
      // GIVEN a skills ranking state
      const givenSkillsRankingState: SkillsRankingState = {
        phase: SkillsRankingPhase.SELF_EVALUATING,
        experiment_groups: {
          compare_against: CompareAgainstGroup.AGAINST_OTHER_JOB_SEEKERS,
          button_order: ButtonOrderGroup.SKIP_BUTTON_FIRST,
          delayed_results: false,
        },
        session_id: 1,
        ranking: "",
        self_ranking: null,
      };
      // AND onRankSelect mock function
      const onRankSelect = jest.fn();

      // WHEN the component is rendered
      render(
        <SkillsRankingVote
          message="Please rate your skills"
          onRankSelect={onRankSelect}
          skillsRankingState={givenSkillsRankingState}
        />
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

    test.todo("should be disabled when not in self-evaluating state");
  });
});
