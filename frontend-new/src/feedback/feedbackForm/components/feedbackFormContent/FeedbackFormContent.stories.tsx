import { Meta, type StoryObj } from "@storybook/react";
import FeedbackContent from "src/feedback/feedbackForm/components/feedbackFormContent/FeedbackFormContent";

const meta:Meta<typeof FeedbackContent> ={
  title: "Feedback/FeedbackContent",
  component: FeedbackContent,
  tags: ["autodocs"],
  args: {
    notifySubmit: () => {},
  },
}
export default meta;

type Story = StoryObj<typeof FeedbackContent>;

export const Shown: Story = {
  args: {}
}