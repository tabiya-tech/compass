import React, { ReactNode } from "react";
import { Meta, StoryObj } from "@storybook/react";
import ConversationConclusionFooter from "./ConversationConclusionFooter";
import { ChatProvider } from "src/chat/ChatContext";
import { FeedbackItem } from "src/feedback/overallFeedback/overallFeedbackService/OverallFeedback.service.types";
import AuthenticationStateService from "src/auth/services/AuthenticationState.service";
import { TabiyaUser } from "src/auth/auth.types";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import {
  SensitivePersonalDataRequirement,
  Language,
} from "src/userPreferences/UserPreferencesService/userPreferences.types";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";

// Mock feedback data
const mockFeedbackInProgress: FeedbackItem[] = [
  {
    question_id: "overall_satisfaction",
    answer: {
      rating_numeric: 4,
      comment: "Very helpful conversation!",
    },
    is_answered: true,
  },
];

interface StorybookWrapperProps {
  children: ReactNode;
  feedbackData?: FeedbackItem[];
  isAccountConverted?: boolean;
  isAnonymous?: boolean;
  hasSubmittedFeedback?: boolean;
}

// Create a wrapper component that provides the necessary context and mocked values
const StorybookWrapper = ({
  children,
  feedbackData = [],
  isAccountConverted = false,
  isAnonymous = false,
  hasSubmittedFeedback = false,
}: StorybookWrapperProps) => {
  // Mock the window object with our test data
  PersistentStorageService.setOverallFeedback(feedbackData);
  PersistentStorageService.setAccountConverted(isAccountConverted);

  // Mock the user data on window
  AuthenticationStateService.getInstance().setUser(
    isAnonymous
      ? null
      : ({
          id: "test-user",
          name: "Test User",
          email: "test@example.com",
        } as TabiyaUser)
  );

  // Mock the session feedback on window
  UserPreferencesStateService.getInstance().setUserPreferences({
    sessions: [1],
    user_id: "test-user",
    language: Language.en,
    sessions_with_feedback: [hasSubmittedFeedback ? 1 : 0],
    sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
    has_sensitive_personal_data: false,
  });

  return <ChatProvider handleOpenExperiencesDrawer={() => {}}>{children}</ChatProvider>;
};

const meta = {
  title: "Chat/ConversationConclusionFooter",
  component: ConversationConclusionFooter,
  parameters: {
    layout: "centered",
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: "600px", margin: "0 auto", padding: "20px" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ConversationConclusionFooter>;

export default meta;
type Story = StoryObj<typeof meta>;

// Story: Initial state with feedback request
export const InitialState: Story = {
  parameters: {
    docs: {
      description: "Initial state showing feedback request message",
    },
  },
  decorators: [
    (Story) => (
      <StorybookWrapper>
        <Story />
      </StorybookWrapper>
    ),
  ],
};

export const FeedbackNotStarted: Story = {
  parameters: {
    docs: {
      description: "Shows message when user has not started feedback",
    },
  },
  decorators: [
    (Story) => (
      <StorybookWrapper>
        <Story />
      </StorybookWrapper>
    ),
  ],
};
// Story: Feedback in progress
export const FeedbackInProgress: Story = {
  parameters: {
    docs: {
      description: "Shows message when user has started but not completed feedback",
    },
  },
  decorators: [
    (Story) => (
      <StorybookWrapper feedbackData={mockFeedbackInProgress}>
        <Story />
      </StorybookWrapper>
    ),
  ],
};

// Story: Feedback submitted
export const FeedbackSubmitted: Story = {
  parameters: {
    docs: {
      description: "Shows thank you message when feedback has been submitted",
    },
  },
  decorators: [
    (Story) => (
      <StorybookWrapper hasSubmittedFeedback={true}>
        <Story />
      </StorybookWrapper>
    ),
  ],
};

// Story: Anonymous user with create account prompt
export const AnonymousUserCreateAccount: Story = {
  name: "Anonymous User - Create Account",
  parameters: {
    docs: {
      description: "Shows create account prompt for anonymous users",
    },
  },
  decorators: [
    (Story) => (
      <StorybookWrapper isAnonymous={true}>
        <Story />
      </StorybookWrapper>
    ),
  ],
};

// Story: Anonymous user with verification reminder
export const AnonymousUserVerificationReminder: Story = {
  name: "Anonymous User - Verification Reminder",
  parameters: {
    docs: {
      description: "Shows verification reminder for anonymous users who have converted their account",
    },
  },
  decorators: [
    (Story) => (
      <StorybookWrapper isAnonymous={true} isAccountConverted={true}>
        <Story />
      </StorybookWrapper>
    ),
  ],
};

export const RegisteredUser: Story = {
  parameters: {
    docs: {
      description: "Shows message when user is registered",
    },
  },
  decorators: [
    (Story) => (
      <StorybookWrapper>
        <Story />
      </StorybookWrapper>
    ),
  ],
};
