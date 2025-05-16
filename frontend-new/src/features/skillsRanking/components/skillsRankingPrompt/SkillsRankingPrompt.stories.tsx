import { Meta, StoryObj } from "@storybook/react";
import SkillsRankingPrompt from "src/features/skillsRanking/components/skillsRankingPrompt/SkillsRankingPrompt";
import { ButtonOrderGroup, CompareAgainstGroup, DelayedResultsGroup } from "src/features/skillsRanking/types";
import { SkillsRankingCurrentState } from "src/features/skillsRanking/types";

const meta: Meta<typeof SkillsRankingPrompt> = {
  title: "Features/SkillsRanking/SkillsRankingPrompt",
  component: SkillsRankingPrompt,
  tags: ["autodocs"],
  argTypes: {
    onView: { action: "onView" },
    onSkip: { action: "onSkip" },
  },
  args: {
    message: "Please rate your skills",
    onView: () => {},
    onSkip: () => {},
    disabled: false,
    skillsRankingState: {
      current_state: SkillsRankingCurrentState.INITIAL,
      experiment_groups: {
        compare_against: CompareAgainstGroup.AGAINST_OTHER_JOB_SEEKERS,
        button_order: ButtonOrderGroup.VIEW_BUTTON_FIRST,
        delayed_results: DelayedResultsGroup.DELAYED_RESULTS,
      },
      session_id: 1234,
      ranking: "",
      self_ranking: null,
    },
  },
};

export default meta;

type Story = StoryObj<typeof SkillsRankingPrompt>;

export const Shown: Story = {
  args: {},
};

export const JobMarketComparison: Story = {
  args: {
    skillsRankingState: {
      current_state: SkillsRankingCurrentState.INITIAL,
      experiment_groups: {
        compare_against: CompareAgainstGroup.AGAINST_JOB_MARKET,
        button_order: ButtonOrderGroup.VIEW_BUTTON_FIRST,
        delayed_results: DelayedResultsGroup.DELAYED_RESULTS,
      },
      session_id: 1234,
      ranking: "",
      self_ranking: null,
    },
  },
};

export const SkipButtonFirst: Story = {
  args: {
    skillsRankingState: {
      current_state: SkillsRankingCurrentState.INITIAL,
      experiment_groups: {
        compare_against: CompareAgainstGroup.AGAINST_OTHER_JOB_SEEKERS,
        button_order: ButtonOrderGroup.SKIP_BUTTON_FIRST,
        delayed_results: DelayedResultsGroup.DELAYED_RESULTS,
      },
      session_id: 1234,
      ranking: "",
      self_ranking: null,
    },
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};

export const EvaluatedState: Story = {
  args: {
    skillsRankingState: {
      current_state: SkillsRankingCurrentState.EVALUATED,
      experiment_groups: {
        compare_against: CompareAgainstGroup.AGAINST_OTHER_JOB_SEEKERS,
        button_order: ButtonOrderGroup.VIEW_BUTTON_FIRST,
        delayed_results: DelayedResultsGroup.DELAYED_RESULTS,
      },
      session_id: 1234,
      ranking: "",
      self_ranking: null,
    },
  },
};
