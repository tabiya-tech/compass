import CancellableTypingChatMessage from "./CancellableTypingChatMessage";
import { Meta, StoryObj } from "@storybook/react";
import { action } from "@storybook/addon-actions";

const meta: Meta<typeof CancellableTypingChatMessage> = {
  title: "Features/SkillsRanking/CancellableTypingChatMessage",
  component: CancellableTypingChatMessage,
  tags: ["autodocs"],
  argTypes: {
    onCancel: { action: "cancel clicked" },
  },
};

export default meta;

type Story = StoryObj<typeof CancellableTypingChatMessage>;

const asyncAction = (name: string) => async () => {
  action(name)();
};

export const Shown: Story = {
  args: {
    onCancel: asyncAction("cancel clicked"),
  },
};

export const ShownWithQuickTyping: Story = {
  args: {
    onCancel: asyncAction("cancel clicked"),
    waitBeforeThinking: 1000,
  },
};

export const ShownWithTyping: Story = {
  args: {
    onCancel: asyncAction("cancel clicked"),
    waitBeforeThinking: 15000,
  },
};

export const ShownWhenThinking: Story = {
  args: {
    onCancel: asyncAction("cancel clicked"),
    waitBeforeThinking: 0,
  },
};

export const WithCustomMessages: Story = {
  args: {
    onCancel: asyncAction("cancel clicked"),
    message: "Processing your request",
    thinkingMessage: "Analyzing the data",
    waitBeforeThinking: 2000,
  },
}; 