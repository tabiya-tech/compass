import { Meta, StoryObj } from "@storybook/react";
import RotateToSolvePuzzle from "src/features/skillsRanking/components/rotateToSolve/RotateToSolvePuzzle";
import { action } from "@storybook/addon-actions";
import { Box } from "@mui/material";

const FixedWidthWrapper = ({ children }: { children: React.ReactNode }) => (
  <Box sx={{ width: "400px", margin: "0 auto" }}>{children}</Box>
);

const meta: Meta<typeof RotateToSolvePuzzle> = {
  title: "Features/SkillsRanking/RotateToSolvePuzzle",
  component: RotateToSolvePuzzle,
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

type Story = StoryObj<typeof RotateToSolvePuzzle>;

const BaseArgs = {
  onSuccess: () => action("onSuccess")(),
  onCancel: () => action("onCancel")(),
  onReport: (metrics: any) => action("onReport")(metrics),
  puzzles: 2,
  tolerance: 45,
  rotationStep: 45,
  stringPool: ["GJRLK", "FQZNC"],
  disabled: false,
  isReplay: false,
  isReplayFinished: false,
};

// Normal interactive state
export const Interactive: Story = {
  args: {
    ...BaseArgs,
  },
  parameters: {
    docs: {
      description: {
        story: "Normal interactive state where user can solve puzzles",
      },
    },
  },
};

// Disabled state
export const Disabled: Story = {
  args: {
    ...BaseArgs,
    disabled: true,
  },
  parameters: {
    docs: {
      description: {
        story: "Disabled state where user cannot interact with puzzles",
      },
    },
  },
};