export const ID_TOKEN_KEY = "IDToken";

/**
 * This class is used to store the tokens in the session storage.
 *   eg: refresh token
 */
export class AuthPersistentStorage {
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
   * Clears the storage
   */
  static clear(): void {
    this.storage.clear();
  }
}
