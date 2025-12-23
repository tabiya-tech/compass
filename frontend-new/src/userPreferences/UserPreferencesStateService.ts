import {
  SensitivePersonalDataRequirement,
  UserPreference,
  Language,
} from "src/userPreferences/UserPreferencesService/userPreferences.types";
import { QUESTION_KEYS } from "src/feedback/overallFeedback/overallFeedbackService/OverallFeedback.service.types";

export default class UserPreferencesStateService {
  private static instance: UserPreferencesStateService;
  private userPreferences: UserPreference | null = null;

  private constructor() {}

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
    const answered_questions = this.userPreferences!.user_feedback_answered_questions;
    if (Object.keys(answered_questions).length === 0) {
      return false;
    }

    if (!answered_questions[activeSessionId]) {
      return false;
    }

    return answered_questions[activeSessionId].some((question) => question !== QUESTION_KEYS.CUSTOMER_SATISFACTION);
  }

  public activeSessionHasCustomerSatisfactionRating(): boolean {
    const activeSessionId = this.getActiveSessionId();

    if (activeSessionId === null) {
      return false;
    }

    // userPreferences.user_feedback_answered_questions is an object with session ids as keys,
    // and it is never undefined, but it can be an empty object: {}.
    // For Postel's Law: assert that the object is defined.
    const answered_questions = this.userPreferences!.user_feedback_answered_questions;
    if (!answered_questions || Object.keys(answered_questions).length === 0) {
      return false;
    }

    if (!answered_questions[activeSessionId]) {
      return false;
    }

    return answered_questions[activeSessionId].includes(QUESTION_KEYS.CUSTOMER_SATISFACTION);
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
