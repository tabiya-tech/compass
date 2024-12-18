import { Meta, StoryObj } from "@storybook/react";
import TextConfirmModalDialog from "./TextConfirmModalDialog";

const meta: Meta<typeof TextConfirmModalDialog> = {
  title: "Components/TextConfirmModalDialog",
  component: TextConfirmModalDialog,
  tags: ["autodocs"],
  argTypes: {
    onConfirm: { action: "onConfirm" },
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
    confirmButtonText: "Yes, continue",
  },
};

export const ShownWithLongText: Story = {
  args: {
    title: "Sample Title",
    textParagraphs: [
      {
        id: "001",
        text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam nec purus nec nunc.".repeat(10),
      },
      {
        id: "002",
        text: "Are you sure you want to proceed?",
      },
    ],
    isOpen: true,
    cancelButtonText: "Cancel",
    confirmButtonText: "Yes, continue",
  },
};

export const ShownWithManyParagraphs: Story = {
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
      {
        id: "003",
        text: "This is a sample body text for the TextConfirmModalDialog component.",
      },
      {
        id: "004",
        text: "Are you sure you want to proceed?",
      },
      {
        id: "005",
        text: "This is a sample body text for the TextConfirmModalDialog component.",
      },
      {
        id: "006",
        text: "Are you sure you want to proceed?",
      },
      {
        id: "007",
        text: "This is a sample body text for the TextConfirmModalDialog component.",
      },
      {
        id: "008",
        text: "Are you sure you want to proceed?",
      },
      {
        id: "009",
        text: "This is a sample body text for the TextConfirmModalDialog component.",
      },
      {
        id: "010",
        text: "Are you sure you want to proceed?",
      },
    ],
    isOpen: true,
    cancelButtonText: "Cancel",
    confirmButtonText: "Yes, continue",
  },
};
