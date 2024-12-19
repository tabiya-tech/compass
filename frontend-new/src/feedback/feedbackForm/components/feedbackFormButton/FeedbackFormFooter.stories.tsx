import type { Meta, StoryObj } from "@storybook/react";
import FeedbackFormFooter from "./FeedbackFormFooter";
import { action } from "@storybook/addon-actions";

const meta: Meta<typeof FeedbackFormFooter> = {
  title: "Chat/FeedbackFormFooter",
  component: FeedbackFormFooter,
  tags: ["autodocs"],
  args: {
    notifyOpenFeedbackForm: action("notifyOpenFeedbackForm"),
  },
};

export default meta;

type Story = StoryObj<typeof FeedbackFormFooter>;

export const Shown: Story = {
  args: {
    notifyOpenFeedbackForm: action("notifyOpenFeedbackForm"),
  },
};
