import { Meta, StoryObj } from "@storybook/react";
import TextConfirmModalDialog from "./TextConfirmModalDialog";

const meta: Meta<typeof TextConfirmModalDialog> = {
  title: "Components/TextConfirmModalDialog",
  component: TextConfirmModalDialog,
  tags: ["autodocs"],
  argTypes: {
    onApprove: { action: "onApprove" },
    onCancel: { action: "onCancel" },
  },
};

export default meta;

type Story = StoryObj<typeof TextConfirmModalDialog>;

export const Shown: Story = {
  args: {
    title: "Sample Title",
    textParagraphs: [
      {
        id: "001",
        text: "This is a sample body text for the TextConfirmModalDialog component.",
      },
      {
        id: "002",
        text: "Are you sure you want to proceed?",
      },
    ],
    isOpen: true,
    cancelButtonText: "Cancel",
    approveButtonText: "Yes, continue",
  },
};
