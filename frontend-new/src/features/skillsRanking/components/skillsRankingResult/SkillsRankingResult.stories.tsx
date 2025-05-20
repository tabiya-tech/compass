import { Meta, StoryObj } from "@storybook/react";
import SkillsRankingResult from "src/features/skillsRanking/components/skillsRankingResult/SkillsRankingResult";
import { CompareAgainstGroup, ButtonOrderGroup } from "src/features/skillsRanking/types";
import { SkillsRankingService } from "src/features/skillsRanking/skillsRankingService/skillsRankingService";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { SkillsRankingPhase } from "src/features/skillsRanking/types";

const meta: Meta<typeof SkillsRankingResult> = {
  title: "Features/SkillsRanking/SkillsRankingResult",
  component: SkillsRankingResult,
  tags: ["autodocs"],
  args: {
    message: "Here's what we found",
    skillsRankingState: {
      phase: SkillsRankingPhase.EVALUATED,
      experiment_groups: {
        compare_against: CompareAgainstGroup.AGAINST_OTHER_JOB_SEEKERS,
        button_order: ButtonOrderGroup.SKIP_BUTTON_FIRST,
        delayed_results: false,
      },
      session_id: 1234,
      ranking: "80%",
      self_ranking: null,
    },
  },
  decorators: [
    (Story) => {
      UserPreferencesStateService.getInstance().getActiveSessionId = () => 1234;
      SkillsRankingService.getInstance().getSkillsRankingState = async () => ({
        session_id: 1234,
        experiment_groups: {
          compare_against: CompareAgainstGroup.AGAINST_OTHER_JOB_SEEKERS,
          button_order: ButtonOrderGroup.SKIP_BUTTON_FIRST,
          delayed_results: false,
        },
        phase: SkillsRankingPhase.EVALUATED,
        ranking: "80%",
        self_ranking: null,
      });
      return <Story />;
    },
  ],
};

export default meta;

type Story = StoryObj<typeof SkillsRankingResult>;

export const Shown: Story = {
  args: {},
};

export const JobMarketComparison: Story = {
  args: {
    skillsRankingState: {
      phase: SkillsRankingPhase.EVALUATED,
      experiment_groups: {
        compare_against: CompareAgainstGroup.AGAINST_JOB_MARKET,
        button_order: ButtonOrderGroup.SKIP_BUTTON_FIRST,
        delayed_results: false,
      },
      session_id: 1234,
      ranking: "80%",
      self_ranking: null,
    },
  },
};

export const Loading: Story = {
  args: {
    skillsRankingState: {
      phase: SkillsRankingPhase.SELF_EVALUATING,
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
  decorators: [
    (Story) => {
      UserPreferencesStateService.getInstance().getActiveSessionId = () => 1234;
      SkillsRankingService.getInstance().getSkillsRankingState = async () => {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return {
          session_id: 1234,
          experiment_groups: {
            compare_against: CompareAgainstGroup.AGAINST_OTHER_JOB_SEEKERS,
            button_order: ButtonOrderGroup.SKIP_BUTTON_FIRST,
            delayed_results: false,
          },
          phase: SkillsRankingPhase.EVALUATED,
          ranking: "80%",
          self_ranking: null,
        };
      };
      return <Story />;
    },
  ],
};
