export interface FeedbackResponse {
  user_id: string;
  session_id: number;
  version: {
    frontend: string;
  };
  feedback: FeedbackItem[];
}

export interface Answer {
  rating_numeric?: number | null;
  rating_boolean?: boolean | null;
  selected_options?: string[];
  comment?: string;
}

export interface FeedbackItem {
  question_id: string;
  answer: Answer;
  is_answered: boolean;
}
