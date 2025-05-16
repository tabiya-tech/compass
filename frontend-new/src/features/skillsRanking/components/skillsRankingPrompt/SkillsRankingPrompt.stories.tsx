import { Meta, StoryObj } from "@storybook/react";
import SkillsRankingPrompt from "src/features/skillsRanking/components/skillsRankingPrompt/SkillsRankingPrompt";
import { ButtonOrderGroup, CompareAgainstGroup } from "src/features/skillsRanking/types";
import { SkillsRankingPhase } from "src/features/skillsRanking/types";

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
    onView: async () => {},
    onSkip: async () => {},
    disabled: false,
    skillsRankingState: {
      phase: SkillsRankingPhase.INITIAL,
      experiment_groups: {
        compare_against: CompareAgainstGroup.AGAINST_OTHER_JOB_SEEKERS,
        button_order: ButtonOrderGroup.VIEW_BUTTON_FIRST,
        delayed_results: false,
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
      phase: SkillsRankingPhase.INITIAL,
      experiment_groups: {
        compare_against: CompareAgainstGroup.AGAINST_JOB_MARKET,
        button_order: ButtonOrderGroup.VIEW_BUTTON_FIRST,
          delayed_results: false,
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
      phase: SkillsRankingPhase.INITIAL,
      experiment_groups: {
        compare_against: CompareAgainstGroup.AGAINST_OTHER_JOB_SEEKERS,
        button_order: ButtonOrderGroup.SKIP_BUTTON_FIRST,
        delayed_results: false,
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
      phase: SkillsRankingPhase.EVALUATED,
      experiment_groups: {
        compare_against: CompareAgainstGroup.AGAINST_OTHER_JOB_SEEKERS,
        button_order: ButtonOrderGroup.VIEW_BUTTON_FIRST,
        delayed_results: false,
      },
      session_id: 1234,
      ranking: "",
      self_ranking: null,
    },
  },
};
