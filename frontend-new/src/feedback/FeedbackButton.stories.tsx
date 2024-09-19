import type { Meta, StoryObj } from "@storybook/react";
import FeedbackButton from "./FeedbackButton";

const meta: Meta<typeof FeedbackButton> = {
  title: "Components/FeedbackButton",
  component: FeedbackButton,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof FeedbackButton>;

export const Shown: Story = {
  args: {},
};
