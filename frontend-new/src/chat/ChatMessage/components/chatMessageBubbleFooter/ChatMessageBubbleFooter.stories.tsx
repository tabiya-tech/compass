import type { Meta, StoryObj } from "@storybook/react";
import ChatMessageBubbleFooter from "./ChatMessageBubbleFooter";
import { ChatMessageFooterType } from "../../ChatMessage";
import { action } from "@storybook/addon-actions";

const meta: Meta<typeof ChatMessageBubbleFooter> = {
  title: "Chat/ChatMessageBubbleFooter",
  component: ChatMessageBubbleFooter,
  tags: ["autodocs"],
  args: {
    notifyOpenFeedbackForm: action("notifyOpenFeedbackForm"),
  },
};

export default meta;

type Story = StoryObj<typeof ChatMessageBubbleFooter>;

export const WithFeedbackFooter: Story = {
  args: {
    footerType: ChatMessageFooterType.FEEDBACK_FORM,
  },
};
