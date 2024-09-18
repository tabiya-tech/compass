import { UserPreference } from "src/userPreferences/UserPreferencesService/userPreferences.types";
import { userPreferencesService } from "src/userPreferences/UserPreferencesService/userPreferences.service";

class UserPreferencesService {
  private static instance: UserPreferencesService;
  private userPreferences: UserPreference | null = null;

  private constructor() {}

  public static getInstance(): UserPreferencesService {
    if (!UserPreferencesService.instance) {
      UserPreferencesService.instance = new UserPreferencesService();
    }
    return UserPreferencesService.instance;
  }

  public async loadPreferences(user_id: string) {
    try {
      if (!this.userPreferences?.accepted_tc) {
        this.userPreferences = await userPreferencesService.getUserPreferences(user_id);
      }
    } catch (error) {
      console.error("Error loading user preferences", error);
    }
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

export const userPreferencesStateService = UserPreferencesService.getInstance();
