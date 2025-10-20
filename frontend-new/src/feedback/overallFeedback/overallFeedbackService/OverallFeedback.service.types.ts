export interface FeedbackResponse {
  id: string;
  version: {
    frontend: string;
    backend: string;
  };
  feedback_items: FeedbackItem[];
  created_at: string;
}

export interface FeedbackRequest {
  version: {
    frontend: string;
  };
  feedback_items_specs: FeedbackItem[];
}

export interface SimplifiedAnswer {
  rating_numeric?: number | null;
  rating_boolean?: boolean | null;
  selected_options_keys?: string[];
  comment?: string;
}

export interface FeedbackItem {
  question_id: string;
  simplified_answer: SimplifiedAnswer;
}

export const QUESTION_KEYS: Record<string, string> = {
  CUSTOMER_SATISFACTION: "satisfaction_with_compass",
  OVERALL_SATISFACTION: "satisfaction_with_compass",
};
