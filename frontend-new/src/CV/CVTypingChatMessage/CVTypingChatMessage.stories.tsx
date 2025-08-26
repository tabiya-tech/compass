import { Meta, StoryObj } from "@storybook/react";
import CVTypingChatMessage from "src/CV/CVTypingChatMessage/CVTypingChatMessage";

const meta: Meta<typeof CVTypingChatMessage> = {
  title: "Chat/ChatMessage/CVTypingChatMessage",
  component: CVTypingChatMessage,
  tags: ["autodocs"],
};

export default meta;

type Story = StoryObj<typeof CVTypingChatMessage>;

export const Shown: Story = {};

export const ShowAfterUpload: Story = { args: { isUploaded: true } };
