import { Meta, StoryObj } from "@storybook/react";
import TypingIndicator from "./TypingIndicator";

const meta: Meta<typeof TypingIndicator> = {
  title: "Chat/ChatMessage/TypingIndicator",
  component: TypingIndicator,
  tags: ["autodocs"],
};

export default meta;

type Story = StoryObj<typeof TypingIndicator>;

export const Shown: Story = {
  args: {},
};
