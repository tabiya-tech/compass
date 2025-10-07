export interface Option {
  key: string;
  value: string;
}

export enum QuestionType {
  Rating = "rating",
  YesNo = "yesNo",
  Checkbox = "checkbox",
}

export enum YesNoEnum {
  Yes = "common.buttons.yes",
  No = "common.buttons.no",
}

export interface BaseQuestion {
  type: QuestionType;
  questionId: string;
  questionText: string;
  placeholder?: string;
}

export interface DetailedQuestion extends BaseQuestion {
  lowRatingLabel?: string;
  highRatingLabel?: string;
  showCommentsOn?: YesNoEnum;
  displayRating?: boolean;
  options?: Option[];
  maxRating?: number;
}
