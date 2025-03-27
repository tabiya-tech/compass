import { TabiyaUser } from "src/auth/auth.types";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import * as Sentry from "@sentry/react";
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
export default class AuthenticationStateService {
  private static instance: AuthenticationStateService;
  private user: TabiyaUser | null = null;

  private constructor() {}

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
  public setUser(user: TabiyaUser | null): TabiyaUser | null {
    this.user = user;
    // Set the session context for Sentry so that we can track the user id in errors
    try {
      Sentry.setUser({
        user_id: user?.id ?? "UNKNOWN"
      });
    } catch (err) {
      console.error("Error setting Sentry user context", err);
    }
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
}
