import type { Meta, StoryObj } from "@storybook/react";
import ChatMessageFooter, { ChatMessageFooterChildren } from "./ChatMessageFooter";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";

const meta: Meta<typeof ChatMessageFooter> = {
  title: "Chat/ChatMessageFooter",
  component: ChatMessageFooter,
  tags: ["autodocs"],
  args: {
    messageId: "001",
    sentAt: new Date(2024, 10, 20).toISOString(),
  },
  decorators: [
    (Story) => {
      UserPreferencesStateService.getInstance().getActiveSessionId = () => 1234;
      return Story();
    },
  ],
};

export default meta;

type Story = StoryObj<typeof ChatMessageFooter>;

export const Shown: Story = {
  args: {
    visibleChildren: [ChatMessageFooterChildren.TIMESTAMP, ChatMessageFooterChildren.REACTIONS],
  },
};

export const ShownWithoutReactions: Story = {
  args: {
    visibleChildren: [ChatMessageFooterChildren.TIMESTAMP],
  },
};
