import { Meta, StoryObj } from "@storybook/react";
import SkillsRankingRetypedRank from "src/features/skillsRanking/components/skillsRankingRetypedRank/SkillsRankingRetypedRank";
import { getRandomSkillsRankingState } from "src/features/skillsRanking/utils/getSkillsRankingState";
import {
  SkillsRankingState,
  SkillsRankingPhase,
  SkillsRankingPhaseWithTime,
  SkillsRankingExperimentGroups,
} from "src/features/skillsRanking/types";
import { Box } from "@mui/material";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { SkillsRankingService } from "src/features/skillsRanking/skillsRankingService/skillsRankingService";
import { action } from "@storybook/addon-actions";

const FixedWidthWrapper = ({ children }: { children: React.ReactNode }) => (
  <Box sx={{ width: "600px" }}>{children}</Box>
);

const createPhaseArray = (phase: SkillsRankingPhase): SkillsRankingPhaseWithTime[] => {
  return [
    {
      name: phase,
      time: new Date().toISOString(),
    },
  ];
};

const meta: Meta<typeof SkillsRankingRetypedRank> = {
  title: "Features/SkillsRanking/SkillsRankingRetypedRank",
  component: SkillsRankingRetypedRank,
  tags: ["autodocs"],
  decorators: [
    (Story) => {
      // Mock session ID
      const mockUserPreferencesStateService = UserPreferencesStateService.getInstance();
      mockUserPreferencesStateService.getActiveSessionId = () => 1234;

      // Mock state update call
      // @ts-ignore
      SkillsRankingService.getInstance().updateSkillsRankingState = (
        sessionId: number,
        phase: SkillsRankingPhase,
        perceivedRankPercentile?: number,
        retypedRankPercentile?: number
      ) => {
        return new Promise((resolve) => {
          setTimeout(() => {
            action("success")(`Updated skills ranking state to phase: ${phase}`);
            resolve(getRandomSkillsRankingState(phase, SkillsRankingExperimentGroups.GROUP_1));
          }, 1000);
        });
      };

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

const createState = (phase: SkillsRankingPhase) => {
  const state = getRandomSkillsRankingState(phase, SkillsRankingExperimentGroups.GROUP_1);
  state.phases = createPhaseArray(phase);
  return state;
};

export const Default: Story = {
  args: {
    onFinish: async (state: SkillsRankingState) => {
      console.log("onFinish called with state:", state);
    },
    skillsRankingState: createState(SkillsRankingPhase.RETYPED_RANK),
  },
};
