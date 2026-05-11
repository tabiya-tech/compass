import type { Meta, StoryObj } from "@storybook/react";
import FeedbackModal from "src/feedback/feedbackModal/FeedbackModal";

const meta: Meta<typeof FeedbackModal> = {
  title: "Components/FeedbackModal",
  component: FeedbackModal,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof FeedbackModal>;

export const Open: Story = {
  args: {
    isOpen: true,
    onClose: () => {},
    onSubmit: () => {},
  },
};

export const Closed: Story = {
  args: {
    isOpen: false,
    onClose: () => {},
    onSubmit: () => {},
  },
};
