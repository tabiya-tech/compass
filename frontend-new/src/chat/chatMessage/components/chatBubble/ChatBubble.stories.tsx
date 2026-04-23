import type { Meta, StoryObj } from "@storybook/react";
import ChatBubble from "./ChatBubble";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import { VisualMock } from "src/_test_utilities/VisualMock";

const meta: Meta<typeof ChatBubble> = {
  title: "Chat/ChatBubble",
  component: ChatBubble,
  tags: ["autodocs"],
  argTypes: {},
};

export default meta;

type Story = StoryObj<typeof ChatBubble>;

export const FromCompass: Story = {
  args: {
    message: "Hello, how can I help you?",
    sender: ConversationMessageSender.COMPASS,
  },
};

export const FromUser: Story = {
  args: {
    message: "Hi there, I am a baker!",
    sender: ConversationMessageSender.USER,
  },
};

// Reproduces the formatting bug: agent responses with backtick-wrapped text should not render
// in monospace font or overflow horizontally.
export const WithCodeFormatting: Story = {
  args: {
    message:
      "Great! I've learned a lot about your preferences.\n\nHere's what I understand about what matters to you in a job:\n\n```\nIt looks like you've given a lot of thought to what you want in a job! Based on what you've shared, here are a few key things:\n```\n\n- Making a positive social impact and feeling like your work has a purpose is really important to you.\n- You also value having a secure job with reliable income.\n- Good financial compensation is a significant factor for you as well.\n- You're looking for work that aligns with your values and offers opportunities for growth.\n\nThank you for sharing your preferences with me.",
    sender: ConversationMessageSender.COMPASS,
  },
};

export const ShownWithFooter: Story = {
  args: {
    message: "Hello, how can I help you?",
    sender: ConversationMessageSender.COMPASS,
    children: <VisualMock text={"Foo Footer"} />,
  },
};
