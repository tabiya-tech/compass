import { SensitivePersonalDataRequirement, UserPreference, Language } from "src/userPreferences/UserPreferencesService/userPreferences.types";

export const CUSTOMER_SATISFACTION_KEY = "satisfaction_with_compass"

export default class UserPreferencesStateService {
  private static instance: UserPreferencesStateService;
  private userPreferences: UserPreference | null = null;

  private constructor() {
  }

  public static getInstance(): UserPreferencesStateService {
    if (!UserPreferencesStateService.instance) {
      UserPreferencesStateService.instance = new UserPreferencesStateService();
    }
    return UserPreferencesStateService.instance;
  }

  /**
   * Retrieves the current user preferences.
   * It returns a deep copy of the user preferences object to prevent direct modification.
   * @returns {UserPreference | null} The current user preferences object or null if no user preferences are set or
   * an error occurs while cloning the object.
   */
  public getUserPreferences(): UserPreference | null {
    try {
      return this.cloneUserPreferences(this.userPreferences);
    } catch (e) {
      console.error(new Error("Error in getUserPreferences", { cause: e }));
      return null;
    }
  }

  /**
   * Sets the current user preferences.
   * It stores a deep copy of the user preferences object to prevent direct modification.
   * @param preferences
   */
  public setUserPreferences(preferences: UserPreference): void {
    // Store a deep copy of the user preferences object to prevent direct modification
    this.userPreferences = this.cloneUserPreferences(preferences);
  }

  public clearUserPreferences(): void {
    this.userPreferences = null;
  }

  public getActiveSessionId(): number | null {
    return this.userPreferences?.sessions.length ? this.userPreferences?.sessions[0] : null;
  }

  public activeSessionHasOverallFeedback(): boolean {
    const activeSessionId = this.getActiveSessionId();
    if (activeSessionId === null) {
      return false;
    }
    const answered_questions = this.userPreferences!.user_feedback_answered_questions
    if (Object.keys(answered_questions).length === 0) {
      return false;
    }

    return answered_questions[activeSessionId].some(
      (question) => question !== CUSTOMER_SATISFACTION_KEY
    );
  }
  
  public activeSessionHasCustomerSatisfactionRating(): boolean {
    const activeSessionId = this.getActiveSessionId();
    if (activeSessionId === null) {
      return false;
    }
    const answered_questions = this.userPreferences!.user_feedback_answered_questions
    if (Object.keys(answered_questions).length === 0) {
      return false;
    }

    return answered_questions[activeSessionId].includes(CUSTOMER_SATISFACTION_KEY)
  }

  private cloneUserPreferences(preferences: UserPreference | null): UserPreference | null {
    if (!preferences) {
      return preferences;
    }

    const strObj = JSON.stringify(preferences);
    return JSON.parse(strObj, (key, value) => {
      if (key === "accepted_tc") {
        return new Date(value);
      }
      if (key === "sensitive_personal_data_requirement") {
        return SensitivePersonalDataRequirement[value as keyof typeof SensitivePersonalDataRequirement];
      }
      if (key === "language") {
        return Language[value as keyof typeof Language];
      }
      return value;
    });
  }
}
