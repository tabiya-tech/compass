import { Meta, StoryObj } from "@storybook/react";
import { Box } from "@mui/material";
import { action } from "@storybook/addon-actions";
import SkillsRankingApplicationMotivation from "src/features/skillsRanking/components/skillsRankingApplicationMotivation/SkillsRankingApplicationMotivation";
import {
  SkillsRankingExperimentGroups,
  SkillsRankingPhase,
  SkillsRankingState,
} from "src/features/skillsRanking/types";
import { getRandomSkillsRankingState } from "src/features/skillsRanking/utils/getSkillsRankingState";

const FixedWidthWrapper = ({ children }: { children: React.ReactNode }) => (
  <Box sx={{ width: "600px" }}>{children}</Box>
);

const meta: Meta<typeof SkillsRankingApplicationMotivation> = {
  title: "Features/SkillsRanking/SkillsRankingApplicationMotivation",
  component: SkillsRankingApplicationMotivation,
  decorators: [
    (Story) => (
      <FixedWidthWrapper>
        <Story />
      </FixedWidthWrapper>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof SkillsRankingApplicationMotivation>;

const createStateForGroup = (
  group: SkillsRankingExperimentGroups,
  prefilled?: boolean
): SkillsRankingState => {
  const state = getRandomSkillsRankingState(SkillsRankingPhase.APPLICATION_WILLINGNESS, group);
  state.phase = [
    {
      name: SkillsRankingPhase.APPLICATION_WILLINGNESS,
      time: new Date().toISOString(),
    },
  ];

  if (prefilled) {
    state.user_responses.application_willingness = {
      value: 5,
      label: "Motivated",
    };
  } else {
    state.user_responses.application_willingness = undefined;
  }

  return state;
};

const handleFinish = async (state: SkillsRankingState) => {
  action("finish")(state);
};

export const Group1_control: Story = {
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

export const Group3_prefilled: Story = {
  name: "Group 3 (prefilled)",
  args: {
    onFinish: handleFinish,
    skillsRankingState: createStateForGroup(SkillsRankingExperimentGroups.GROUP_3, true),
  },
};

