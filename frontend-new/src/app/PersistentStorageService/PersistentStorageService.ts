import { UserPreference } from "src/userPreferences/UserPreferencesService/userPreferences.types";
import { Invitation } from "src/invitations/InvitationsService/invitations.types";

export const TOKEN_KEY = "token";
export const USER_PREFERENCES_KEY = "user_preferences";

export const INVITATION_KEY = "invitation";

/**
 * This class is used to store the tokens in the session storage.
 *   eg: refresh token
 */
export class PersistentStorageService {
  static readonly storage = sessionStorage;
  static readonly local = localStorage;

  /**
   * Returns the token from the storage
   * @returns string | null - The token
   */
  static getToken(): string | null {
    return this.storage.getItem(TOKEN_KEY);
  }

  /**
   * Clears the token from the storage
   */
  static clearToken(): void {
    this.storage.removeItem(TOKEN_KEY);
  }

  /**
   * Sets the token in the storage
   * @param token
   */
  static setToken(token: string): void {
    this.storage.setItem(TOKEN_KEY, token);
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
   * Returns the item from the storage
   * @returns string | null - The item from the storage
   *
   */
  static getItem(storage: Storage, key: string): string | null {
    return storage.getItem(key);
  }

  /**
   * Sets an item in the specified storage.
   * @param {Storage} storage - The storage object (localStorage or sessionStorage).
   * @param {string} key - The key of the item to remove.
   * @param {string} value - The value of the item to set.
   */
  static setItem(storage: Storage, key: string, value: string): void {
    storage.setItem(key, value);
  }

  /**
   * Removes an item from the specified storage.
   * @param {Storage} storage - The storage object (localStorage or sessionStorage).
   * @param {string} key - The key of the item to remove.
   */
  static removeItem(storage: Storage, key: string): void {
    storage.removeItem(key);
  }

  /**
   * Clears the storage
   */
  static clear(): void {
    this.storage.clear();
  }
}
