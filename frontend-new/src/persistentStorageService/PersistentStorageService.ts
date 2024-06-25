export const ID_TOKEN_KEY = "IDToken";
export const CHAT_SESSION_ID_KEY = "ChatSessionID";

/**
 * This class is used to store the tokens in the session storage.
 *   eg: refresh token
 */
export class PersistentStorageService {
  static readonly storage = sessionStorage;

  /**
   * Returns the ID token from the storage
   * @returns string | null - The ID token
   */
  static getIDToken(): string | null {
    return this.storage.getItem(ID_TOKEN_KEY);
  }

  /**
   * Clears the ID token from the storage
   */
  static clearIDToken(): void {
    this.storage.removeItem(ID_TOKEN_KEY);
  }

  /**
   * Sets the ID token in the storage
   * @param IDToken
   */
  static setIDToken(IDToken: string): void {
    this.storage.setItem(ID_TOKEN_KEY, IDToken);
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
