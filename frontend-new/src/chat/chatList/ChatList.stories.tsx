import type { Meta, StoryObj } from "@storybook/react";
import ChatList from "./ChatList";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import { nanoid } from "nanoid";
import { ChatMessageType } from "src/chat/Chat.types";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";

const meta: Meta<typeof ChatList> = {
  title: "Chat/ChatList",
  component: ChatList,
  tags: ["autodocs"],
  argTypes: {},
  decorators: [
    (Story) => {
      UserPreferencesStateService.getInstance().getActiveSessionId = () => 1234;
      return Story();
    },
  ],
};

export default meta;

type Story = StoryObj<typeof ChatList>;

export const Shown: Story = {
  args: {
    messages: [
      {
        message_id: nanoid(),
        sender: ConversationMessageSender.COMPASS,
        message: "Hello, how can I help you?",
        sent_at: new Date().toISOString(),
        type: ChatMessageType.BASIC_CHAT,
        reaction: null,
      },
      {
        message_id: nanoid(),
        sender: ConversationMessageSender.USER,
        message: "I need help with something",
        sent_at: new Date().toString(),
        type: ChatMessageType.BASIC_CHAT,
        reaction: null,
      },
    ],
  },
};

export const Empty: Story = {
  args: {
    messages: [],
  },
};

export const Typing: Story = {
  args: {
    messages: [
      {
        message_id: nanoid(),
        sender: ConversationMessageSender.USER,
        message: "Hello, how can I help you?",
        sent_at: new Date().toISOString(),
        type: ChatMessageType.BASIC_CHAT,
        reaction: null,
      },
      {
        message_id: nanoid(),
        sender: ConversationMessageSender.COMPASS,
        message: "",
        sent_at: new Date().toString(),
        type: ChatMessageType.TYPING,
        reaction: null,
      },
    ],
  },
};

export const TypingWhenEmpty: Story = {
  args: {
    messages: [
      {
        message_id: nanoid(),
        sender: ConversationMessageSender.COMPASS,
        message: "",
        sent_at: new Date().toString(),
        type: ChatMessageType.TYPING,
        reaction: null,
      },
    ],
  },
};

export const LongConversation: Story = {
  args: {
    messages: Array.from({ length: 100 }, (_, i) => ({
      message_id: nanoid(),
      sender: i % 2 === 0 ? ConversationMessageSender.COMPASS : ConversationMessageSender.USER,
      message: `Message ${i}`,
      sent_at: new Date(Date.now() - i * 1000 * 60 * 60 * 24).toISOString(),
      type: ChatMessageType.BASIC_CHAT,
      reaction: null,
    })),
  },
};
