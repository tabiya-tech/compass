import type { Meta, StoryObj } from "@storybook/react";
import ConversationConclusionChatMessage from "src/chat/chatMessage/conversationConclusionChatMessage/ConversationConclusionChatMessage";
import { ChatProvider, useChatContext } from "src/chat/ChatContext";
import { FeedbackStatus } from "src/feedback/overallFeedback/overallFeedbackForm/OverallFeedbackForm";
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
    message:
      "We'd love your feedback on this conversation. It'll only take 5 minutes and will help us improve your experience",
  },
};

export const LongMessage: Story = {
  args: {
    message:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
  },
};

export const LongUnBrokenWord: Story = {
  args: {
    message: "a".repeat(1000),
  },
};

export const SingleLetter: Story = {
  args: {
    message: "a",
  },
};

export const FeedbackInProgress: Story = {
  args: {
    message: "It was great exploring your skills with you! I hope you found this session helpful. Goodbye!",
  },
  decorators: [withChatContext(FeedbackStatus.STARTED)],
};

export const FeedbackSubmitted: Story = {
  args: {
    message: "It was great exploring your skills with you! I hope you found this session helpful. Goodbye!",
  },
  decorators: [withChatContext(FeedbackStatus.SUBMITTED)],
};
