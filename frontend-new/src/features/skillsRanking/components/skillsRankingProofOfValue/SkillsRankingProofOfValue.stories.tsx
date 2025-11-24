import { Meta, StoryObj } from "@storybook/react";
import SkillsRankingProofOfValue from "src/features/skillsRanking/components/skillsRankingProofOfValue/SkillsRankingProofOfValue";
import { getRandomSkillsRankingState } from "src/features/skillsRanking/utils/getSkillsRankingState";
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

const BaseArgs = {
  onFinish: async (state: SkillsRankingState) => {
    action("onFinish")(state);
  },
  skillsRankingState: (() => {
    const base = getRandomSkillsRankingState();
    base.phase = createPhaseArray(SkillsRankingPhase.PROOF_OF_VALUE);
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
