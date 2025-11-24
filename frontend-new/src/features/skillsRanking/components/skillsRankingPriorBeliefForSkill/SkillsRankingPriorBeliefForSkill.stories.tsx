import { Meta, StoryObj } from "@storybook/react";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import SkillsRankingPriorBeliefForSkill from "src/features/skillsRanking/components/skillsRankingPriorBeliefForSkill/SkillsRankingPriorBeliefForSkill";
import { SkillsRankingService } from "src/features/skillsRanking/skillsRankingService/skillsRankingService";
import {
  SkillsRankingExperimentGroups,
  SkillsRankingPhase,
  SkillsRankingPhaseWithTime,
  SkillsRankingState,
} from "src/features/skillsRanking/types";
import { action } from "@storybook/addon-actions";
import { getRandomSkillsRankingState } from "src/features/skillsRanking/utils/getSkillsRankingState";
import { Box } from "@mui/material";

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

const meta: Meta<typeof SkillsRankingPriorBeliefForSkill> = {
  title: "Features/SkillsRanking/SkillsRankingPriorBeliefForSkill",
  component: SkillsRankingPriorBeliefForSkill,
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

type Story = StoryObj<typeof SkillsRankingPriorBeliefForSkill>;

const BaseArgs = {
  onFinish: async (state: SkillsRankingState) => {
    action("onFinish")(state);
  },
  skillsRankingState: (() => {
    const base = getRandomSkillsRankingState();
    base.phase = createPhaseArray(SkillsRankingPhase.PRIOR_BELIEF_FOR_SKILL);
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
