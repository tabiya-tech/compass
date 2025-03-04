import React, { ReactNode } from "react";
import { Meta, StoryObj } from "@storybook/react";
import ConversationConclusionFooter from "./ConversationConclusionFooter";
import { ChatProvider } from "src/chat/ChatContext";
import { FeedbackItem } from "src/feedback/overallFeedback/overallFeedbackService/OverallFeedback.service.types";
import AuthenticationStateService from "src/auth/services/AuthenticationState.service";
import { TabiyaUser } from "src/auth/auth.types";
import UserPreferencesStateService, {
  CUSTOMER_SATISFACTION_KEY,
} from "src/userPreferences/UserPreferencesStateService";
import {
  SensitivePersonalDataRequirement,
  Language,
} from "src/userPreferences/UserPreferencesService/userPreferences.types";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import { getBackendUrl } from "src/envService";

// Mock feedback data
const mockFeedbackInProgress: FeedbackItem[] = [
  {
    question_id: "overall_satisfaction",
    simplified_answer: {
      rating_numeric: 4,
      comment: "Very helpful conversation!",
    }
  },
];

interface StorybookWrapperProps {
  children: ReactNode;
  feedbackData?: FeedbackItem[];
  isAccountConverted?: boolean;
  isAnonymous?: boolean;
  hasSubmittedFeedback?: boolean;
  hasSubmittedCustomerSatisfactionRating?: boolean;
}

// Create a wrapper component that provides the necessary context and mocked values
const StorybookWrapper = ({
  children,
  feedbackData = [],
  isAccountConverted = false,
  isAnonymous = false,
  hasSubmittedFeedback = false,
  hasSubmittedCustomerSatisfactionRating = false,
}: StorybookWrapperProps) => {
  // Mock the window object with our test data
  PersistentStorageService.setOverallFeedback(feedbackData);
  PersistentStorageService.setAccountConverted(isAccountConverted);

  // Mock the user data on window
  AuthenticationStateService.getInstance().setUser(
    isAnonymous
      ? ({
          id: "anonymous-user",
      } as TabiyaUser)
      : ({
          id: "test-user",
          name: "Test User",
          email: "test@example.com",
        } as TabiyaUser)
  );

  const answeredQuestions = [];
  if (hasSubmittedFeedback) {
    answeredQuestions.push("overall_satisfaction");
  }
  if (hasSubmittedCustomerSatisfactionRating) {
    answeredQuestions.push(CUSTOMER_SATISFACTION_KEY);
  }

  // Mock the session feedback on window
  UserPreferencesStateService.getInstance().setUserPreferences({
    sessions: [1],
    user_id: "test-user",
    language: Language.en,
    user_feedback_answered_questions: {
      1: answeredQuestions,
    },
    sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
    has_sensitive_personal_data: false,
  });

  return <ChatProvider handleOpenExperiencesDrawer={() => {}}>{children}</ChatProvider>;
};

const meta : Meta<typeof ConversationConclusionFooter> = {
  title: "Chat/ConversationConclusionFooter",
  component: ConversationConclusionFooter,
  parameters: {
    layout: "centered",
    mockData: [
      {
        url: getBackendUrl() + "/conversations/:session_id/feedback",
        method: "PATCH",
        status: 200,
        response: mockFeedbackInProgress,
      },
    ],
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: "600px", margin: "0 auto", padding: "20px" }}>
        <Story />
      </div>
    ),
  ],
  tags: ["autodocs"],
};

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

// Story: Customer satisfaction rating un submitted
export const CustomerSatisfactionRatingUnsubmitted: Story = {
  parameters: {
    docs: {
      description: "Shows customer satisfaction rating when it has not been submitted",
    },
  },
  decorators: [
    (Story) => (
      <StorybookWrapper hasSubmittedCustomerSatisfactionRating={false} >
        <Story />
      </StorybookWrapper>
    ),
  ],
};

// Story: Customer satisfaction rating submitted
export const CustomerSatisfactionRatingSubmitted: Story = {
  parameters: {
    docs: {
      description: "Shows thank you message when customer satisfaction rating has been submitted",
    },
  },
  decorators: [
    (Story) => (
      <StorybookWrapper hasSubmittedCustomerSatisfactionRating={true}>
        <Story />
      </StorybookWrapper>
    ),
  ],
};

// Story: Both Feedback and Customer satisfaction rating submitted
export const FeedbackAndCustomerSatisfactionRatingSubmitted: Story = {
  parameters: {
    docs: {
      description: "Shows thank you message when both customer satisfaction rating and feedback have been submitted",
    },
  },
  decorators: [
    (Story) => (
      <StorybookWrapper hasSubmittedCustomerSatisfactionRating={true} hasSubmittedFeedback={true}>
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

// Story: Registered user
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
