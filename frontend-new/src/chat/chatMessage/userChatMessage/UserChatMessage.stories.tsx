import type { Meta, StoryObj } from "@storybook/react";
import UserChatMessage from "./UserChatMessage";

const meta: Meta<typeof UserChatMessage> = {
  title: "Chat/ChatMessage/UserChatMessage",
  component: UserChatMessage,
  tags: ["autodocs"],
};

export default meta;

type Story = StoryObj<typeof UserChatMessage>;

export const Shown: Story = {
  args: {
    message: "Hi. I'm here to learn about my skills!",
    sent_at: new Date().toISOString(),
  },
};

export const LongMessage: Story = {
  args: {
    sent_at: new Date().toISOString(),
    message:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
  },
};

export const LongUnBrokenWord: Story = {
  args: {
    sent_at: new Date().toISOString(),
    message: "a".repeat(1000),
  },
};

export const SingleLetter: Story = {
  args: {
    sent_at: new Date().toISOString(),
    message: "a",
  },
};

export const ShownWithDifferentTimestamps: Story = {
  render: () => (
    <>
      <UserChatMessage sent_at={new Date().toISOString()} message="sent just now" />
      <UserChatMessage sent_at={new Date(Date.now() - 1000 * 60 * 60).toISOString()} message="sent an hour ago" />
      <UserChatMessage sent_at={new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString()} message="sent yesterday" />
      <UserChatMessage
        sent_at={new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString()}
        message="sent two days ago"
      />
      <UserChatMessage
        sent_at={new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString()}
        message="sent a week ago"
      />
      <UserChatMessage
        sent_at={new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString()}
        message="sent a month ago"
      />
      <UserChatMessage
        sent_at={new Date(Date.now() - 1000 * 60 * 60 * 24 * 30 * 12).toISOString()}
        message="sent a year ago"
      />
    </>
  ),
};
