import type { Meta, StoryObj } from "@storybook/react";
import ChatMessage from "./ChatMessage";
import { ChatMessageOrigin } from "src/chat/Chat.types";

const meta: Meta<typeof ChatMessage> = {
  title: "Chat/ChatMessage",
  component: ChatMessage,
  tags: ["autodocs"],
};

export default meta;

type Story = StoryObj<typeof ChatMessage>;

export const FromCompass: Story = {
  args: {
    chatMessage: {
      id: 1,
      origin: ChatMessageOrigin.COMPASS,
      timestamp: Date.now(),
      message:
        "Before we start, would you like to introduce yourself and tell me a bit about your life and what brought you here today?",
    },
  },
};

export const FromMe: Story = {
  args: {
    chatMessage: {
      id: 1,
      origin: ChatMessageOrigin.ME,
      timestamp: Date.now(),
      message: "Hi. I'm here to learn about my skills!",
    },
  },
};
