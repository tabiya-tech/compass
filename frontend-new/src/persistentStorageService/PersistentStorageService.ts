export const ACCESS_TOKEN_KEY = "access_token";
export const CHAT_SESSION_ID_KEY = "ChatSessionID";

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
   *  Returns the chat session id from the storage
   * @returns string | null - The session id
   */
  static getChatSessionID(): string | null {
    return this.storage.getItem(CHAT_SESSION_ID_KEY);
  }

  /**
   * Sets the chat session id in the storage
   * @param sessionID
   */
  static setChatSessionID(sessionID: string): void {
    this.storage.setItem(CHAT_SESSION_ID_KEY, sessionID);
  }

  /**
   * Clears the chat session id from the storage
   */
  static clearChatSessionID(): void {
    this.storage.removeItem(CHAT_SESSION_ID_KEY);
  }

  /**
   * Clears the storage
   */
  static clear(): void {
    this.storage.clear();
  }
}
