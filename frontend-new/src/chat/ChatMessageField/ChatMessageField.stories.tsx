import type { Meta, StoryObj } from "@storybook/react";
import ChatMessageField from "./ChatMessageField";

const meta: Meta<typeof ChatMessageField> = {
  title: "Chat/ChatMessageField",
  component: ChatMessageField,
  tags: ["autodocs"],
  argTypes: {},
};

export default meta;

type Story = StoryObj<typeof ChatMessageField>;

export const Shown: Story = {
  args: {},
};
