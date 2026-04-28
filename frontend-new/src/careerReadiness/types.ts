export type ModuleStatus = "NOT_STARTED" | "UNLOCKED" | "IN_PROGRESS" | "COMPLETED";

export type ModuleStatusDisplay = "unlocked" | "in_progress" | "done";

export const mapModuleStatusToDisplay = (status: ModuleStatus): ModuleStatusDisplay => {
  switch (status) {
    case "NOT_STARTED":
      return "unlocked";
    case "UNLOCKED":
      return "unlocked";
    case "IN_PROGRESS":
      return "in_progress";
    case "COMPLETED":
      return "done";
    default:
      return "unlocked";
  }
};

export type CareerReadinessMessageSender = "USER" | "AGENT";

export interface ModuleSummary {
  id: string;
  title: string;
  description: string;
  icon: string;
  status: ModuleStatus;
  sort_order: number;
  input_placeholder: string;
  active_conversation_id: string | null;
  topics: string[];
}

export interface ModuleDetail extends ModuleSummary {
  scope: string;
  active_conversation_id: string | null;
}

export interface ModuleListResponse {
  modules: ModuleSummary[];
}

export interface CareerReadinessMessage {
  message_id: string;
  message: string;
  sent_at: string;
  sender: CareerReadinessMessageSender;
  metadata?: { quick_reply_options?: { label: string }[] } | null;
}

export interface CareerReadinessConversationResponse {
  conversation_id: string;
  module_id: string;
  messages: CareerReadinessMessage[];
  module_completed: boolean;
  quiz_passed?: boolean | null;
  covered_topics?: string[];
  conversation_mode?: "INSTRUCTION" | "SUPPORT" | null;
  quiz_available?: boolean;
}

export interface CareerReadinessConversationInput {
  user_input: string;
}

export interface QuizQuestionResponse {
  question: string;
  options: string[];
}

export interface QuizResponse {
  questions: QuizQuestionResponse[];
}

export interface QuizQuestionResult {
  question_index: number;
  is_correct: boolean;
  correct_answer?: string;
}

export interface PersistedCareerReadinessQuizResult {
  score: number;
  total: number;
  passed: boolean;
  submitted_at: number;
  correct_answers_summary?: string;
  question_results?: QuizQuestionResult[];
}

export interface QuizSubmissionResponse {
  score: number;
  total: number;
  passed: boolean;
  question_results: QuizQuestionResult[];
  module_completed: boolean;
  conversation_mode: string;
}
