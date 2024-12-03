import { Meta, StoryObj } from "@storybook/react";
import CheckboxQuestion from "src/feedback/feedbackForm/components/checkboxQuestion/CheckboxQuestion";
import { action } from "@storybook/addon-actions";

const meta: Meta<typeof CheckboxQuestion> = {
  title: "Feedback/CheckboxQuestion",
  component: CheckboxQuestion,
  tags: ["autodocs"],
  args: {
    notifyChange: (selectedOptions, comments) => {
      action("notifyChange")(selectedOptions, comments);
    },
  },
};

export default meta;

type Story = StoryObj<typeof CheckboxQuestion>;

export const Shown: Story = {
  args: {
    questionId: "accuracy_relevance",
    questionText: "How accurate and relevant was the information provided?",
    options: [
      { key: "accurate", value: "Accurate" },
      { key: "relevant", value: "Relevant" },
      { key: "upToDate", value: "Up-to-date" },
      { key: "easyToUnderstand", value: "Easy to understand" },
    ],
    selectedOptions: [],
  },
};
