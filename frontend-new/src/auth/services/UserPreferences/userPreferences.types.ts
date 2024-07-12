export type UserLanguage = {
  user_id: string;
  language: Language;
};

export type UserPreference = UserLanguage & {
  accepted_tc: Date;
  sessions: number[];
};

export enum Language {
  en = "en",
  // fr = 'fr', // French in the future
}