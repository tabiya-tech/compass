export type UserLanguage = {
  user_id: string;
  language: Language;
};

export type UserPreference = UserLanguage & {
  accepted_tc?: Date;
  sessions: number[];
};

export type UserPreferencesSpec = UserPreference & {
  // TODO: optional for now, until we implement the invitation code for email registration
  invitation_code?: string;
};

export type CreateUserPreferencesSpec = {
  user_id: string;
  invitation_code: string;
  language: Language;
}

export type UpdateUserPreferencesSpec = {
  user_id: string;
  language: Language;
  accepted_tc: Date;
}

export enum Language {
  en = "en",
  // fr = 'fr', // French in the future
}

export type UserPreferencesContextValue = {
  userPreferences: UserPreference | null;
  isLoading: boolean;
  setUserPreferences: (userPreferences: UserPreference | null) => void;
  updateUserPreferences: (
    preferences: UpdateUserPreferencesSpec,
    successCallback: (prefs: UserPreference) => void,
    errorCallback: (error: any) => void
  ) => void;
  getUserPreferences: (
    userId: string,
    successCallback: (prefs: UserPreference) => void,
    errorCallback: (error: any) => void
  ) => void;
};
