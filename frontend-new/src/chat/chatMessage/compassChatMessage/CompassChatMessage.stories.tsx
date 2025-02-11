import type { Meta, StoryObj } from "@storybook/react";
import CompassChatMessage from "./CompassChatMessage";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import { nanoid } from "nanoid";
import { ChatMessageType } from "src/chat/Chat.types";
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
    chatMessage: {
      message_id: nanoid(),
      sender: ConversationMessageSender.COMPASS,
      sent_at: new Date().toISOString(),
      message:
        "Before we start, would you like to introduce yourself and tell me a bit about your life and what brought you here today?",
      type: ChatMessageType.BASIC_CHAT,
      reaction: null,
    },
  },
};

export const LongMessage: Story = {
  args: {
    chatMessage: {
      message_id: nanoid(),
      sender: ConversationMessageSender.COMPASS,
      sent_at: new Date().toISOString(),
      message:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
      type: ChatMessageType.BASIC_CHAT,
      reaction: null,
    },
  },
};

export const LongUnBrokenWord: Story = {
  args: {
    chatMessage: {
      message_id: nanoid(),
      sender: ConversationMessageSender.COMPASS,
      sent_at: new Date().toISOString(),
      message: "a".repeat(1000),
      type: ChatMessageType.BASIC_CHAT,
      reaction: null,
    },
  },
};

export const SingleLetter: Story = {
  args: {
    chatMessage: {
      message_id: nanoid(),
      sender: ConversationMessageSender.COMPASS,
      sent_at: new Date().toISOString(),
      message: "a",
      type: ChatMessageType.BASIC_CHAT,
      reaction: null,
    },
  },
};

export const ShownWithDifferentTimestamps: Story = {
  render: () => (
    <>
      <CompassChatMessage
        chatMessage={{
          message_id: nanoid(),
          sender: ConversationMessageSender.COMPASS,
          sent_at: new Date().toISOString(),
          message: "sent just now",
          type: ChatMessageType.BASIC_CHAT,
          reaction: null,
        }}
      />
      <CompassChatMessage
        chatMessage={{
          message_id: nanoid(),
          sender: ConversationMessageSender.COMPASS,
          sent_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
          message: "sent an hour ago",
          type: ChatMessageType.BASIC_CHAT,
          reaction: null,
        }}
      />
      <CompassChatMessage
        chatMessage={{
          message_id: nanoid(),
          sender: ConversationMessageSender.COMPASS,
          sent_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
          message: "sent yesterday",
          type: ChatMessageType.BASIC_CHAT,
          reaction: null,
        }}
      />
      <CompassChatMessage
        chatMessage={{
          message_id: nanoid(),
          sender: ConversationMessageSender.COMPASS,
          sent_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
          message: "sent two days ago",
          type: ChatMessageType.BASIC_CHAT,
          reaction: null,
        }}
      />
      <CompassChatMessage
        chatMessage={{
          message_id: nanoid(),
          sender: ConversationMessageSender.COMPASS,
          sent_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
          message: "sent a week ago",
          type: ChatMessageType.BASIC_CHAT,
          reaction: null,
        }}
      />
      <CompassChatMessage
        chatMessage={{
          message_id: nanoid(),
          sender: ConversationMessageSender.COMPASS,
          sent_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
          message: "sent a month ago",
          type: ChatMessageType.BASIC_CHAT,
          reaction: null,
        }}
      />
      <CompassChatMessage
        chatMessage={{
          message_id: nanoid(),
          sender: ConversationMessageSender.COMPASS,
          sent_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30 * 12).toISOString(),
          message: "sent a year ago",
          type: ChatMessageType.BASIC_CHAT,
          reaction: null,
        }}
      />
    </>
  ),
};

export const ShownWithLikeReaction: Story = {
  args: {
    chatMessage: {
      message_id: nanoid(),
      sender: ConversationMessageSender.COMPASS,
      sent_at: new Date().toISOString(),
      message: "Liked message",
      type: ChatMessageType.BASIC_CHAT,
      reaction: {
        id: nanoid(),
        kind: ReactionKind.LIKED,
      },
    },
  },
};

export const ShownWithDislikeReaction: Story = {
  args: {
    chatMessage: {
      message_id: nanoid(),
      sender: ConversationMessageSender.COMPASS,
      sent_at: new Date().toISOString(),
      message: "Disliked message",
      type: ChatMessageType.BASIC_CHAT,
      reaction: {
        id: nanoid(),
        kind: ReactionKind.DISLIKED,
      },
    },
  },
};
