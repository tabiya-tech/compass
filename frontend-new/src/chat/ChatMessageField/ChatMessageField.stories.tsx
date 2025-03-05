import React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import ChatMessageField, { ChatMessageFieldProps } from "./ChatMessageField";
import { action } from "@storybook/addon-actions";

const meta: Meta<typeof ChatMessageField> = {
  title: "Chat/ChatMessageField",
  component: ChatMessageField,
  tags: ["autodocs"],
  argTypes: {
    handleSend: { action: "message sent" },
  },
};

export default meta;

type Story = StoryObj<typeof ChatMessageField>;

const ChatMessageFieldWrapper: React.FC<ChatMessageFieldProps> = (props) => {
  const handleSend = (message: string) => {
    props.handleSend(message);
  };
  return <ChatMessageField {...props} handleSend={handleSend} />;
};

export const Shown: Story = {
  render: (args) => <ChatMessageFieldWrapper {...args} />,
  args: {
    handleSend: action("Message sent"),
  },
};

export const AIIsTyping: Story = {
  render: (args) => <ChatMessageFieldWrapper {...args} />,
  args: {
    handleSend: action("Message sent"),
    aiIsTyping: true,
  },
};

export const ChatIsClosed: Story = {
  render: (args) => <ChatMessageFieldWrapper {...args} />,
  args: {
    handleSend: action("Message sent"),
    isChatFinished: true,
  },
};
