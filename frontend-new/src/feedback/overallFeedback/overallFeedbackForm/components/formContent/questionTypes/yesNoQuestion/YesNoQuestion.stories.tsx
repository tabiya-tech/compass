import { Meta, StoryObj } from "@storybook/react";
import YesNoQuestion from "src/feedback/overallFeedback/overallFeedbackForm/components/formContent/questionTypes/yesNoQuestion/YesNoQuestion";
import { YesNoEnum } from "src/feedback/overallFeedback/overallFeedbackForm/overallFeedbackForm.types";
import { action } from "@storybook/addon-actions";
import { FeedbackProvider } from "src/feedback/overallFeedback/feedbackContext/FeedbackContext";
import { getBackendUrl } from "src/envService";
import { QuestionType } from "src/feedback/overallFeedback/overallFeedbackForm/overallFeedbackForm.types";
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
const mockQuestionsConfig = {
  yes_no_question: {
    questionId: "yes_no_question",
    question_text: "Is this a question?",
    description: "Please answer yes or no",
    type: QuestionType.YesNo,
    show_comments_on: "No",
    comment_placeholder: "Please provide comments",
  },
  // Add other required fields with dummy values
  satisfaction_with_compass: {} as any,
  perceived_bias: {} as any,
  work_experience_accuracy: {} as any,
  clarity_of_skills: {} as any,
  incorrect_skills: {} as any,
  missing_skills: {} as any,
  interaction_ease: {} as any,
  recommendation: {} as any,
};

const meta: Meta<typeof YesNoQuestion> = {
  title: "Feedback/OverallFeedback/QuestionTypes/YesNoQuestion",
  component: YesNoQuestion,
  tags: ["autodocs"],
  args: {
    notifyChange: (value, comments) => {
      action("notifyChange")(value, comments);
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

type Story = StoryObj<typeof YesNoQuestion>;

export const ShowCommentsWhenYesSelected: Story = {
  args: {
    question_text: "Is this a question?",
    question_id: "is_question",
    showCommentsOn: YesNoEnum.Yes,
    comment_placeholder: "Please provide comments",
    description: "Test description"
  },
};

export const ShowCommentsWhenNoSelected: Story = {
  args: {
    question_text: "Is this not a question?",
    question_id: "is_not_question",
    showCommentsOn: YesNoEnum.No,
    comment_placeholder: "Please provide comments",
    description: "Test description"
  },
};
