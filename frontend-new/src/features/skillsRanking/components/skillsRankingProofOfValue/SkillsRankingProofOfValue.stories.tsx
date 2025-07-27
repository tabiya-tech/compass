import { Meta, StoryObj } from "@storybook/react";
import SkillsRankingProofOfValue from "src/features/skillsRanking/components/skillsRankingProofOfValue/SkillsRankingProofOfValue";
import { getRandomSkillsRankingState } from "src/features/skillsRanking/utils/getSkillsRankingState";
import {
  SkillsRankingPhase,
  SkillsRankingState,
  SkillsRankingExperimentGroups,
  SkillsRankingPhaseWithTime,
} from "src/features/skillsRanking/types";
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

const meta: Meta<typeof SkillsRankingProofOfValue> = {
  title: "Features/SkillsRanking/SkillsRankingProofOfValue",
  component: SkillsRankingProofOfValue,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <FixedWidthWrapper>
        <Story />
      </FixedWidthWrapper>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof SkillsRankingProofOfValue>;

const createState = (phase: SkillsRankingPhase, experimentGroup: SkillsRankingExperimentGroups) => {
  const state = getRandomSkillsRankingState();
  state.phase = createPhaseArray(phase);
  state.experiment_group = experimentGroup;
  return state;
};

export const TimeBased: Story = {
  args: {
    onFinish: async (state: SkillsRankingState) => {
      console.log("onFinish called with state:", state);
    },
    skillsRankingState: createState(SkillsRankingPhase.PROOF_OF_VALUE, SkillsRankingExperimentGroups.GROUP_1),
  },
};

export const WorkBased: Story = {
  args: {
    onFinish: async (state: SkillsRankingState) => {
      console.log("onFinish called with state:", state);
    },
    skillsRankingState: createState(SkillsRankingPhase.PROOF_OF_VALUE, SkillsRankingExperimentGroups.GROUP_2),
  },
};
