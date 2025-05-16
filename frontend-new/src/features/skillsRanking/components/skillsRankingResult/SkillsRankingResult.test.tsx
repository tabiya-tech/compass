// mute the console
import "src/_test_utilities/consoleMock";

import { render, screen, waitFor } from "src/_test_utilities/test-utils";
import SkillsRankingResult, {
  DATA_TEST_ID,
  DELAYED_RESULT_MESSAGE,
} from "src/features/skillsRanking/components/skillsRankingResult/SkillsRankingResult";
import { CompareAgainstGroup, ButtonOrderGroup, DelayedResultsGroup } from "src/features/skillsRanking/types";
import { SkillsRankingService } from "src/features/skillsRanking/skillsRankingService/skillsRankingService";
import { DATA_TEST_ID as CHAT_BUBBLE_DATA_TEST_ID } from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { SkillsRankingCurrentState, SkillsRankingState } from "src/features/skillsRanking/types";
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
        current_state: SkillsRankingCurrentState.EVALUATED,
        experiment_groups: {
          compare_against: CompareAgainstGroup.AGAINST_OTHER_JOB_SEEKERS,
          button_order: ButtonOrderGroup.SKIP_BUTTON_FIRST,
          delayed_results: DelayedResultsGroup.DELAYED_RESULTS,
        },
        session_id: 1234,
        ranking: "foobar",
        self_ranking: null,
      };

      // AND the skills ranking service will return the given state
      jest.spyOn(SkillsRankingService.getInstance(), "getSkillsRankingState").mockResolvedValue(givenSkillsRankingState);
      // WHEN the component is rendered
      render(
        <SkillsRankingResult
          message="Here's what we found"
          onError={jest.fn()}
          skillsRankingState={givenSkillsRankingState}
        />
      );

      // THEN expect the container to be in the document
      const container = screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_RESULT_CONTAINER);
      expect(container).toBeInTheDocument();
      // AND expect the message bubble to be visible
      expect(screen.getByTestId(CHAT_BUBBLE_DATA_TEST_ID.CHAT_MESSAGE_BUBBLE_CONTAINER)).toBeInTheDocument();
      // AND expect the loading text and indicator to be in the document initially
      expect(screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_LOADING_TEXT)).toBeInTheDocument();
      expect(screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_LOADING_INDICATOR)).toBeInTheDocument();
      // AND expect the text to be in the document
      await waitFor(() => {
        expect(screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_RESULT_TEXT)).toBeInTheDocument();
      });
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
        current_state: SkillsRankingCurrentState.EVALUATED,
        experiment_groups: {
          compare_against: experimentGroup,
          button_order: ButtonOrderGroup.SKIP_BUTTON_FIRST,
          delayed_results: DelayedResultsGroup.IMMEDIATE_RESULTS,
        },
        session_id: 1234,
        ranking: rank,
        self_ranking: null,
      };

      // AND the skills ranking service will return the given state
      jest.spyOn(SkillsRankingService.getInstance(), "getSkillsRankingState").mockResolvedValue(givenSkillsRankingState);

      // AND the skills ranking service will return the ranking
      jest.spyOn(SkillsRankingService.getInstance(), "getRanking").mockResolvedValue({ ranking: rank });

      // WHEN the component is rendered
      render(
        <SkillsRankingResult
          message="Here's what we found"
          onError={jest.fn()}
          skillsRankingState={givenSkillsRankingState}
        />
      );

      // THEN expect the result text to be in the document
      await waitFor(() => {
        const resultText = screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_RESULT_TEXT);
        expect(resultText).toBeInTheDocument();
      });
      // AND expect the result text to contain the correct rank
      const resultText = screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_RESULT_TEXT);
      expect(resultText.textContent).toContain(rank);
      // AND no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });
    
    test("should show delayed result message when experiment group is delayed results", async () => {
      // GIVEN a skills ranking state
      const givenSkillsRankingState: SkillsRankingState = {
        current_state: SkillsRankingCurrentState.EVALUATED,
        experiment_groups: {
          compare_against: CompareAgainstGroup.AGAINST_OTHER_JOB_SEEKERS,
          button_order: ButtonOrderGroup.SKIP_BUTTON_FIRST,
          delayed_results: DelayedResultsGroup.DELAYED_RESULTS,
        },
        session_id: 1234,
        ranking: "foobar",
        self_ranking: null,
      };

      // AND the skills ranking service will return the given state
      jest.spyOn(SkillsRankingService.getInstance(), "getSkillsRankingState").mockResolvedValue(givenSkillsRankingState);

      // AND the skills ranking service will return the ranking
      jest.spyOn(SkillsRankingService.getInstance(), "getRanking").mockResolvedValue({ ranking: "foobar" });

      // WHEN the component is rendered
      render(
        <SkillsRankingResult
          message="Here's what we found"
          onError={jest.fn()}
          skillsRankingState={givenSkillsRankingState}
        />
      );

      // THEN expect the delayed result message to be in the document
      expect(screen.getByText(DELAYED_RESULT_MESSAGE)).toBeInTheDocument();
    });

    test("should handle error when ranking service fails to get the ranking", async () => {
      // GIVEN a ranking service that fails
      const mockError = new Error("Failed to fetch ranking");
      // AND the skills ranking service will return the given state
      jest.spyOn(SkillsRankingService.getInstance(), "getRanking").mockRejectedValueOnce(mockError);
      // AND a skills ranking state
      const givenSkillsRankingState: SkillsRankingState = {
        current_state: SkillsRankingCurrentState.EVALUATED,
        experiment_groups: {
          compare_against: CompareAgainstGroup.AGAINST_OTHER_JOB_SEEKERS,
          button_order: ButtonOrderGroup.SKIP_BUTTON_FIRST,
          delayed_results: DelayedResultsGroup.DELAYED_RESULTS,
        },
        session_id: 1234,
        ranking: "foobar",
        self_ranking: null,
      };
      // AND an error handler
      const onError = jest.fn();

      // WHEN the component is rendered
      render(
        <SkillsRankingResult
          message="Here's what we found"
          onError={onError}
          skillsRankingState={givenSkillsRankingState}
        />
      );

      // THEN expect the error handler to be called
      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(mockError);
      });
      // AND expect the loading state to be removed
      expect(screen.queryByTestId(DATA_TEST_ID.SKILLS_RANKING_LOADING_TEXT)).not.toBeInTheDocument();
      expect(screen.queryByTestId(DATA_TEST_ID.SKILLS_RANKING_LOADING_INDICATOR)).not.toBeInTheDocument();
      // AND expect the result text to be empty
      const resultText = screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_RESULT_TEXT);
      expect(resultText.textContent).toBe(" ");
    });
  });
});
