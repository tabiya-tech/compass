import { UserPreference } from "src/userPreferences/UserPreferencesService/userPreferences.types";

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

  public getUserPreferences(): UserPreference | null {
    return this.userPreferences;
  }

  public setUserPreferences(preferences: UserPreference): void {
    this.userPreferences = preferences;
  }

  public clearUserPreferences(): void {
    this.userPreferences = null;
  }

  public getActiveSessionId(): number | null {
    return this.userPreferences?.sessions.length ? this.userPreferences?.sessions[0] : null;
  }

  public activeSessionHasFeedback(): boolean {
    const activeSessionId = this.getActiveSessionId();
    if (activeSessionId === null) {
      return false;
    }
    return this.userPreferences!.sessions_with_feedback.includes(activeSessionId);
  }
}
