// mute the console
import "src/_test_utilities/consoleMock";

import { render, screen } from "src/_test_utilities/test-utils";
import SkillsRankingResult, {
  DATA_TEST_ID,
} from "src/features/skillsRanking/components/skillsRankingResult/SkillsRankingResult";
import { CompareAgainstGroup, ButtonOrderGroup } from "src/features/skillsRanking/types";
import { SkillsRankingService } from "src/features/skillsRanking/skillsRankingService/skillsRankingService";
import { DATA_TEST_ID as CHAT_BUBBLE_DATA_TEST_ID } from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { SkillsRankingPhase, SkillsRankingState } from "src/features/skillsRanking/types";
import { resetAllMethodMocks } from "src/_test_utilities/resetAllMethodMocks";


describe("SkillsRankingResult tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(UserPreferencesStateService.getInstance(), "getActiveSessionId").mockReturnValueOnce(1234);
  });

  describe("render tests", () => {
    beforeEach(() => {
      resetAllMethodMocks(SkillsRankingService.getInstance())
      jest.clearAllMocks()
    })
    test("should render component successfully", async () => {
      // GIVEN a skills ranking state
      const givenSkillsRankingState: SkillsRankingState = {
        phase: SkillsRankingPhase.EVALUATED,
        experiment_groups: {
          compare_against: CompareAgainstGroup.AGAINST_OTHER_JOB_SEEKERS,
          button_order: ButtonOrderGroup.SKIP_BUTTON_FIRST,
          delayed_results: false,
        },
        session_id: 1234,
        ranking: "foobar",
        self_ranking: null,
      };

      // WHEN the component is rendered
      render(
        <SkillsRankingResult
          message="Here's what we found"
          skillsRankingState={givenSkillsRankingState}
          isLoading={false}
        />
      );

      // THEN expect the container to be in the document
      const container = screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_RESULT_CONTAINER);
      expect(container).toBeInTheDocument();
      // AND expect the message bubble to be visible
      expect(screen.getByTestId(CHAT_BUBBLE_DATA_TEST_ID.CHAT_MESSAGE_BUBBLE_CONTAINER)).toBeInTheDocument();
      // AND expect the result text to be in the document
      expect(screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_RESULT_TEXT)).toBeInTheDocument();
      // AND to match the snapshot
      expect(container).toMatchSnapshot();
      // AND no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test.each([
      [CompareAgainstGroup.AGAINST_OTHER_JOB_SEEKERS, "foobar"],
      [CompareAgainstGroup.AGAINST_JOB_MARKET, "foobar"],
    ])("should render correct result text for %s", async (experimentGroup, rank) => {
      // GIVEN a skills ranking state
      const givenSkillsRankingState: SkillsRankingState = {
        phase: SkillsRankingPhase.EVALUATED,
        experiment_groups: {
          compare_against: experimentGroup,
          button_order: ButtonOrderGroup.SKIP_BUTTON_FIRST,
          delayed_results: false,
        },
        session_id: 1234,
        ranking: rank,
        self_ranking: null,
      };

      // WHEN the component is rendered
      render(
        <SkillsRankingResult
          message="Here's what we found"
          skillsRankingState={givenSkillsRankingState}
          isLoading={false}
        />
      );

      // THEN expect the result text to be in the document
      const resultText = screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_RESULT_TEXT);
      expect(resultText).toBeInTheDocument();
      // AND expect the result text to contain the correct rank
      expect(resultText).toHaveTextContent(rank);
    });

    test("should show loading state", () => {
      // GIVEN a skills ranking state
      const givenSkillsRankingState: SkillsRankingState = {
        phase: SkillsRankingPhase.EVALUATED,
        experiment_groups: {
          compare_against: CompareAgainstGroup.AGAINST_OTHER_JOB_SEEKERS,
          button_order: ButtonOrderGroup.SKIP_BUTTON_FIRST,
          delayed_results: false,
        },
        session_id: 1234,
        ranking: "foobar",
        self_ranking: null,
      };

      // WHEN the component is rendered with isLoading true
      render(
        <SkillsRankingResult
          message="Here's what we found"
          skillsRankingState={givenSkillsRankingState}
          isLoading={true}
        />
      );

      // THEN expect the loading text and indicator to be in the document
      expect(screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_LOADING_TEXT)).toBeInTheDocument();
      expect(screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_LOADING_INDICATOR)).toBeInTheDocument();
      // AND expect the result text to not be in the document
      expect(screen.queryByTestId(DATA_TEST_ID.SKILLS_RANKING_RESULT_TEXT)).not.toBeInTheDocument();
    });
  });
  test.todo("should show delayed result message if the user is assigned delayed result experiment group")
});
