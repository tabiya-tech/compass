import type { Meta, StoryObj } from "@storybook/react";
import ChatProgressBar from "./ChatProgressBar";
import { ConversationPhase } from "./types";

const meta: Meta<typeof ChatProgressBar> = {
  title: "Chat/ChatProgressBar",
  component: ChatProgressBar,
  tags: ["autodocs"],
  argTypes: {
    phase: {
      options: Object.values(ConversationPhase),
      control: {
        type: "select",
      }
    }
  }
};

export default meta;

type Story = StoryObj<typeof ChatProgressBar>;

export const Shown: Story = {
  args: {
    percentage: 75,
    phase: ConversationPhase.DIVE_IN
  },
};

export const Initializing: Story = {
  args: {
    percentage: 0,
    phase: ConversationPhase.INITIALIZING
  },
};

export const Introduction: Story = {
  args: {
    percentage: 0,
    phase: ConversationPhase.INTRO
  },
};

export const CollectExperiences: Story = {
  args: {
    percentage: 5,
    phase: ConversationPhase.COLLECT_EXPERIENCES
  },
};

export const DiveIn: Story = {
  args: {
    percentage: 30,
    phase: ConversationPhase.DIVE_IN
  },
};

export const Ended: Story = {
  args: {
    percentage: 100,
    phase: ConversationPhase.ENDED
  },
};

export const Unknown: Story = {
  args: {
    percentage: 0,
    phase: ConversationPhase.UNKNOWN
  },
};

