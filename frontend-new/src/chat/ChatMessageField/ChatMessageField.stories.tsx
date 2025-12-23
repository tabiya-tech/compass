import React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import ChatMessageField, { ChatMessageFieldProps } from "./ChatMessageField";
import { action } from "@storybook/addon-actions";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";
import { ConversationPhase } from "src/chat/chatProgressbar/types";

const meta: Meta<typeof ChatMessageField> = {
  title: "Chat/ChatMessageField",
  component: ChatMessageField,
  tags: ["autodocs"],
  argTypes: {
    handleSend: { action: "message sent" },
  },
  decorators: [
    (Story) => (
      <IsOnlineContext.Provider value={true}>
        <div style={{ padding: 24 }}>
          <Story />
        </div>
      </IsOnlineContext.Provider>
    ),
  ],
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
    currentPhase: ConversationPhase.INTRO,
  },
};

export const AIIsTyping: Story = {
  render: (args) => <ChatMessageFieldWrapper {...args} />,
  args: {
    handleSend: action("Message sent"),
    aiIsTyping: true,
    currentPhase: ConversationPhase.INTRO,
  },
};

export const ChatIsClosed: Story = {
  render: (args) => <ChatMessageFieldWrapper {...args} />,
  args: {
    handleSend: action("Message sent"),
    isChatFinished: true,
    currentPhase: ConversationPhase.INTRO,
  },
};

export const PlusBadgeAppearsOnPhaseTransition: Story = {
  render: (args) => <ChatMessageFieldWrapper {...args} />,
  args: {
    handleSend: action("Message sent"),
    currentPhase: ConversationPhase.COLLECT_EXPERIENCES,
  },
};

export const CVUploadDisabledInOtherPhases: Story = {
  render: (args) => <ChatMessageFieldWrapper {...args} />,
  args: {
    handleSend: action("Message sent"),
    currentPhase: ConversationPhase.INTRO,
  },
};

// Character Limit Stories
export const CharacterLimitWarning: Story = {
  render: (args) => <ChatMessageFieldWrapper {...args} />,
  args: {
    handleSend: action("Message sent"),
    currentPhase: ConversationPhase.COLLECT_EXPERIENCES,
    prefillMessage: "a".repeat(800), // 80% of 1000 character limit - shows warning counter
  },
};

export const CharacterLimitExceeded: Story = {
  render: (args) => <ChatMessageFieldWrapper {...args} />,
  args: {
    handleSend: action("Message sent"),
    currentPhase: ConversationPhase.COLLECT_EXPERIENCES,
    prefillMessage: "a".repeat(1002), // Over 1000 character limit - shows error and disabled send button
  },
};
