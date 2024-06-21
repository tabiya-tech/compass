import type { Meta, StoryObj } from "@storybook/react";
import ChatMessage from "./ChatMessage";
import { ChatMessageOrigin } from "./ChatMessage.types";

const meta: Meta<typeof ChatMessage> = {
  title: "Chat/ChatMessage",
  component: ChatMessage,
  tags: ["autodocs"],
  argTypes: {
    origin: {
      control: "select",
      options: [ChatMessageOrigin.COMPASS, ChatMessageOrigin.ME],
    },
    message: {
      control: "text",
    },
    time: {
      control: "date",
    },
  },
};

export default meta;

type Story = StoryObj<typeof ChatMessage>;

export const FromCompass: Story = {
  args: {
    origin: ChatMessageOrigin.COMPASS,
    message:
      "Before we start, would you like to introduce yourself and tell me a bit about your life and what brought you here today?",
    time: new Date(),
  },
};

export const FromMe: Story = {
  args: {
    origin: ChatMessageOrigin.ME,
    message: "Hi. I'm here to learn about my skills!",
    time: new Date(),
  },
};
