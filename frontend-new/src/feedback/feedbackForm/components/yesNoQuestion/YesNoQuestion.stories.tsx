import { Meta, StoryObj } from "@storybook/react";
import YesNoQuestion from "src/feedback/feedbackForm/components/yesNoQuestion/YesNoQuestion";
import { YesNoEnum } from "src/feedback/feedbackForm/feedback.types";
import { action } from "@storybook/addon-actions";

const meta: Meta<typeof YesNoQuestion> = {
  title: "Feedback/YesNoQuestion",
  component: YesNoQuestion,
  tags: ["autodocs"],
  args: {
    notifyChange: (value, comments) => {
      action("notifyChange")(value, comments);
    },
  },
};

export default meta;

type Story = StoryObj<typeof YesNoQuestion>;

export const ShowCommentsWhenYesSelected: Story = {
  args: {
    questionText: "Is this a question?",
    questionId: "is_question",
    showCommentsOn: YesNoEnum.Yes,
  },
};

export const ShowCommentsWhenNoSelected: Story = {
  args: {
    questionText: "Is this not a question?",
    questionId: "is_not_question",
    showCommentsOn: YesNoEnum.No,
  },
};
