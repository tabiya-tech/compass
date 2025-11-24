import { Meta, StoryObj } from "@storybook/react";
import { Box } from "@mui/material";
import { action } from "@storybook/addon-actions";
import SkillsRankingDisclosure from "src/features/skillsRanking/components/skillsRankingDisclosure/SkillsRankingDisclosure";
import {
  SkillsRankingExperimentGroups,
  SkillsRankingPhase,
  SkillsRankingState,
} from "src/features/skillsRanking/types";
import { getRandomSkillsRankingState } from "src/features/skillsRanking/utils/getSkillsRankingState";

const FixedWidthWrapper = ({ children }: { children: React.ReactNode }) => (
  <Box sx={{ width: "700px", padding: "50px" }}>{children}</Box>
);

const meta: Meta<typeof SkillsRankingDisclosure> = {
  title: "Features/SkillsRanking/SkillsRankingDisclosure",
  component: SkillsRankingDisclosure,
  tags: ["autodocs"],
  decorators: [
    (Story) => {
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

const createStateForGroup = (
  group: SkillsRankingExperimentGroups,
  labelsCount: number = 2
): SkillsRankingState => {
  const state = getRandomSkillsRankingState(SkillsRankingPhase.DISCLOSURE, group);
  // Override with specific label counts for testing
  state.score.above_average_labels = Array.from({ length: labelsCount }, () => "Skill " + Math.random().toString(36).substring(7));
  state.score.below_average_labels = Array.from({ length: labelsCount }, () => "Skill " + Math.random().toString(36).substring(7));
  state.phase = [
    {
      name: SkillsRankingPhase.DISCLOSURE,
      time: new Date().toISOString(),
    },
  ];
  return state;
};

const handleFinish = async (state: SkillsRankingState) => {
  action("finish")(state);
};

export const Group1: Story = {
  args: {
    onFinish: handleFinish,
    skillsRankingState: createStateForGroup(SkillsRankingExperimentGroups.GROUP_1),
  },
};

export const Group2: Story = {
  args: {
    onFinish: handleFinish,
    skillsRankingState: createStateForGroup(SkillsRankingExperimentGroups.GROUP_2),
  },
};

export const Group3: Story = {
  args: {
    onFinish: handleFinish,
    skillsRankingState: createStateForGroup(SkillsRankingExperimentGroups.GROUP_3),
  },
};

export const TenSkillGroups: Story = {
  args: {
    onFinish: handleFinish,
    skillsRankingState: createStateForGroup(SkillsRankingExperimentGroups.GROUP_3, 10),
  },
};
