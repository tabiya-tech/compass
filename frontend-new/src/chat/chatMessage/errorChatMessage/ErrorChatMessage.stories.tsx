import type { Meta, StoryObj } from "@storybook/react";
import ErrorChatMessage from "./ErrorChatMessage";

const meta: Meta<typeof ErrorChatMessage> = {
  title: "Chat/ChatMessage/ErrorChatMessage",
  component: ErrorChatMessage,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof ErrorChatMessage>;

export const CompassError: Story = {
  args: {
    message: "An error occurred while processing your request.",
  },
};

export const UserError: Story = {
  args: {
    message: "Failed to send message. Please try again.",
  },
};

export const LongErrorMessage: Story = {
  args: {
    message: "A detailed error message that spans multiple lines and contains more information about what went wrong. This helps users understand the issue better and what they might need to do to resolve it.",
  },
};

export const WithChildren: Story = {
  args: {
    message: "Error with additional information",
    children: <div style={{ color: "red", fontSize: "0.8em" }}>Additional error details</div>,
  },
}; 