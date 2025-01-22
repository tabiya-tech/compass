import type { Meta, StoryObj } from "@storybook/react";
import Timestamp from "./Timestamp";

const meta: Meta<typeof Timestamp> = {
  title: "Chat/ChatMessageFooter/Timestamp",
  component: Timestamp,
  tags: ["autodocs"],
  argTypes: {},
};

export default meta;

type Story = StoryObj<typeof Timestamp>;

export const Shown: Story = {
  args: {
    sentAt: new Date().toISOString()
  },
};