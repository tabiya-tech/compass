import { Meta, StoryObj } from "@storybook/react";
import SkillsRankingBriefing from "src/features/skillsRanking/components/skillsRankingBriefing/SkillsRankingBriefing";
import { getRandomSkillsRankingState } from "src/features/skillsRanking/utils/getSkillsRankingState";
import { SkillsRankingPhase, SkillsRankingState } from "../../types";
import UserPreferencesStateService from "../../../../userPreferences/UserPreferencesStateService";
import { SkillsRankingService } from "../../skillsRankingService/skillsRankingService";
import { action } from "@storybook/addon-actions";

import { Box } from "@mui/material";

const FixedWidthWrapper = ({ children }: { children: React.ReactNode }) => (
  <Box sx={{ width: '600px' }}>
    {children}
  </Box>
);


const meta: Meta<typeof SkillsRankingBriefing> = {
  title: "Features/SkillsRanking/SkillsRankingBriefing",
  component: SkillsRankingBriefing,
  tags: ["autodocs"],
  argTypes: {
    onFinish: { action: "onFinish" }
  },
  args: {
    onFinish: async (state: SkillsRankingState) => { /*action("onFinish")(state)*/ },
    skillsRankingState: (() => {
      let skillsRankingState = getRandomSkillsRankingState();
      skillsRankingState.phase = SkillsRankingPhase.BRIEFING;
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

type Story = StoryObj<typeof SkillsRankingBriefing>;

export const Shown: Story = {
  args: {},
};
