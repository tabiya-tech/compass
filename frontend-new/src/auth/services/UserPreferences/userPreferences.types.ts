export type UserLanguage = {
  user_id: string;
  language: Language;
};

export type UserPreference = UserLanguage & {
  accepted_tc: Date;
};

export enum Language {
  en = "en",
  // fr = 'fr', // French in the future
}

export type UserPreferenceResponse = {
  user_preference_id: string;
  user_preferences: UserPreference;
};