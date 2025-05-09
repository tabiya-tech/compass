import type { Meta, StoryObj } from "@storybook/react";
import ConversationConclusionChatMessage from "src/chat/chatMessage/conversationConclusionChatMessage/ConversationConclusionChatMessage";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import { ChatMessageType } from "src/chat/Chat.types";
import { nanoid } from "nanoid";
import { ChatProvider, useChatContext } from "src/chat/ChatContext";
import { FeedbackStatus } from "src/feedback/overallFeedback/feedbackForm/FeedbackForm";
import { useEffect } from "react";

const withChatContext = (feedbackStatus: FeedbackStatus) => (Story: any) => {
  const Wrapper = () => {
    const { setFeedbackStatus } = useChatContext();

    useEffect(() => {
      setFeedbackStatus(feedbackStatus);
    }, [setFeedbackStatus]);

    return <Story />;
  };

  return (
    <ChatProvider handleOpenExperiencesDrawer={() => {}} removeMessage={() => {}} addMessage={() => {}}>
      <Wrapper />
    </ChatProvider>
  );
};

const meta: Meta<typeof ConversationConclusionChatMessage> = {
  title: "Chat/ChatMessage/ConversationConclusion",
  component: ConversationConclusionChatMessage,
  tags: ["autodocs"],
  argTypes: {},
};

export default meta;

type Story = StoryObj<typeof ConversationConclusionChatMessage>;

export const AccurateMessage: Story = {
  args: {
    chatMessage: {
      message_id: nanoid(),
      sender: ConversationMessageSender.COMPASS,
      sent_at: new Date().toISOString(),
      message:
        "We’d love your feedback on this conversation. It’ll only take 5 minutes and will help us improve your experience",
      type: ChatMessageType.CONVERSATION_CONCLUSION,
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
      type: ChatMessageType.CONVERSATION_CONCLUSION,
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
      type: ChatMessageType.CONVERSATION_CONCLUSION,
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
      type: ChatMessageType.CONVERSATION_CONCLUSION,
      reaction: null,
    },
  },
};

export const FeedbackInProgress: Story = {
  args: {
    chatMessage: {
      message_id: nanoid(),
      sender: ConversationMessageSender.COMPASS,
      sent_at: new Date().toISOString(),
      message: "It was great exploring your skills with you! I hope you found this session helpful. Goodbye!",
      type: ChatMessageType.CONVERSATION_CONCLUSION,
      reaction: null,
    }
  },
  decorators: [withChatContext(FeedbackStatus.STARTED)],
};

export const FeedbackSubmitted: Story = {
  args: {
    chatMessage: {
      message_id: nanoid(),
      sender: ConversationMessageSender.COMPASS,
      sent_at: new Date().toISOString(),
      message: "It was great exploring your skills with you! I hope you found this session helpful. Goodbye!",
      type: ChatMessageType.CONVERSATION_CONCLUSION,
      reaction: null,
    },
  },
  decorators: [withChatContext(FeedbackStatus.SUBMITTED)],
};
