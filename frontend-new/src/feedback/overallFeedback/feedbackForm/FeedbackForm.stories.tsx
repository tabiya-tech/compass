import { Meta, type StoryObj } from "@storybook/react";
import { action } from "@storybook/addon-actions";
import FeedbackForm from "src/feedback/overallFeedback/feedbackForm/FeedbackForm";

const meta: Meta<typeof FeedbackForm> = {
  title: "Feedback/FeedbackForm",
  component: FeedbackForm,
  tags: ["autodocs"],
  args: {
    notifyOnClose: action("notifyOnClose"),
  },
  argTypes: {},
};

export default meta;

type Story = StoryObj<typeof FeedbackForm>;

export const Shown: Story = {
  args: {
    isOpen: true,
  },
};
