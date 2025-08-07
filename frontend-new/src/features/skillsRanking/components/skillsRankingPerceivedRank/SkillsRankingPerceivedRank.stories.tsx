import { Meta, StoryObj } from "@storybook/react";
import SkillsRankingPerceivedRank from "src/features/skillsRanking/components/skillsRankingPerceivedRank/SkillsRankingPerceivedRank";
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

const meta: Meta<typeof SkillsRankingPerceivedRank> = {
  title: "Features/SkillsRanking/SkillsRankingPerceivedRank",
  component: SkillsRankingPerceivedRank,
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

type Story = StoryObj<typeof SkillsRankingPerceivedRank>;

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
    skillsRankingState: createState(SkillsRankingPhase.PERCEIVED_RANK),
  },
};
