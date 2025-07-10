import { Meta, StoryObj } from "@storybook/react";
import SkillsRankingJobSeekerDisclosure
  from "src/features/skillsRanking/components/skillsRankingDisclosure/skillsRankingJobSeekerDisclosure/SkillsRankingJobSeekerDisclosure";
import { getRandomSkillsRankingState } from "src/features/skillsRanking/utils/getSkillsRankingState";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { SkillsRankingService } from "src/features/skillsRanking/skillsRankingService/skillsRankingService";
import { SkillsRankingExperimentGroups, SkillsRankingPhase, SkillsRankingState } from "src/features/skillsRanking/types";
import { Box } from "@mui/material";
import { action } from "@storybook/addon-actions";

const FixedWidthWrapper = ({ children }: { children: React.ReactNode }) => (
  <Box sx={{ width: '600px' }}>
    {children}
  </Box>
);

const meta: Meta<typeof SkillsRankingJobSeekerDisclosure> = {
  title: "Features/SkillsRanking/SkillsRankingJobSeekerDisclosure",
  component: SkillsRankingJobSeekerDisclosure,
  tags: ["autodocs"],
  args: {
    onFinish: async (state: SkillsRankingState) => {/*action("onFinish")(state)*/ },
    skillsRankingState: (() => {
      let skillsRankingState = getRandomSkillsRankingState();
      skillsRankingState.phase = SkillsRankingPhase.JOB_SEEKER_DISCLOSURE;
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

type Story = StoryObj<typeof SkillsRankingJobSeekerDisclosure>;

export const ShownForDisclosureGroup: Story = {
  args: {
    skillsRankingState: (() => {
      let skillsRankingState = getRandomSkillsRankingState();
      skillsRankingState.phase = SkillsRankingPhase.JOB_SEEKER_DISCLOSURE;
      skillsRankingState.experiment_group = SkillsRankingExperimentGroups.GROUP_1
      return skillsRankingState;
    })()
  },
};

export const ShownForNonDisclosureGroup: Story = {
  args:{
    skillsRankingState: (() => {
      let skillsRankingState = getRandomSkillsRankingState();
      skillsRankingState.phase = SkillsRankingPhase.JOB_SEEKER_DISCLOSURE;
      skillsRankingState.experiment_group = SkillsRankingExperimentGroups.GROUP_2
      return skillsRankingState;
    })()
  }
}
