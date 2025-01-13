import type { Meta, StoryObj } from "@storybook/react";
import ChatMessageFooter from "./ChatMessageFooter";

const meta: Meta<typeof ChatMessageFooter> = {
  title: "Chat/ChatMessageFooter",
  component: ChatMessageFooter,
  tags: ["autodocs"],
  argTypes: {},
};

export default meta;

type Story = StoryObj<typeof ChatMessageFooter>;

export const Shown: Story = {
  args: {
    sentAt: new Date().toISOString()
  },
};