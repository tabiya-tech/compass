import { Meta, StoryObj } from "@storybook/react";
import SkillsRankingEffort, {
  SkillsRankingEffortState,
} from "src/features/skillsRanking/components/skillsRankingEffort/SkillsRankingEffort";
import { getRandomSkillsRankingState } from "src/features/skillsRanking/utils/getSkillsRankingState";
import { action } from '@storybook/addon-actions';
import {
  SkillsRankingExperimentGroups,
  SkillsRankingPhase,
  SkillsRankingState,
} from "src/features/skillsRanking/types";
import { Box } from "@mui/material";
import UserPreferencesStateService from "../../../../userPreferences/UserPreferencesStateService";
import { SkillsRankingService } from "../../skillsRankingService/skillsRankingService";

const FixedWidthWrapper = ({ children }: { children: React.ReactNode }) => (
  <Box sx={{ width: '600px' }}>
    {children}
  </Box>
);

type StoryArgs = React.ComponentProps<typeof SkillsRankingEffort> & {
  experimentGroup: SkillsRankingExperimentGroups;
};

const meta: Meta<StoryArgs> = {
  title: "Features/SkillsRanking/SkillsRankingEffort",
  component: SkillsRankingEffort,
  tags: ["autodocs"],
  argTypes: {
    onFinish: { action: "onFinish" },
    experimentGroup: {
      name: "Experiment Group",
      control: { type: "select" },
      options: Object.values(SkillsRankingExperimentGroups),
    },
  },
  args: {
    onFinish: async (state: SkillsRankingState) => {/*action("onFinish")(state)*/},
    experimentGroup: SkillsRankingExperimentGroups.GROUP_1,
  },
  render: (args) => {
    const state = getRandomSkillsRankingState();
    state.experiment_group = args.experimentGroup;
    state.phase = SkillsRankingPhase.EFFORT;

    return <SkillsRankingEffort {...args} skillsRankingState={state} />;
  },
  decorators: [
    (Story) => {
      // Mock AuthenticationStateService
      const mockUserPreferencesStateService = UserPreferencesStateService.getInstance();
      mockUserPreferencesStateService.getActiveSessionId = () => 1234;

      // @ts-ignore
      SkillsRankingService.getInstance().updateSkillsRankingState = (
        sessionId: number,
        phase: SkillsRankingPhase,
        cancelled_after?: string,
        perceived_rank_percentile?: number,
        retyped_rank_percentile?: number) => {
        return new Promise((resolve) => {
          setTimeout(() => {
            action("success")(`Updated skills ranking state to phase: ${phase}`);
            resolve(getRandomSkillsRankingState());
          }, 1000);
        });
      }

      return (
        <FixedWidthWrapper>
          <Story />
        </FixedWidthWrapper>
      );
    },
  ],
};

export default meta;

type Story = StoryObj<StoryArgs>;

export const Shown: Story = {
  args: {},
};
