import { UserPreference } from "src/userPreferences/UserPreferencesService/userPreferences.types";
import { Invitation } from "src/invitations/InvitationsService/invitations.types";

export const ACCESS_TOKEN_KEY = "access_token";
export const USER_PREFERENCES_KEY = "user_preferences";

export const INVITATION_KEY = "invitation";

/**
 * This class is used to store the tokens in the session storage.
 *   eg: refresh token
 */
export class PersistentStorageService {
  static readonly storage = sessionStorage;

  /**
   * Returns the access token from the storage
   * @returns string | null - The access token
   */
  static getAccessToken(): string | null {
    return this.storage.getItem(ACCESS_TOKEN_KEY);
  }

  /**
   * Clears the Access token from the storage
   */
  static clearAccessToken(): void {
    this.storage.removeItem(ACCESS_TOKEN_KEY);
  }

  /**
   * Sets the Access token in the storage
   * @param accessToken
   */
  static setAccessToken(accessToken: string): void {
    this.storage.setItem(ACCESS_TOKEN_KEY, accessToken);
  }

  /**
   * Returns the user preferences from the storage
   * @returns UserPreference | null - The user preferences
   */
  static getUserPreferences(): UserPreference | null {
    const item = this.storage.getItem(USER_PREFERENCES_KEY);
    return item
      ? {
          ...JSON.parse(item),
          accepted_tc: new Date(JSON.parse(item).accepted_tc),
        }
      : null;
  }

  /**
   * Sets the user preferences in the storage
   * @param preferences
   */
  static setUserPreferences(preferences: UserPreference): void {
    this.storage.setItem(USER_PREFERENCES_KEY, JSON.stringify(preferences));
  }

  /**
   * Clears the user preferences from the storage
   * @param preferences
   * @returns void
   */
  static clearUserPreferences(): void {
    this.storage.removeItem(USER_PREFERENCES_KEY);
  }

  /**
   * Returns the user's invitation details from the storage
   * @returns Invitation | null - The user's invitation details
   */
  static getInvitation(): Invitation | null {
    const item = this.storage.getItem(INVITATION_KEY);
    return item ? JSON.parse(item) : null;
  }

  /**
   * Sets the user's invitation details in the storage
   * @param invitation
   */
  static setInvitation(invitation: Invitation): void {
    this.storage.setItem(INVITATION_KEY, JSON.stringify(invitation));
  }

  /**
   * Clears the user's invitation details from the storage
   */
  static clearInvitation(): void {
    this.storage.removeItem(INVITATION_KEY);
  }

  /**
   * Clears the storage
   */
  static clear(): void {
    this.storage.clear();
  }
}
