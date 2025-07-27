import type { Meta, StoryObj } from "@storybook/react";
import { ChatProvider, useChatContext } from "src/chat/ChatContext";
import { FeedbackStatus } from "src/feedback/overallFeedback/feedbackForm/FeedbackForm";
import { useEffect } from "react";
import { MessageContainer } from "src/chat/chatMessage/userChatMessage/UserChatMessage";
import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";

// Create a mock version of ConversationConclusionChatMessage that doesn't use the problematic footer
const MockConversationConclusionChatMessage = ({ message }: { message: string }) => {
  return (
    <MessageContainer
      origin={ConversationMessageSender.COMPASS}
      data-testid="conversation_conclusion_chat-message-container"
    >
      <ChatBubble message={message} sender={ConversationMessageSender.COMPASS}>
        <div style={{ padding: "16px", backgroundColor: "#f5f5f5", borderRadius: "8px", margin: "8px 0" }}>
          <p style={{ margin: 0, color: "#666", fontSize: "14px" }}>Feedback form would appear here</p>
        </div>
      </ChatBubble>
    </MessageContainer>
  );
};

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

const meta: Meta<typeof MockConversationConclusionChatMessage> = {
  title: "Chat/ChatMessage/ConversationConclusion",
  component: MockConversationConclusionChatMessage,
  tags: ["autodocs"],
  argTypes: {},
  decorators: [
    (Story) => (
      <ChatProvider handleOpenExperiencesDrawer={() => {}} removeMessage={() => {}} addMessage={() => {}}>
        <Story />
      </ChatProvider>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof MockConversationConclusionChatMessage>;

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
