import { Meta, type StoryObj } from "@storybook/react";
import { action } from "@storybook/addon-actions";
import OverallFeedbackForm from "src/feedback/overallFeedback/overallFeedbackForm/OverallFeedbackForm";
import { FeedbackProvider } from "src/feedback/overallFeedback/feedbackContext/FeedbackContext";
import { getBackendUrl } from "src/envService";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import AuthenticationServiceFactory from "src/auth/services/Authentication.service.factory";
import AuthenticationStateService from "src/auth/services/AuthenticationState.service";
import { TabiyaUser } from "src/auth/auth.types";
import AuthenticationService from "src/auth/services/Authentication.service";
import { mockQuestionsConfig } from "src/feedback/overallFeedback/overallFeedbackForm/overallFeedbackForm.test.utils";

// Mock authentication service to provide token validation and user info for API calls
class MockAuthenticationService extends AuthenticationService {
  private static instance: MockAuthenticationService;

  private constructor() {
    super();
  }

  static getInstance(): MockAuthenticationService {
    if (!this.instance) {
      this.instance = new this();
    }
    return this.instance;
  }

  async refreshToken(): Promise<void> {}
  cleanup(): void {}
  async logout(): Promise<void> {}
  getUser(token: string): TabiyaUser | null {
    return { id: "1", name: "Test User", email: "test@example.com" } as TabiyaUser;
  }
  getToken(): string {
    return "foo token";
  }
  isTokenValid(token: string): { isValid: boolean; decodedToken: any; failureCause?: string } {
    return { isValid: true, decodedToken: { sub: "1", email: "test@example.com" } };
  }
}

const meta: Meta<typeof OverallFeedbackForm> = {
  title: "Feedback/OverallFeedback/OverallFeedbackForm",
  component: OverallFeedbackForm,
  tags: ["autodocs"],
  args: {
    notifyOnClose: action("notifyOnClose"),
  },
  parameters: {
    mockData: [
      // Mock the questions config endpoint that FeedbackProvider uses to fetch question data
      {
        url: getBackendUrl() + "/conversations/123/feedback/questions",
        method: "GET",
        status: 200,
        response: mockQuestionsConfig,
      },
      // Mock the feedback submission endpoint that OverallFeedbackService uses to save ratings
      {
        url: getBackendUrl() + "/conversations/123/feedback",
        method: "PATCH",
        status: 200,
        response: {
          message: "Feedback submitted successfully",
        },
      },
    ],
  },
  decorators: [
    (Story) => {
      // Mock session ID for API endpoint construction
      const mockUserPrefsService = UserPreferencesStateService.getInstance();
      mockUserPrefsService.getActiveSessionId = () => 123;

      // Mock auth state for API authentication and user identification
      const mockAuthStateService = AuthenticationStateService.getInstance();
      mockAuthStateService.getToken = () => "foo token";
      mockAuthStateService.getUser = () => ({ id: "1", name: "Test User", email: "test@example.com" } as TabiyaUser);

      // Mock auth service factory to provide our mock auth service
      AuthenticationServiceFactory.getCurrentAuthenticationService = () => MockAuthenticationService.getInstance();

      return (
        <FeedbackProvider>
          <Story />
        </FeedbackProvider>
      );
    },
  ],
};

export default meta;

type Story = StoryObj<typeof OverallFeedbackForm>;

export const Shown: Story = {
  args: {
    isOpen: true,
  },
};
