import type { Meta, StoryObj } from "@storybook/react";
import CompassChatMessage from "./CompassChatMessage";
import { nanoid } from "nanoid";
import { ReactionKind } from "src/chat/reaction/reaction.types";
import { getBackendUrl } from "src/envService";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";

const mockData = (status: number, deleteStatus: number, delay: number = 0) => [
  {
    url: getBackendUrl() + "/conversations/:session_id/messages/:message_id/reaction",
    method: "PUT",
    status: status,
    response: {},
    delay: delay,
  },
  {
    url: getBackendUrl() + "/conversations/:session_id/messages/:message_id/reaction",
    method: "DELETE",
    status: deleteStatus,
    response: () => {},
    delay: delay,
  },
];

const meta: Meta<typeof CompassChatMessage> = {
  title: "Chat/ChatMessage/CompassChatMessage",
  component: CompassChatMessage,
  tags: ["autodocs"],
  parameters: {
    mockData: mockData(200, 204),
  },
  decorators: [
    (Story) => {
      UserPreferencesStateService.getInstance().getActiveSessionId = () => 1234;
      return Story();
    },
  ],
};

export default meta;

type Story = StoryObj<typeof CompassChatMessage>;

export const Shown: Story = {
  args: {
    message_id: nanoid(),
    sent_at: new Date().toISOString(),
    message:
      "Before we start, would you like to introduce yourself and tell me a bit about your life and what brought you here today?",
    reaction: null,
  },
};

export const LongMessage: Story = {
  args: {
    message_id: nanoid(),
    sent_at: new Date().toISOString(),
    message:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
    reaction: null,
  },
};

export const LongUnBrokenWord: Story = {
  args: {
    message_id: nanoid(),
    sent_at: new Date().toISOString(),
    message: "a".repeat(1000),
    reaction: null,
  },
};

export const SingleLetter: Story = {
  args: {
    message_id: nanoid(),
    sent_at: new Date().toISOString(),
    message: "a",
    reaction: null,
  },
};

export const ShownWithDifferentTimestamps: Story = {
  render: () => (
    <>
      <CompassChatMessage
        message_id={nanoid()}
        sent_at={new Date().toISOString()}
        message="sent just now"
        reaction={null}
      />
      <CompassChatMessage
        message_id={nanoid()}
        sent_at={new Date(Date.now() - 1000 * 60 * 60).toISOString()}
        message="sent an hour ago"
        reaction={null}
      />
      <CompassChatMessage
        message_id={nanoid()}
        sent_at={new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString()}
        message="sent yesterday"
        reaction={null}
      />
      <CompassChatMessage
        message_id={nanoid()}
        sent_at={new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString()}
        message="sent two days ago"
        reaction={null}
      />
      <CompassChatMessage
        message_id={nanoid()}
        sent_at={new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString()}
        message="sent a week ago"
        reaction={null}
      />
      <CompassChatMessage
        message_id={nanoid()}
        sent_at={new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString()}
        message="sent a month ago"
        reaction={null}
      />
      <CompassChatMessage
        message_id={nanoid()}
        sent_at={new Date(Date.now() - 1000 * 60 * 60 * 24 * 30 * 12).toISOString()}
        message="sent a year ago"
        reaction={null}
      />
    </>
  ),
};

export const ShownWithLikeReaction: Story = {
  args: {
    message_id: nanoid(),
    sent_at: new Date().toISOString(),
    message: "Liked message",
    reaction: {
      id: nanoid(),
      kind: ReactionKind.LIKED,
    },
  },
};

export const ShownWithDislikeReaction: Story = {
  args: {
    message_id: nanoid(),
    sent_at: new Date().toISOString(),
    message: "Disliked message",
    reaction: {
      id: nanoid(),
      kind: ReactionKind.DISLIKED,
    },
  },
};
