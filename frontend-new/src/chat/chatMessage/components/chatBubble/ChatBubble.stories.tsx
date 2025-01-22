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
    sender: ConversationMessageSender.COMPASS
  },
};

export const FromUser: Story = {
  args: {
    message: "Hi there, I am a baker!",
    sender: ConversationMessageSender.USER
  },
}

export const ShownWithFooter: Story = {
  args: {
    message: "Hello, how can I help you?",
    sender: ConversationMessageSender.COMPASS,
    children: <VisualMock text={"Foo Footer"} />
  }
}