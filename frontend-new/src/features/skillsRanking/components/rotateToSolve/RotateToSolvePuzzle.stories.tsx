import type { Meta, StoryObj } from "@storybook/react";
import RotateToSolvePuzzle from "./RotateToSolvePuzzle";
import { action } from "@storybook/addon-actions";
const meta: Meta<typeof RotateToSolvePuzzle> = {
  title: "Features/SkillsRanking/RotateToSolvePuzzle",
  component: RotateToSolvePuzzle,
};

export default meta;

type Story = StoryObj<typeof RotateToSolvePuzzle>;

// Basic usage
export const Default: Story = {
  args: {
    onSuccess: action("solved"),
    puzzles: 2,
  },
};
