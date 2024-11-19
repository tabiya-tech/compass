export type UserPreference = {
  user_id: string;
  language: Language;
  accepted_tc?: Date;
  sessions: number[];
  sessions_with_feedback?: number[];
};

export type CreateUserPreferencesSpec = {
  user_id: string;
  invitation_code: string;
  language: Language;
};

export type UpdateUserPreferencesSpec = {
  user_id: string;
  language: Language;
  accepted_tc: Date;
};

export enum Language {
  en = "en",
  // fr = 'fr', // French in the future
}
