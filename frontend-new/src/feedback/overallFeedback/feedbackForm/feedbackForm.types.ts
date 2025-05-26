export enum QuestionType {
  YesNo = "yes_no",
  Rating = "rating",
  Checkbox = "checkbox",
}

export enum YesNoEnum {
  Yes = "yes",
  No = "no",
}

export interface QuestionOption {
  key: string;
  value: string;
}

export interface BaseQuestion {
  question_text: string;
  description: string;
  comment_placeholder: string | null;
  type: QuestionType;
}

export interface YesNoQuestion extends BaseQuestion {
  type: QuestionType.YesNo;
  show_comments_on: "yes" | "no";
}

export interface RatingQuestion extends BaseQuestion {
  type: QuestionType.Rating;
  max_rating?: number;
  display_rating?: boolean;
  low_rating_label?: string;
  high_rating_label?: string;
}

export interface CheckboxQuestion extends BaseQuestion {
  type: QuestionType.Checkbox;
  options: Record<string, string>;
  low_rating_label?: string;
  high_rating_label?: string;
}

export type Question = YesNoQuestion | RatingQuestion | CheckboxQuestion;

export interface DetailedQuestion {
  type: QuestionType;
  questionId: string;
  questionText: string;
  showCommentsOn?: YesNoEnum;
  placeholder?: string | null;
  options?: QuestionOption[];
  lowRatingLabel?: string;
  highRatingLabel?: string;
  maxRating?: number;
  displayRating?: boolean;
}

export interface QuestionsConfig {
  [key: string]: Question;
}
