import { Meta, StoryObj } from "@storybook/react";
import SkillsRankingRetypedRank from "src/features/skillsRanking/components/skillsRankingRetypedRank/SkillsRankingRetypedRank";
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

const meta: Meta<typeof SkillsRankingRetypedRank> = {
  title: "Features/SkillsRanking/SkillsRankingRetypedRank",
  component: SkillsRankingRetypedRank,
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

type Story = StoryObj<typeof SkillsRankingRetypedRank>;

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
    skillsRankingState: createState(SkillsRankingPhase.RETYPED_RANK),
  },
};