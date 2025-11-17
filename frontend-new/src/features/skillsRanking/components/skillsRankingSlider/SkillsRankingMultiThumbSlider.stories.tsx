import { Meta, StoryObj } from "@storybook/react";
import SkillsRankingMultiThumbSlider from "./SkillsRankingMultiThumbSlider";

const meta: Meta<typeof SkillsRankingMultiThumbSlider> = {
  title: "Features/SkillsRanking/SkillsRankingMultiThumbSlider",
  component: SkillsRankingMultiThumbSlider,
  tags: ["autodocs"],
};

export default meta;

type Story = StoryObj<typeof SkillsRankingMultiThumbSlider>;

export const Default: Story = {
  args: {
    values: [
      { value: 20, label: "Average Demand for Your Skills", color: "#4caf50" },
      { value: 75, label: "Demand for Your Most Asked-for Skill", color: "#eac932" },
    ],
    "data-testid": "skills-ranking-multi-thumb-slider",
    onChange: () => {},
  },
};
