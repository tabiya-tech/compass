import React, { useEffect, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import ChatMessageField, { ChatMessageFieldProps } from "./ChatMessageField";
import { action } from "@storybook/addon-actions";

const meta: Meta<typeof ChatMessageField> = {
  title: "Chat/ChatMessageField",
  component: ChatMessageField,
  tags: ["autodocs"],
  argTypes: {
    handleSend: { action: "message sent" },
    notifyChange: { action: "change happened" },
  },
};

export default meta;

type Story = StoryObj<typeof ChatMessageField>;

const ChatMessageFieldWrapper: React.FC<ChatMessageFieldProps> = (props) => {
  const [message, setMessage] = useState<string>(props.message);

  const handleSend = () => {
    props.handleSend();
    setMessage("");
  };

  useEffect(() => {
    if (message.length > 0) props.notifyChange(message);
  }, [message, props]);

  return <ChatMessageField {...props} message={message} notifyChange={setMessage} handleSend={handleSend} />;
};

export const Shown: Story = {
  render: (args) => <ChatMessageFieldWrapper {...args} />,
  args: {
    message: "",
    handleSend: action("Message sent"),
  },
};

export const AIIsTyping: Story = {
  render: (args) => <ChatMessageFieldWrapper {...args} />,
  args: {
    message: "",
    handleSend: action("Message sent"),
    aiIsTyping: true,
  },
};

export const ChatIsClosed: Story = {
  render: (args) => <ChatMessageFieldWrapper {...args} />,
  args: {
    message: "",
    handleSend: action("Message sent"),
    isChatFinished: true,
  },
};
