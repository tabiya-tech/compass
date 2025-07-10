import { Meta, StoryObj } from "@storybook/react";
import SkillsRankingProofOfValue from "src/features/skillsRanking/components/skillsRankingProofOfValue/SkillsRankingProofOfValue";
import { getRandomSkillsRankingState } from "src/features/skillsRanking/utils/getSkillsRankingState";
import {
  SkillsRankingExperimentGroups,
  SkillsRankingPhase,
  SkillsRankingState,
} from "src/features/skillsRanking/types";
import { Box } from "@mui/material";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { SkillsRankingService } from "src/features/skillsRanking/skillsRankingService/skillsRankingService";
import { action } from "@storybook/addon-actions";

const FixedWidthWrapper = ({ children }: { children: React.ReactNode }) => (
  <Box sx={{ width: "600px" }}>
    {children}
  </Box>
);

type StoryArgs = React.ComponentProps<typeof SkillsRankingProofOfValue> & {
  experimentGroup: SkillsRankingExperimentGroups;
};

const meta: Meta<StoryArgs> = {
  title: "Features/SkillsRanking/SkillsRankingProofOfValue",
  component: SkillsRankingProofOfValue,
  tags: ["autodocs"],
  argTypes: {
    experimentGroup: {
      name: "Experiment Group",
      control: { type: "select" },
      options: Object.values(SkillsRankingExperimentGroups),
    },
  },
  decorators: [
    (Story, context) => {
      // Mock User Session
      const mockUserPreferencesStateService = UserPreferencesStateService.getInstance();
      mockUserPreferencesStateService.getActiveSessionId = () => 1234;

      // Mock SkillsRankingService
      // @ts-ignore
      SkillsRankingService.getInstance().updateSkillsRankingState = (
        sessionId: number,
        phase: SkillsRankingPhase,
        cancelled_after?: string,
        perceived_rank_percentile?: number,
        retyped_rank_percentile?: number,
        metrics?: any
      ) => {
        action("updateSkillsRankingState")(phase, metrics);
        return new Promise((resolve) => {
          setTimeout(() => {
            const newState = getRandomSkillsRankingState();
            newState.phase = phase;
            resolve(newState);
          }, 1000);
        });
      };

      return (
        <FixedWidthWrapper>
          <Story {...context} />
        </FixedWidthWrapper>
      );
    },
  ],
};

export default meta;

type Story = StoryObj<StoryArgs>;

const generateState = (group: SkillsRankingExperimentGroups): SkillsRankingState => {
  const state = getRandomSkillsRankingState();
  state.experiment_group = group;
  state.phase = SkillsRankingPhase.PROOF_OF_VALUE;
  return state;
};

// ⏳ TIME_BASED Groups
export const Group1_TimeBased: Story = {
  name: "Group 1 – Time-Based",
  args: { experimentGroup: SkillsRankingExperimentGroups.GROUP_1 },
  render: (args) => (
    <SkillsRankingProofOfValue
      onFinish={async () => {
        action("onFinish");
      }}
      skillsRankingState={generateState(args.experimentGroup)}
    />
  ),
};

export const Group4_TimeBased: Story = {
  name: "Group 4 – Time-Based",
  args: { experimentGroup: SkillsRankingExperimentGroups.GROUP_4 },
  render: (args) => (
    <SkillsRankingProofOfValue
      onFinish={async () => {
        action("onFinish");
      }}
      skillsRankingState={generateState(args.experimentGroup)}
    />
  ),
};

// 🧩 WORK_BASED Groups
export const Group2_WorkBased: Story = {
  name: "Group 2 – Work-Based",
  args: { experimentGroup: SkillsRankingExperimentGroups.GROUP_2 },
  render: (args) => (
    <SkillsRankingProofOfValue
      onFinish={async () => {
        action("onFinish");
      }}
      skillsRankingState={generateState(args.experimentGroup)}
    />
  ),
};

export const Group3_WorkBased: Story = {
  name: "Group 3 – Work-Based",
  args: { experimentGroup: SkillsRankingExperimentGroups.GROUP_3 },
  render: (args) => (
    <SkillsRankingProofOfValue
      onFinish={async () => {
        action("onFinish");
      }}
      skillsRankingState={generateState(args.experimentGroup)}
    />
  ),
};
