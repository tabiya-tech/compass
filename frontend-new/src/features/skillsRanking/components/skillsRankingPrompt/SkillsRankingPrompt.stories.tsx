import { Meta, StoryObj } from "@storybook/react";
import SkillsRankingPrompt from "src/features/skillsRanking/components/skillsRankingPrompt/SkillsRankingPrompt";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { getRandomSkillsRankingState } from "src/features/skillsRanking/utils/getSkillsRankingState";
import { SkillsRankingService } from "src/features/skillsRanking/skillsRankingService/skillsRankingService";
import {
  SkillsRankingPhase,
  SkillsRankingState,
  SkillsRankingPhaseWithTime,
  SkillsRankingExperimentGroups,
} from "src/features/skillsRanking/types";
import { Box } from "@mui/material";
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

const meta: Meta<typeof SkillsRankingPrompt> = {
  title: "Features/SkillsRanking/SkillsRankingPrompt",
  component: SkillsRankingPrompt,
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

type Story = StoryObj<typeof SkillsRankingPrompt>;

const BaseArgs = {
  onFinish: async (state: SkillsRankingState) => {
    action("onFinish")(state);
  },
  skillsRankingState: (() => {
    const base = getRandomSkillsRankingState();
    base.phase = createPhaseArray(SkillsRankingPhase.INITIAL);
    return base;
  })(),
};

export const Group1_NoDisclosure: Story = {
  args: {
    ...BaseArgs,
    skillsRankingState: {
      ...BaseArgs.skillsRankingState,
      metadata: { ...BaseArgs.skillsRankingState.metadata, experiment_group: SkillsRankingExperimentGroups.GROUP_1 },
    },
  },
};

export const Group2_MostDemandedOnly: Story = {
  args: {
    ...BaseArgs,
    skillsRankingState: {
      ...BaseArgs.skillsRankingState,
      metadata: { ...BaseArgs.skillsRankingState.metadata, experiment_group: SkillsRankingExperimentGroups.GROUP_2 },
    },
  },
};

export const Group3_MostAndLeastDemanded: Story = {
  args: {
    ...BaseArgs,
    skillsRankingState: {
      ...BaseArgs.skillsRankingState,
      metadata: { ...BaseArgs.skillsRankingState.metadata, experiment_group: SkillsRankingExperimentGroups.GROUP_3 },
    },
  },
};
