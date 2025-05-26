import { Meta, StoryObj } from "@storybook/react";
import WorkExperienceAccuracyQuestion from "src/feedback/overallFeedback/overallFeedbackForm/components/formContent/questionComponents/workExperienceAccuracy/WorkExperienceAccuracyQuestion";
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
  work_experience_accuracy: {
    question_id: "work_experience_accuracy",
    question_text: "How accurate was the assessment of your work experience?",
    description: "Please rate how well the system captured your work experience",
    type: QuestionType.Checkbox,
    options: {
      "very_accurate": "Very accurate",
      "somewhat_accurate": "Somewhat accurate",
      "not_accurate": "Not accurate"
    },
    comment_placeholder: "Please share your thoughts on the accuracy",
  },
  // Add other required fields with dummy values
  satisfaction_with_compass: {} as any,
  perceived_bias: {} as any,
  clarity_of_skills: {} as any,
  incorrect_skills: {} as any,
  missing_skills: {} as any,
  interaction_ease: {} as any,
  recommendation: {} as any,
  additional_feedback: {} as any,
};

const meta: Meta<typeof WorkExperienceAccuracyQuestion> = {
  title: "Feedback/OverallFeedback/QuestionComponents/WorkExperienceAccuracyQuestion",
  component: WorkExperienceAccuracyQuestion,
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

type Story = StoryObj<typeof WorkExperienceAccuracyQuestion>;

export const Default: Story = {
  args: {
    feedbackItems: [],
  },
};

export const WithExistingFeedback: Story = {
  args: {
    feedbackItems: [
      {
        question_id: "work_experience_accuracy",
        simplified_answer: {
          selected_options_keys: ["somewhat_accurate"],
          comment: "The system captured most of my experience accurately, but missed some recent roles",
        },
      },
    ],
  },
}; 