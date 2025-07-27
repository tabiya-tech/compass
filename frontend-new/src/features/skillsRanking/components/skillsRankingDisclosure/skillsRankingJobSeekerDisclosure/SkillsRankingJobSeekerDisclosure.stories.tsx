import { Meta, StoryObj } from "@storybook/react";
import SkillsRankingJobSeekerDisclosure from "src/features/skillsRanking/components/skillsRankingDisclosure/skillsRankingJobSeekerDisclosure/SkillsRankingJobSeekerDisclosure";
import { getRandomSkillsRankingState } from "src/features/skillsRanking/utils/getSkillsRankingState";
import {
  SkillsRankingPhase,
  SkillsRankingState,
  SkillsRankingExperimentGroups,
  SkillsRankingPhaseWithTime,
} from "src/features/skillsRanking/types";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { SkillsRankingService } from "src/features/skillsRanking/skillsRankingService/skillsRankingService";
import { action } from "@storybook/addon-actions";

import { Box } from "@mui/material";

const FixedWidthWrapper = ({ children }: { children: React.ReactNode }) => (
  <Box sx={{ width: "600px" }}>{children}</Box>
);

const createPhaseArray = (phase: SkillsRankingPhase): SkillsRankingPhaseWithTime[] => {
  return [{
    name: phase,
    time: new Date().toISOString()
  }];
};

const meta: Meta<typeof SkillsRankingJobSeekerDisclosure> = {
  title: "Features/SkillsRanking/SkillsRankingJobSeekerDisclosure",
  component: SkillsRankingJobSeekerDisclosure,
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
        phase: SkillsRankingPhase
      ) => {
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

type Story = StoryObj<typeof SkillsRankingJobSeekerDisclosure>;

const BaseArgs = {
  onFinish: async (state: SkillsRankingState) => {
    action("onFinish")(state);
  },
  skillsRankingState: (() => {
    const base = getRandomSkillsRankingState();
    base.phase = createPhaseArray(SkillsRankingPhase.JOB_SEEKER_DISCLOSURE);
    return base;
  })(),
};

// GROUP 1: Disclosed
export const Group1_Disclosed: Story = {
  args: {
    ...BaseArgs,
    skillsRankingState: {
      ...BaseArgs.skillsRankingState,
      experiment_group: SkillsRankingExperimentGroups.GROUP_1,
    },
  },
};

// GROUP 2: Undisclosed
export const Group2_Undisclosed: Story = {
  args: {
    ...BaseArgs,
    skillsRankingState: {
      ...BaseArgs.skillsRankingState,
      experiment_group: SkillsRankingExperimentGroups.GROUP_2,
    },
  },
};

// GROUP 3: Disclosed
export const Group3_Disclosed: Story = {
  args: {
    ...BaseArgs,
    skillsRankingState: {
      ...BaseArgs.skillsRankingState,
      experiment_group: SkillsRankingExperimentGroups.GROUP_3,
    },
  },
};

// GROUP 4: Undisclosed
export const Group4_Undisclosed: Story = {
  args: {
    ...BaseArgs,
    skillsRankingState: {
      ...BaseArgs.skillsRankingState,
      experiment_group: SkillsRankingExperimentGroups.GROUP_4,
    },
  },
};
