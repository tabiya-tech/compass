import { Meta, StoryObj } from "@storybook/react";
import SkillsRankingPrompt from "src/features/skillsRanking/components/skillsRankingPrompt/SkillsRankingPrompt";
import { getRandomSkillsRankingState } from "src/features/skillsRanking/utils/getSkillsRankingState";
import { Box } from "@mui/material";
import UserPreferencesStateService from "../../../../userPreferences/UserPreferencesStateService";
import { SkillsRankingService } from "../../skillsRankingService/skillsRankingService";
import { SkillsRankingPhase, SkillsRankingState } from "../../types";
import { action } from "@storybook/addon-actions";

const FixedWidthWrapper = ({ children }: { children: React.ReactNode }) => (
  <Box sx={{ width: '600px' }}>
    {children}
  </Box>
);

const meta: Meta<typeof SkillsRankingPrompt> = {
  title: "Features/SkillsRanking/SkillsRankingPrompt",
  component: SkillsRankingPrompt,
  tags: ["autodocs"],
  argTypes: {
    onFinish: { action: "onFinish" }
  },
  args: {
    onFinish: async (state: SkillsRankingState) => { /*action("onFinish")(state)*/ },
    skillsRankingState: (() => {
      let skillsRankingState = getRandomSkillsRankingState();
      skillsRankingState.phase = SkillsRankingPhase.INITIAL;
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

type Story = StoryObj<typeof SkillsRankingPrompt>;

export const Shown: Story = {
  args: {},
};
