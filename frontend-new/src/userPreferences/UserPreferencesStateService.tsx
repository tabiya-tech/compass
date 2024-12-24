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
}
