import { Meta, StoryObj } from "@storybook/react";
import SkillsRankingRetypedRank
  from "src/features/skillsRanking/components/skillsRankingRetypedRank/SkillsRankingRetypedRank";
import { getRandomSkillsRankingState } from "src/features/skillsRanking/utils/getSkillsRankingState";
import { SkillsRankingExperimentGroups, SkillsRankingPhase, SkillsRankingState } from "src/features/skillsRanking/types";
import { action } from "@storybook/addon-actions";
import { Box } from "@mui/material";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { SkillsRankingService } from "src/features/skillsRanking/skillsRankingService/skillsRankingService";

const FixedWidthWrapper = ({ children }: { children: React.ReactNode }) => (
  <Box sx={{ width: '600px' }}>
    {children}
  </Box>
);

type StoryArgs = React.ComponentProps<typeof SkillsRankingRetypedRank> & {
  experimentGroup: SkillsRankingExperimentGroups;
};

const meta: Meta<StoryArgs> = {
  title: "Features/SkillsRanking/SkillsRankingRetypedRank",
  component: SkillsRankingRetypedRank,
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
    onFinish: async (state: SkillsRankingState) => { /*action("onFinish")(state)*/ },
    skillsRankingState: (() => {
      let skillsRankingState = getRandomSkillsRankingState();
      skillsRankingState.phase = SkillsRankingPhase.RETYPED_RANK;
      skillsRankingState.experiment_group = SkillsRankingExperimentGroups.GROUP_1
      return skillsRankingState;
    })()
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

type Story = StoryObj<typeof SkillsRankingRetypedRank>;

export const Shown: Story = {
  args: {},
};