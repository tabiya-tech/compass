import type { Meta, StoryObj } from "@storybook/react";
import QuickReplyButtons from "./QuickReplyButtons";

const meta: Meta<typeof QuickReplyButtons> = {
  title: "Chat/ChatMessage/QuickReplyButtons",
  component: QuickReplyButtons,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
};

export default meta;

type Story = StoryObj<typeof QuickReplyButtons>;

export const Default: Story = {
  args: {
    options: [{ label: "Yes" }, { label: "No" }, { label: "Tell me more" }],
    onSelect: (label: string) => console.log("Selected:", label),
  },
};

export const SingleOption: Story = {
  args: {
    options: [{ label: "Continue" }],
    onSelect: (label: string) => console.log("Selected:", label),
  },
};

export const ManyOptions: Story = {
  args: {
    options: [
      { label: "Technical skills" },
      { label: "Soft skills" },
      { label: "Leadership" },
      { label: "Communication" },
      { label: "Problem solving" },
    ],
    onSelect: (label: string) => console.log("Selected:", label),
  },
};

export const LongText: Story = {
  args: {
    options: [
      { label: "I sold vegetables for the farm and collected money." },
      { label: "I never sold produce, but I counted the money." },
      { label: "No, I was never in a leadership role." },
    ],
    onSelect: (label: string) => console.log("Selected:", label),
  },
};
