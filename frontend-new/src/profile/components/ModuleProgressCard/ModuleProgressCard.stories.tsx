import type { Meta, StoryObj } from "@storybook/react";
import { ModuleProgressCard } from "./ModuleProgressCard";

const meta: Meta<typeof ModuleProgressCard> = {
  title: "Profile/Components/ModuleProgressCard",
  component: ModuleProgressCard,
  tags: ["autodocs"],
};

export default meta;

type Story = StoryObj<typeof ModuleProgressCard>;

export const Default: Story = {
  args: {
    overallProgress: 78,
    educationProgress: 100,
    workProgress: 55,
  },
};

export const SingleModule: Story = {
  args: {
    overallProgress: 100,
    educationProgress: 100,
    workProgress: 100,
  },
};

export const AllCompleted: Story = {
  args: {
    overallProgress: 100,
    educationProgress: 100,
    workProgress: 100,
  },
};

export const AllInProgress: Story = {
  args: {
    overallProgress: 52,
    educationProgress: 67,
    workProgress: 38,
  },
};

export const JustStarted: Story = {
  args: {
    overallProgress: 10,
    educationProgress: 0,
    workProgress: 20,
  },
};

export const ManyModules: Story = {
  args: {
    overallProgress: 85,
    educationProgress: 100,
    workProgress: 70,
  },
};

export const LongModuleNames: Story = {
  args: {
    overallProgress: 63,
    educationProgress: 67,
    workProgress: 60,
  },
};

export const NoModules: Story = {
  args: {
    overallProgress: 0,
    educationProgress: 0,
    workProgress: 0,
  },
};
