// mute the console
import "src/_test_utilities/consoleMock";

import { render, screen } from "src/_test_utilities/test-utils";
import SkillsRankingPrompt, {
  DATA_TEST_ID,
  PROMPT_TEXTS,
} from "src/features/skillsRanking/components/skillsRankingPrompt/SkillsRankingPrompt";
import { CompareAgainstGroup, ButtonOrderGroup } from "src/features/skillsRanking/types";
import { DATA_TEST_ID as CHAT_BUBBLE_DATA_TEST_ID } from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import { SkillsRankingPhase, SkillsRankingState } from "src/features/skillsRanking/types";
import userEvent from "@testing-library/user-event";

describe("SkillsRankingPrompt tests", () => {
  describe("render tests", () => {
    test("should render component successfully", () => {
      // GIVEN a skills ranking state
      const givenSkillsRankingState: SkillsRankingState = {
        phase: SkillsRankingPhase.INITIAL,
        experiment_groups: {
          compare_against: CompareAgainstGroup.AGAINST_OTHER_JOB_SEEKERS,
          button_order: ButtonOrderGroup.VIEW_BUTTON_FIRST,
          delayed_results: false,
        },
        session_id: 1234,
        ranking: "",
        self_ranking: null,
      };

      // WHEN the component is rendered
      render(
        <SkillsRankingPrompt
          message="Please rate your skills"
          onView={jest.fn()}
          onSkip={jest.fn()}
          skillsRankingState={givenSkillsRankingState}
        />
      );

      // THEN expect the container to be in the document
      const container = screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_PROMPT_CONTAINER);
      expect(container).toBeInTheDocument();
      // AND expect the message bubble to be visible
      expect(screen.getByTestId(CHAT_BUBBLE_DATA_TEST_ID.CHAT_MESSAGE_BUBBLE_CONTAINER)).toBeInTheDocument();
      // AND expect the text to be in the document
      expect(screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_PROMPT_TEXT)).toBeInTheDocument();
      // AND expect the view button to be in the document
      expect(screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_PROMPT_VIEW_BUTTON)).toBeInTheDocument();
      // AND expect the skip button to be in the document
      expect(screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_PROMPT_SKIP_BUTTON)).toBeInTheDocument();
      // AND to match the snapshot
      expect(container).toMatchSnapshot();
      // AND no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test.each([
      [CompareAgainstGroup.AGAINST_OTHER_JOB_SEEKERS, PROMPT_TEXTS[CompareAgainstGroup.AGAINST_OTHER_JOB_SEEKERS]],
      [CompareAgainstGroup.AGAINST_JOB_MARKET, PROMPT_TEXTS[CompareAgainstGroup.AGAINST_JOB_MARKET]],
    ])("should render correct prompt text for %s", (experimentGroup, expectedText) => {
      // GIVEN a skills ranking state
      const givenSkillsRankingState: SkillsRankingState = {
        phase: SkillsRankingPhase.INITIAL,
        experiment_groups: {
          compare_against: experimentGroup,
          button_order: ButtonOrderGroup.VIEW_BUTTON_FIRST,
          delayed_results: false,
        },
        session_id: 1234,
        ranking: "",
        self_ranking: null,
      };

      // WHEN the component is rendered
      render(
        <SkillsRankingPrompt
          message="Please rate your skills"
          onView={jest.fn()}
          onSkip={jest.fn()}
          skillsRankingState={givenSkillsRankingState}
        />
      );

      // THEN expect the correct prompt text to be in the document
      const promptText = screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_PROMPT_TEXT);
      expect(promptText).toBeInTheDocument();
      expect(promptText).toHaveTextContent(expectedText);
      // AND no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should render buttons in correct order based on experiment group", () => {
      // GIVEN a skills ranking state with skip button first
      const givenSkillsRankingState: SkillsRankingState = {
        phase: SkillsRankingPhase.INITIAL,
        experiment_groups: {
          compare_against: CompareAgainstGroup.AGAINST_OTHER_JOB_SEEKERS,
          button_order: ButtonOrderGroup.SKIP_BUTTON_FIRST,
          delayed_results: false,
        },
        session_id: 1234,
        ranking: "",
        self_ranking: null,
      };

      // WHEN the component is rendered
      render(
        <SkillsRankingPrompt
          message="Please rate your skills"
          onView={jest.fn()}
          onSkip={jest.fn()}
          skillsRankingState={givenSkillsRankingState}
        />
      );

      // THEN expect the buttons to be in the correct order
      const buttons = screen.getAllByRole("button");
      expect(buttons[0]).toHaveTextContent("Skip comparison");
      expect(buttons[1]).toHaveTextContent("View comparison");
    });
  });

  describe("action tests", () => {
    test("should call onView when the view button is clicked", async () => {
      // GIVEN a skills ranking state
      const givenSkillsRankingState: SkillsRankingState = {
        phase: SkillsRankingPhase.INITIAL,
        experiment_groups: {
          compare_against: CompareAgainstGroup.AGAINST_OTHER_JOB_SEEKERS,
          button_order: ButtonOrderGroup.VIEW_BUTTON_FIRST,
          delayed_results: false,
        },
        session_id: 1234,
        ranking: "",
        self_ranking: null,
      };
      // AND callbacks
      const onView = jest.fn();
      const onSkip = jest.fn();

      // WHEN the component is rendered
      render(
        <SkillsRankingPrompt
          message="Please rate your skills"
          onView={onView}
          onSkip={onSkip}
          skillsRankingState={givenSkillsRankingState}
        />
      );

      // AND the view button is clicked
      const viewButton = screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_PROMPT_VIEW_BUTTON);
      await userEvent.click(viewButton);

      // THEN expect the onView function to have been called
      expect(onView).toHaveBeenCalled();
      // AND expect the onSkip function not to have been called
      expect(onSkip).not.toHaveBeenCalled();
    });

    test("should call onSkip when the skip button is clicked", async () => {
      // GIVEN a skills ranking state
      const givenSkillsRankingState: SkillsRankingState = {
        phase: SkillsRankingPhase.INITIAL,
        experiment_groups: {
          compare_against: CompareAgainstGroup.AGAINST_OTHER_JOB_SEEKERS,
          button_order: ButtonOrderGroup.VIEW_BUTTON_FIRST,
          delayed_results: false,
        },
        session_id: 1234,
        ranking: "",
        self_ranking: null,
      };
      // AND callbacks
      const onView = jest.fn();
      const onSkip = jest.fn();

      // WHEN the component is rendered
      render(
        <SkillsRankingPrompt
          message="Please rate your skills"
          onView={onView}
          onSkip={onSkip}
          skillsRankingState={givenSkillsRankingState}
        />
      );

      // AND the skip button is clicked
      const skipButton = screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_PROMPT_SKIP_BUTTON);
      await userEvent.click(skipButton);

      // THEN expect the onSkip function to have been called
      expect(onSkip).toHaveBeenCalled();
      // AND expect the onView function not to have been called
      expect(onView).not.toHaveBeenCalled();
    });

    test("should be disabled when not in initial state", () => {
      // GIVEN a skills ranking state that is not in initial state
      const givenSkillsRankingState: SkillsRankingState = {
        phase: SkillsRankingPhase.EVALUATED,
        experiment_groups: {
          compare_against: CompareAgainstGroup.AGAINST_OTHER_JOB_SEEKERS,
          button_order: ButtonOrderGroup.VIEW_BUTTON_FIRST,
          delayed_results: false,
        },
        session_id: 1234,
        ranking: "",
        self_ranking: null,
      };

      // WHEN the component is rendered
      render(
        <SkillsRankingPrompt
          message="Please rate your skills"
          onView={jest.fn()}
          onSkip={jest.fn()}
          skillsRankingState={givenSkillsRankingState}
        />
      );

      // THEN expect the buttons to be disabled
      const viewButton = screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_PROMPT_VIEW_BUTTON);
      const skipButton = screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_PROMPT_SKIP_BUTTON);
      expect(viewButton).toBeDisabled();
      expect(skipButton).toBeDisabled();
    });
  });
});
