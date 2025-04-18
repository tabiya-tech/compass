import { SensitivePersonalDataRequirement, UserPreference, Language, ABTestIds } from "src/userPreferences/UserPreferencesService/userPreferences.types";
import {
  QUESTION_KEYS,
} from "src/feedback/overallFeedback/overallFeedbackService/OverallFeedback.service.types";
import * as Sentry from "@sentry/react";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";

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
    try {
      // Set the session context for Sentry so that we can track the session id in errors
      Sentry.setContext("session", {
        session_id: this.getActiveSessionId() ?? "UNKNOWN"
      });
    } catch (err) {
      console.error(new Error(`Failed to set sentry context`, { cause: err }));
    }
  }

  /**
   * Load the A/B test group from persistent storage
   * @returns The A/B test group or null if not found
   */
  public loadABTestGroup(): string | null {
    const abTestGroup = PersistentStorageService.getABTestGroup();
    if (!abTestGroup) return null;

    const preferences = this.getUserPreferences();
    if (!preferences) return abTestGroup;

    preferences.abClassification = preferences.abClassification || [];
    if (!preferences.abClassification.includes(abTestGroup)) {
      preferences.abClassification.push(abTestGroup);
      this.setUserPreferences(preferences);
    }

    return abTestGroup;
  }

  /**
   * Set the A/B test group in persistent storage
   * @param abTestGroup The A/B test group to set
   */
  public setAbTestGroup(abTestGroup: string): void {
    PersistentStorageService.setABTestGroup(abTestGroup);

    const preferences = this.getUserPreferences();
    if (!preferences) return;

    preferences.abClassification = preferences.abClassification || [];
    if (!preferences.abClassification.includes(abTestGroup)) {
      preferences.abClassification.push(abTestGroup);
      this.setUserPreferences(preferences);
    }
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
      (question) => question !== QUESTION_KEYS.CUSTOMER_SATISFACTION
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

    return answered_questions[activeSessionId].includes(QUESTION_KEYS.CUSTOMER_SATISFACTION)
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

  public getShowIconVariant(): boolean {
    const preferences = this.getUserPreferences();
    if (!preferences) {
      return false;
    }

    this.loadABTestGroup();

    // Check if we already have a variant assigned
    const hasIconVariant = preferences.abClassification?.includes(ABTestIds.LINK_STYLE) || false;
    
    if (!hasIconVariant) {
      const showIcon = Math.random() < 0.5;
      if (showIcon) {
        preferences.abClassification = preferences.abClassification || [];
        preferences.abClassification.push(ABTestIds.LINK_STYLE);
        this.setUserPreferences(preferences);
        this.setAbTestGroup(ABTestIds.LINK_STYLE);
        
        console.log(`User assigned to icon variant for A/B test: ${ABTestIds.LINK_STYLE}`);
      } else {
        console.log(`User assigned to text-only variant for A/B test: ${ABTestIds.LINK_STYLE}`);
      }
      return showIcon;
    }

    return hasIconVariant;
  }
}
