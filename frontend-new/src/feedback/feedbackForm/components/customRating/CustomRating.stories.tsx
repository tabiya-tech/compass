import { Meta, StoryObj } from "@storybook/react";
import CustomRating from "src/feedback/feedbackForm/components/customRating/CustomRating";
import { action } from "@storybook/addon-actions";

const meat: Meta<typeof CustomRating> = {
  title: "Feedback/CustomRating",
  component: CustomRating,
  tags: ["autodocs"],
  args: {
    notifyChange: (value, comments) => {
      action("notifyChange")(value, comments);
    },
  },
};

export default meat;

type Story = StoryObj<typeof CustomRating>;

export const Shown: Story = {
  args: {
    questionText: "How easy was it to interact with the system?",
    questionId: "interaction_ease",
    lowRatingLabel: "Not easy",
    highRatingLabel: "Very easy",
    placeholder: "Please provide comments",
  },
};

export const ShownWithNoRating: Story = {
  args: {
    questionText: "How easy was it to interact with the system?",
    questionId: "interaction_ease",
    displayRating: false,
    placeholder: "Please provide comments",
  },
};
