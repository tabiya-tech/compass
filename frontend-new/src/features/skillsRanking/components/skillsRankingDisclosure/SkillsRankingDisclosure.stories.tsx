import { Meta, StoryObj } from "@storybook/react";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { SkillsRankingService } from "src/features/skillsRanking/skillsRankingService/skillsRankingService";
import { SkillsRankingPhase, SkillsRankingPhaseWithTime, SkillsRankingState } from "src/features/skillsRanking/types";
import { action } from "@storybook/addon-actions";
import { getRandomSkillsRankingState } from "src/features/skillsRanking/utils/getSkillsRankingState";
import { Box } from "@mui/material";
import SkillsRankingDisclosure from "./SkillsRankingDisclosure";

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

const meta: Meta<typeof SkillsRankingDisclosure> = {
  title: "Features/SkillsRanking/SkillsRankingDisclosure",
  component: SkillsRankingDisclosure,
  tags: ["autodocs"],
  decorators: [
    (Story) => {
      // Mock session ID
      const mockUserPreferencesStateService = UserPreferencesStateService.getInstance();
      mockUserPreferencesStateService.getActiveSessionId = () => 1234;

      // Mock state update call
      // @ts-ignore
      SkillsRankingService.getInstance().updateSkillsRankingState = (sessionId: number, phase: SkillsRankingPhase) => {
        return new Promise((resolve) => {
          setTimeout(() => {
            action("success")(`Updated skills ranking state to phase: ${phase}`);
            resolve(getRandomSkillsRankingState());
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

type Story = StoryObj<typeof SkillsRankingDisclosure>;

export const Default: Story = {
  args: {
    onFinish: async (state: SkillsRankingState) => {
      action("onFinish")(state);
    },
    skillsRankingState: (() => {
      const base = getRandomSkillsRankingState();
      base.phases = createPhaseArray(SkillsRankingPhase.DISCLOSURE);
      return base;
    })(),
  },
};
