import { Meta, StoryObj } from "@storybook/react";
import SkillsRankingVote from "src/features/skillsRanking/components/skillsRankingVote/SkillsRankingVote";
import { ButtonOrderGroup, CompareAgainstGroup, DelayedResultsGroup, SkillsRankingCurrentState } from "src/features/skillsRanking/types";
const meta: Meta<typeof SkillsRankingVote> = {
  title: "Features/SkillsRanking/SkillsRankingVote",
  component: SkillsRankingVote,
  tags: ["autodocs"],
  argTypes: {
    onRankSelect: { action: "onRankSelect" },
  },
  args: {
    message: "Please rate your skills",
    onRankSelect: () => {},
    disabled: false,
    skillsRankingState: {
      current_state: SkillsRankingCurrentState.SELF_EVALUATING,
      experiment_groups: {
        compare_against: CompareAgainstGroup.AGAINST_OTHER_JOB_SEEKERS,
        button_order: ButtonOrderGroup.SKIP_BUTTON_FIRST,
        delayed_results: DelayedResultsGroup.IMMEDIATE_RESULTS,
      },
      session_id: 1,
      ranking: "",
      self_ranking: null,
    },
  },
};

export default meta;

type Story = StoryObj<typeof SkillsRankingVote>;

export const Shown: Story = {
  args: {},
};

export const ShownWhenDisabled: Story = {
  args: {
    disabled: true,
  },
};

export const JobMarketComparison: Story = {
  args: {
    skillsRankingState: {
      current_state: SkillsRankingCurrentState.SELF_EVALUATING,
      experiment_groups: {
        compare_against: CompareAgainstGroup.AGAINST_JOB_MARKET,
        button_order: ButtonOrderGroup.SKIP_BUTTON_FIRST,
        delayed_results: DelayedResultsGroup.IMMEDIATE_RESULTS,
      },
      session_id: 1,
      ranking: "",
      self_ranking: null,
    },
  },
};

export const EvaluatedState: Story = {
  args: {
    skillsRankingState: {
      current_state: SkillsRankingCurrentState.EVALUATED,
      experiment_groups: {
        compare_against: CompareAgainstGroup.AGAINST_OTHER_JOB_SEEKERS,
        button_order: ButtonOrderGroup.SKIP_BUTTON_FIRST,
        delayed_results: DelayedResultsGroup.IMMEDIATE_RESULTS,
      },
      session_id: 1,
      ranking: "",
      self_ranking: null,
    },
  },
};
