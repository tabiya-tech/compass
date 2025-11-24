import { Box } from "@mui/material";
import { faker } from "@faker-js/faker";
import { Meta, StoryObj } from "@storybook/react";
import { action } from "@storybook/addon-actions";

import SkillsRankingPerceivedRankForSkill
  from "src/features/skillsRanking/components/skillsRankingPerceivedRankForSkill/SkillsRankingPerceivedRankForSkill";

const FixedWidthWrapper = ({ children }: { children: React.ReactNode }) => (
  <Box sx={{ width: "700px", padding: "50px" }}>{children}</Box>
);

const meta: Meta<typeof SkillsRankingPerceivedRankForSkill> = {
  title: "Features/SkillsRanking/SkillsRankingPerceivedRankForSkill",
  component: SkillsRankingPerceivedRankForSkill,
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

type Story = StoryObj<typeof SkillsRankingPerceivedRankForSkill>;

export const Default: Story = {
  args: {
    onSubmit: (value: number) => action("onSubmit")(`User Clicked ${value}`),
    isReadOnly: false,
    leastDemandedLabel: faker.word.words({ count: 2 }),
    sentAt: faker.date.recent().toISOString(),
  },
};

export const ReadOnly: Story = {
  args: {
    onSubmit: (value: number) => action("onSubmit")({ value }),
    isReadOnly: true,
    defaultValue: 45,
    leastDemandedLabel: faker.word.words({ count: 3 }),
    sentAt: faker.date.recent().toISOString(),
  },
};

export const Group2: Story = {
  args: {
    onSubmit: (value: number) => action("onSubmit")({ value }),
    isReadOnly: false,
    leastDemandedLabel: faker.word.words({ count: 2 }),
    sentAt: faker.date.recent().toISOString(),
  },
};

export const Group3: Story = {
  args: {
    onSubmit: (value: number) => action("onSubmit")({ value }),
    isReadOnly: false,
    leastDemandedLabel: faker.word.words({ count: 3 }),
    sentAt: faker.date.recent().toISOString(),
  },
};

export const VerLongLabel: Story = {
  args: {
    onSubmit: (value: number) => action("onSubmit")({ value }),
    isReadOnly: false,
    leastDemandedLabel: faker.word.words({ count: 7 }),
    sentAt: faker.date.recent().toISOString(),
  },
};
