import { Invitation } from "src/invitations/InvitationsService/invitations.types";

const PERSISTENT_STORAGE_VERSION = "0.0.1";
export const TOKEN_KEY = `token_${PERSISTENT_STORAGE_VERSION}`;

export const INVITATION_KEY = `invitation_${PERSISTENT_STORAGE_VERSION}`;

export const LOGIN_METHOD_KEY = `login_method_${PERSISTENT_STORAGE_VERSION}`;

export const LOG_OUT_FLAG_KEY = `log_out_flag_${PERSISTENT_STORAGE_VERSION}`;

/**
 * This class is used to store the tokens in the session storage.
 *   eg: refresh token
 */
export class PersistentStorageService {
  static readonly storage = localStorage;

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
   * Sets the user's login method in the storage
   */
  static setLoginMethod(method: string): void {
    this.storage.setItem(LOGIN_METHOD_KEY, method);
  }

  /**
   * Returns the user's login method from the storage
   * @returns string | null - The user's login method
   */
  static getLoginMethod(): string | null {
    return this.storage.getItem(LOGIN_METHOD_KEY);
  }

  /**
   * Clears the user's login method from the storage
   */
  static clearLoginMethod(): void {
    this.storage.removeItem(LOGIN_METHOD_KEY);
  }

  /**
   * Sets the loggged out flag in the storage
   */
  static setLoggedOutFlag(loggedOut: boolean): void {
    this.storage.setItem(LOG_OUT_FLAG_KEY, loggedOut.toString());
  }

  /**
   * Returns the logged out flag from the storage
   * @returns string | null - The logged out flag
   */
  static getLoggedOutFlag(): boolean | null {
    return this.storage.getItem(LOG_OUT_FLAG_KEY) === "true";
  }

  /**
   * Clears the logged out flag from the storage
   */
  static clearLoggedOutFlag(): void {
    this.storage.removeItem(LOG_OUT_FLAG_KEY);
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
