export type UserLanguage = {
  user_id: string;
  language: Language;
};

export type UserPreference = UserLanguage & {
  accepted_tc: Date;
  sessions: number[];
};

export type UserPreferencesSpec = UserPreference & {
  // TODO: optional for now, until we implement the invitation code for email registration
  invitation_code?: string;
};

export enum Language {
  en = "en",
  // fr = 'fr', // French in the future
}

export type UserPreferencesContextValue = {
  userPreferences: UserPreference | null;
  isLoading: boolean;
  createUserPreferences: (
    preferences: UserPreferencesSpec,
    successCallback: (prefs: UserPreference) => void,
    errorCallback: (error: any) => void
  ) => void;
  getUserPreferences: (
    userId: string,
    successCallback: (prefs: UserPreference) => void,
    errorCallback: (error: any) => void
  ) => void;
  updateUserPreferences: (preferences: UserPreference | null) => void;
};
