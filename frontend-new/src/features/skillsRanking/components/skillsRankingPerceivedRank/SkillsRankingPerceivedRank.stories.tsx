import { Box } from "@mui/material";
import { faker } from "@faker-js/faker";
import { Meta, StoryObj } from "@storybook/react";
import { action } from "@storybook/addon-actions";

import SkillsRankingPerceivedRank
  from "src/features/skillsRanking/components/skillsRankingPerceivedRank/SkillsRankingPerceivedRank";

const FixedWidthWrapper = ({ children }: { children: React.ReactNode }) => (
  <Box sx={{ width: "700px", padding: "50px" }}>{children}</Box>
);

const meta: Meta<typeof SkillsRankingPerceivedRank> = {
  title: "Features/SkillsRanking/SkillsRankingPerceivedRank",
  component: SkillsRankingPerceivedRank,
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

type Story = StoryObj<typeof SkillsRankingPerceivedRank>;

export const Default: Story = {
  args: {
    onSubmit: (value: number) => action(`User Clicked ${value}`),
    isReadOnly: false,
    mostDemandedLabel: faker.word.words({ count: 2 }),
    sentAt: faker.date.recent().toISOString(),
  },
};

export const ReadOnly: Story = {
  args: {
    onSubmit: (value: number) => action("onSubmit")({ value }),
    isReadOnly: true,
    defaultValue: 45,
    mostDemandedLabel: faker.word.words({ count: 3 }),
    sentAt: faker.date.recent().toISOString(),
  },
};

export const Group2: Story = {
  args: {
    onSubmit: (value: number) => action("onSubmit")({ value }),
    isReadOnly: false,
    mostDemandedLabel: faker.word.words({ count: 2 }),
    sentAt: faker.date.recent().toISOString(),
  },
};

export const Group3: Story = {
  args: {
    onSubmit: (value: number) => action("onSubmit")({ value }),
    isReadOnly: false,
    mostDemandedLabel: faker.word.words({ count: 3 }),
    sentAt: faker.date.recent().toISOString(),
  },
};

export const VerLongLabel: Story = {
  args: {
    onSubmit: (value: number) => action("onSubmit")({ value }),
    isReadOnly: false,
    mostDemandedLabel: faker.word.words({ count: 7 }),
    sentAt: faker.date.recent().toISOString(),
  },
};
