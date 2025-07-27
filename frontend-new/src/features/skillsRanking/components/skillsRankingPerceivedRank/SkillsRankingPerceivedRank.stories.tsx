import { Meta, StoryObj } from "@storybook/react";
import SkillsRankingPerceivedRank from "src/features/skillsRanking/components/skillsRankingPerceivedRank/SkillsRankingPerceivedRank";
import { getRandomSkillsRankingState } from "src/features/skillsRanking/utils/getSkillsRankingState";
import {
  SkillsRankingPhase,
  SkillsRankingState,
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

const meta: Meta<typeof SkillsRankingPerceivedRank> = {
  title: "Features/SkillsRanking/SkillsRankingPerceivedRank",
  component: SkillsRankingPerceivedRank,
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

type Story = StoryObj<typeof SkillsRankingPerceivedRank>;

const createState = (phase: SkillsRankingPhase) => {
  const state = getRandomSkillsRankingState();
  state.phase = createPhaseArray(phase);
  return state;
};

export const Default: Story = {
  args: {
    onFinish: async (state: SkillsRankingState) => {
      console.log("onFinish called with state:", state);
    },
    skillsRankingState: createState(SkillsRankingPhase.PERCEIVED_RANK),
  },
};
