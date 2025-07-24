import { Meta, StoryObj } from "@storybook/react";
import SkillsRankingPerceivedRank
  from "src/features/skillsRanking/components/skillsRankingPerceivedRank/SkillsRankingPerceivedRank";
import { getRandomSkillsRankingState } from "src/features/skillsRanking/utils/getSkillsRankingState";
import { SkillsRankingPhase, SkillsRankingState } from "src/features/skillsRanking/types";
import { action } from "@storybook/addon-actions";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { SkillsRankingService } from "src/features/skillsRanking/skillsRankingService/skillsRankingService";
import { Box } from "@mui/material";

const FixedWidthWrapper = ({ children }: { children: React.ReactNode }) => (
  <Box sx={{ width: '600px' }}>
    {children}
  </Box>
);

const meta: Meta<typeof SkillsRankingPerceivedRank> = {
  title: "Features/SkillsRanking/SkillsRankingPerceivedRank",
  component: SkillsRankingPerceivedRank,
  tags: ["autodocs"],
  argTypes: {
    onFinish: { action: "onFinish" }
  },
  args: {
    onFinish: async (state: SkillsRankingState) => { /*action("onFinish")(state)*/ },
    skillsRankingState: (() => {
      let skillsRankingState = getRandomSkillsRankingState();
      skillsRankingState.phase = SkillsRankingPhase.PERCEIVED_RANK;
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

type Story = StoryObj<typeof SkillsRankingPerceivedRank>;

export const Shown: Story = {
  args: {},
};
