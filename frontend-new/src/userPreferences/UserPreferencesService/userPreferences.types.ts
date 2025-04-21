export enum SensitivePersonalDataRequirement {
  REQUIRED = "REQUIRED",
  NOT_REQUIRED = "NOT_REQUIRED",
  NOT_AVAILABLE = "NOT_AVAILABLE",
}

export type AnsweredQuestions = {
  [questionId: string]: string[];
}

// we dont constrain the keys to the experiment ids, since the frontend doesnt
// nessarily know all the experiment ids. some might be backend only.
export type UserPreferencesExperiments = Partial<Record<string, string>>

export type UserPreference = {
  user_id: string;
  language: Language;
  accepted_tc?: Date;
  sessions: number[];
  user_feedback_answered_questions: AnsweredQuestions;
  sensitive_personal_data_requirement: SensitivePersonalDataRequirement;
  has_sensitive_personal_data: boolean;
  experiments: UserPreferencesExperiments
};

export type CreateUserPreferencesSpec = {
  user_id: string;
  invitation_code: string;
  language: Language;
};

export type CreateUserPreferencesResponse = Omit<UserPreference, "sensitive_personal_data_status">;

export type UpdateUserPreferencesSpec = {
  user_id: string;
  language?: Language;
  accepted_tc?: Date;
  experiments?: UserPreferencesExperiments
};

export enum Language {
  en = "en",
  // fr = 'fr', // French in the future
}
