import { Meta, StoryObj } from "@storybook/react";
import CustomRating from "src/feedback/overallFeedback/feedbackForm/components/customRating/CustomRating";
import { action } from "@storybook/addon-actions";
import { QuestionType } from "src/feedback/overallFeedback/feedbackForm/feedbackForm.types";

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
    question_text: "How easy was it to interact with the system?",
    questionId: "interaction_ease",
    lowRatingLabel: "Not easy",
    highRatingLabel: "Very easy",
    comment_placeholder: "Please provide comments",
    description: "Test description",
    type: QuestionType.Rating
  },
};

export const ShownWithNoRating: Story = {
  args: {
    question_text: "How easy was it to interact with the system?",
    questionId: "interaction_ease",
    displayRating: false,
    comment_placeholder: "Please provide comments",
    description: "Test description",
    type: QuestionType.Rating
  },
};
