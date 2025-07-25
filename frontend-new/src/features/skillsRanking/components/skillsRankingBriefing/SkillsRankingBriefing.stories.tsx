import { Meta, StoryObj } from "@storybook/react";
import SkillsRankingBriefing from "src/features/skillsRanking/components/skillsRankingBriefing/SkillsRankingBriefing";
import { getRandomSkillsRankingState } from "src/features/skillsRanking/utils/getSkillsRankingState";
import {
  SkillsRankingPhase,
  SkillsRankingState,
  SkillsRankingExperimentGroups,
} from "src/features/skillsRanking/types";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { SkillsRankingService } from "src/features/skillsRanking/skillsRankingService/skillsRankingService";
import { action } from "@storybook/addon-actions";

import { Box } from "@mui/material";

const FixedWidthWrapper = ({ children }: { children: React.ReactNode }) => (
  <Box sx={{ width: "600px" }}>{children}</Box>
);

const meta: Meta<typeof SkillsRankingBriefing> = {
  title: "Features/SkillsRanking/SkillsRankingBriefing",
  component: SkillsRankingBriefing,
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

type Story = StoryObj<typeof SkillsRankingBriefing>;

const BaseArgs = {
  onFinish: async (state: SkillsRankingState) => {
    action("onFinish")(state);
  },
  skillsRankingState: (() => {
    const base = getRandomSkillsRankingState();
    base.phase = SkillsRankingPhase.BRIEFING;
    return base;
  })(),
};

// GROUP 1: TIME_BASED
export const Group1_TimeBased: Story = {
  args: {
    ...BaseArgs,
    skillsRankingState: {
      ...BaseArgs.skillsRankingState,
      experiment_group: SkillsRankingExperimentGroups.GROUP_1,
    },
  },
};

// GROUP 2: WORK_BASED
export const Group2_WorkBased: Story = {
  args: {
    ...BaseArgs,
    skillsRankingState: {
      ...BaseArgs.skillsRankingState,
      experiment_group: SkillsRankingExperimentGroups.GROUP_2,
    },
  },
};

// GROUP 3: WORK_BASED
export const Group3_WorkBased: Story = {
  args: {
    ...BaseArgs,
    skillsRankingState: {
      ...BaseArgs.skillsRankingState,
      experiment_group: SkillsRankingExperimentGroups.GROUP_3,
    },
  },
};

// GROUP 4: TIME_BASED
export const Group4_TimeBased: Story = {
  args: {
    ...BaseArgs,
    skillsRankingState: {
      ...BaseArgs.skillsRankingState,
      experiment_group: SkillsRankingExperimentGroups.GROUP_4,
    },
  },
};
