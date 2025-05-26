import { Meta, StoryObj } from "@storybook/react";
import InteractionEaseQuestion from "src/feedback/overallFeedback/overallFeedbackForm/components/formContent/questionComponents/interactionEase/InteractionEaseQuestion";
import { action } from "@storybook/addon-actions";
import { FeedbackProvider } from "src/feedback/overallFeedback/feedbackContext/FeedbackContext";
import { getBackendUrl } from "src/envService";
import { QuestionsConfig, QuestionType } from "src/feedback/overallFeedback/overallFeedbackForm/overallFeedbackForm.types";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import AuthenticationServiceFactory from "src/auth/services/Authentication.service.factory";
import AuthenticationStateService from "src/auth/services/AuthenticationState.service";
import { TabiyaUser } from "src/auth/auth.types";
import AuthenticationService from "src/auth/services/Authentication.service";

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

// Mock questions config that matches the backend response structure
const mockQuestionsConfig: QuestionsConfig = {
  interaction_ease: {
    question_id: "interaction_ease",
    question_text: "How easy was it to interact with the system?",
    description: "Please rate the ease of interaction",
    type: QuestionType.Rating,
    low_rating_label: "Not easy",
    high_rating_label: "Very easy",
    max_rating: 5,
    display_rating: true,
    comment_placeholder: "Please share your thoughts",
  },
  // Add other required fields with dummy values
  satisfaction_with_compass: {} as any,
  perceived_bias: {} as any,
  work_experience_accuracy: {} as any,
  clarity_of_skills: {} as any,
  incorrect_skills: {} as any,
  missing_skills: {} as any,
  recommendation: {} as any,
  additional_feedback: {} as any,
};

const meta: Meta<typeof InteractionEaseQuestion> = {
  title: "Feedback/OverallFeedback/QuestionComponents/InteractionEaseQuestion",
  component: InteractionEaseQuestion,
  tags: ["autodocs"],
  args: {
    feedbackItems: [],
    onChange: (data) => {
      action("onChange")(data);
    },
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

type Story = StoryObj<typeof InteractionEaseQuestion>;

export const Default: Story = {
  args: {
    feedbackItems: [],
  },
};

export const WithExistingFeedback: Story = {
  args: {
    feedbackItems: [
      {
        question_id: "interaction_ease",
        simplified_answer: {
          rating_numeric: 4,
          comment: "The interface was very intuitive and easy to use",
        },
      },
    ],
  },
}; 