import { Meta, StoryObj } from "@storybook/react";
import SkillsRankingJobMarketDisclosure from "src/features/skillsRanking/components/skillsRankingDisclosure/SkillsRankingJobMarketDisclosure";
import { getRandomSkillsRankingState } from "src/features/skillsRanking/utils/getSkillsRankingState";
import { SkillsRankingExperimentGroups, SkillsRankingPhase } from "../../types";

type StoryArgs = React.ComponentProps<typeof SkillsRankingJobMarketDisclosure> & {
  experimentGroup: SkillsRankingExperimentGroups;
};

const meta: Meta<StoryArgs> = {
  title: "Features/SkillsRanking/SkillsRankingJobMarketDisclosure",
  component: SkillsRankingJobMarketDisclosure,
  tags: ["autodocs"],
  argTypes: {
    onFinish: { action: "onFinish" },
    experimentGroup: {
      name: "Experiment Group",
      control: { type: "select" },
      options: Object.values(SkillsRankingExperimentGroups),
    },
  },
  args: {
    experimentGroup: SkillsRankingExperimentGroups.GROUP_1,
  },
  render: (args) => {
    const state = getRandomSkillsRankingState();
    state.experiment_group = args.experimentGroup;
    state.phase = SkillsRankingPhase.EFFORT;

    return <SkillsRankingJobMarketDisclosure {...args} skillsRankingState={state} />;
  },
};

export default meta;

type Story = StoryObj<typeof SkillsRankingJobMarketDisclosure>;

export const Shown: Story = {
  args: {},
};
