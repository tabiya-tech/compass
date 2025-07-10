import React from "react";
import { Meta, StoryObj } from "@storybook/react";
import SkillsRankingJobMarketDisclosure from "src/features/skillsRanking/components/skillsRankingDisclosure/skillsRankingMarketDisclosure/SkillsRankingJobMarketDisclosure";
import { getRandomSkillsRankingState } from "src/features/skillsRanking/utils/getSkillsRankingState";
import {
  SkillsRankingExperimentGroups,
  SkillsRankingPhase,
  SkillsRankingState,
} from "src/features/skillsRanking/types";

// Wrapper props for story configuration
type StoryArgs = {
  experimentGroup: SkillsRankingExperimentGroups;
  phase: SkillsRankingPhase;
  onFinish: (skillsRankingState: SkillsRankingState) => Promise<void>;
};

const StoryWrapper = ({ experimentGroup, phase, onFinish }: StoryArgs) => {
  const state = getRandomSkillsRankingState();
  state.experiment_group = experimentGroup;
  state.phase = phase;

  return (
    <SkillsRankingJobMarketDisclosure
      skillsRankingState={state}
      onFinish={onFinish}
    />
  );
};

const meta: Meta<StoryArgs> = {
  title: "Features/SkillsRanking/SkillsRankingJobMarketDisclosure",
  component: StoryWrapper,
  tags: ["autodocs"],
  argTypes: {
    experimentGroup: {
      name: "Experiment Group",
      control: { type: "select" },
      options: Object.values(SkillsRankingExperimentGroups),
    },
    phase: {
      name: "Phase",
      control: { type: "select" },
      options: Object.values(SkillsRankingPhase),
    },
    onFinish: { action: "onFinish" },
  },
};

export default meta;

type Story = StoryObj<StoryArgs>;

export const WithDisclosureFlow: Story = {
  args: {
    experimentGroup: SkillsRankingExperimentGroups.GROUP_1,
    phase: SkillsRankingPhase.MARKET_DISCLOSURE,
  },
};

export const WithoutDisclosureFlow: Story = {
  args: {
    experimentGroup: SkillsRankingExperimentGroups.GROUP_2,
    phase: SkillsRankingPhase.PROOF_OF_VALUE,
  },
};
