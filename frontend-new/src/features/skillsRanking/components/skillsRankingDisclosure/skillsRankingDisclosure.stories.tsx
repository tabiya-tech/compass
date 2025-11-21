import React from "react";
import { Box } from "@mui/material";
import { faker } from "@faker-js/faker";
import { Meta, StoryObj } from "@storybook/react";

import SkillsRankingDisclosure
  from "src/features/skillsRanking/components/skillsRankingDisclosure/SkillsRankingDisclosure";
import { SkillsRankingExperimentGroups } from "src/features/skillsRanking/types";

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

const getArgs = (group: SkillsRankingExperimentGroups, labelsCount: number = 2) => ({
  group,
  mostDemandedLabel: faker.word.words({ count: 3 }),
  mostDemandedLabelPercentage: faker.number.int({ min: 1, max: 100 }),
  aboveAverageLabels: Array.from({ length: labelsCount }, () => faker.word.words({ count: 2 })),
  leastDemandedLabel: faker.word.words({ count: 2 }),
  leastDemandedLabelPercentage: faker.number.int({ min: 1, max: 100 }),
  belowAverageLabels: Array.from({ length: labelsCount }, () => faker.word.words({ count: 2 })),
  averagePercentForJobSeeker: faker.number.int({ min: 1, max: 100 }),
  sentAt: faker.date.recent().toISOString(),
});

export const Default: Story = {
  args: getArgs(SkillsRankingExperimentGroups.GROUP_3),
};

export const Group1: Story = {
  args: getArgs(SkillsRankingExperimentGroups.GROUP_1),
};

export const Group2: Story = {
  args: getArgs(SkillsRankingExperimentGroups.GROUP_2),
};

export const Group3: Story = {
  args: getArgs(SkillsRankingExperimentGroups.GROUP_3),
};

export const TenSkillGroups = {
  args: getArgs(SkillsRankingExperimentGroups.GROUP_3, 10),
};

export const UnexpectedGroup = {
  args: getArgs(SkillsRankingExperimentGroups.GROUP_4),
};
