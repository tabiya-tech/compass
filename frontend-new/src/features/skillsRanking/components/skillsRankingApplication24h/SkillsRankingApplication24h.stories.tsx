import { Meta, StoryObj } from "@storybook/react";
import { Box } from "@mui/material";
import { action } from "@storybook/addon-actions";
import SkillsRankingApplication24h from "src/features/skillsRanking/components/skillsRankingApplication24h/SkillsRankingApplication24h";
import {
  SkillsRankingExperimentGroups,
  SkillsRankingPhase,
  SkillsRankingState,
} from "src/features/skillsRanking/types";
import { getRandomSkillsRankingState } from "src/features/skillsRanking/utils/getSkillsRankingState";

const FixedWidthWrapper = ({ children }: { children: React.ReactNode }) => (
  <Box sx={{ width: "600px" }}>{children}</Box>
);

const meta: Meta<typeof SkillsRankingApplication24h> = {
  title: "Features/SkillsRanking/SkillsRankingApplication24h",
  component: SkillsRankingApplication24h,
  decorators: [
    (Story) => (
      <FixedWidthWrapper>
        <Story />
      </FixedWidthWrapper>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof SkillsRankingApplication24h>;

const createStateForGroup = (
  group: SkillsRankingExperimentGroups,
  prefilled?: number
): SkillsRankingState => {
  const state = getRandomSkillsRankingState(SkillsRankingPhase.APPLICATION_24H, group);
  if (prefilled !== undefined) {
    state.user_responses.application_24h = prefilled;
  }
  state.phase = [
    {
      name: SkillsRankingPhase.APPLICATION_24H,
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
    skillsRankingState: createStateForGroup(SkillsRankingExperimentGroups.GROUP_2, 6),
  },
};

export const Group3: Story = {
  args: {
    onFinish: handleFinish,
    skillsRankingState: createStateForGroup(SkillsRankingExperimentGroups.GROUP_3, 12),
  },
};

