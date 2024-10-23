import { FirebaseToken, TabiyaUser } from "src/auth/auth.types";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import { jwtDecode } from "jwt-decode";

/**
 * AuthenticationStateService manages the authentication state of the application.
 * It provides methods to get, set, and clear the current user, as well as to update
 * the user based on an authentication token.
 * 
 * Role:
 * - Acts as a centralized store for the current user's authentication state.
 * - Provides methods to manage and access the authentication state throughout the application.
 * 
 * Responsibilities:
 * - Stores and manages the current user object.
 * - Provides methods to get and set the current user.
 * - Handles token decoding and user object creation from tokens.
 * - Manages the persistence of authentication tokens.
 * - Validates token expiration.
 * 
 * Boundaries:
 * - Does not perform authentication operations (login, logout, etc.).
 * - Does not interact directly with authentication providers (e.g., Firebase).
 * - Does not manage user sessions beyond storing the current user object.
 * - Relies on PersistentStorageService for token storage.
 * 
 * Usage:
 * This service should be used whenever the application needs to access or modify
 * the current user's authentication state. It provides a single source of truth
 * for the user's authentication status across the application.
 */
export class AuthenticationStateService {
  private static instance: AuthenticationStateService;
  private user: TabiyaUser | null = null;

  private constructor() {
  }

  /**
   * Returns the singleton instance of AuthenticationStateService.
   * Creates a new instance if one doesn't exist.
   * 
   * @returns {AuthenticationStateService} The singleton instance.
   */
  public static getInstance(): AuthenticationStateService {
    if (!AuthenticationStateService.instance) {
      AuthenticationStateService.instance = new AuthenticationStateService();
    }
    return AuthenticationStateService.instance;
  }

  /**
   * Retrieves the current user.
   * 
   * @returns {TabiyaUser | null} The current user object or null if no user is authenticated.
   */
  public getUser(): TabiyaUser | null {
    return this.user;
  }

  /**
   * Sets the current user.
   * 
   * @param {TabiyaUser | null} user - The user object to set.
   */
  public setUser(user: TabiyaUser | null) : TabiyaUser | null {
    this.user = user;
    return this.user;
  }

  /**
   * Clears the current user and removes the authentication token from storage.
   */
  public clearUser() {
    console.debug("AuthenticationStateService: Clearing user");
    PersistentStorageService.clearToken();
    this.setUser(null);
  }


  /**
   * Checks if a given token is valid (not expired and not issued in the future).
   *
   * @param {string} token - The token to validate.
   * @returns {boolean} True if the token is valid, false otherwise.
   */
  public isTokenValid(token: string): boolean {
    try {
      const decodedToken: FirebaseToken = jwtDecode(token);
      const currentTime = Math.floor(Date.now() / 1000);

      // Check if token is expired
      if (decodedToken.exp < currentTime) {
        console.debug("Token is expired");
        return false;
      }

      // Check if token was issued in the future (should never happen, but good to check)
      if (decodedToken.iat > currentTime) {
        console.debug("Token issued in the future");
        return false;
      }

      console.debug("Token checked. Token is valid");
      return true;
    } catch (error) {
      console.error("Error decoding token:", error);
      return false;
    }
  }
}

export default AuthenticationStateService;
