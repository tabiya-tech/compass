import { getFirebaseErrorFactory } from "src/error/FirebaseError/firebaseError";
import { firebaseAuth } from "src/auth/firebaseConfig";
import { FirebaseErrorCodes } from "src/error/FirebaseError/firebaseError.constants";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import { TabiyaUser, Token } from "src/auth/auth.types";
import { jwtDecode } from "jwt-decode";
import authenticationStateService from "../AuthenticationState.service";

export type FirebaseToken = Token & {
  name: string;
  aud: string;
  auth_time: number;
  user_id: string;
  sub: string;
  email: string;
  email_verified: boolean;
  firebase: {
    identities: {
      email: string[];
    };
    sign_in_provider: string;
  };
};

/**
 * The FirebaseAuthenticationService is a concrete class that provides common functionality
 * for Firebase authentication services. It extends the AuthenticationService class and implements
 * methods for logging out, refreshing tokens, and handling authentication state changes.
 *
 * Responsibilities:
 * - Provides a base implementation for Firebase authentication services
 * - Handles common authentication tasks such as logging out, refreshing tokens, and managing authentication state
 * - Manages the Firebase authentication listener and token refresh process
 * - Cleans up resources when the service is no longer needed
 * - Handles the deletion of the Firebase IndexedDB
 * - Schedules token refreshes based on token expiration
 * - Checks for a pending logout on page load and finishes the logout process
 *
 * Boundaries:
 * - Does not handle the actual authentication process (login, signup) which is delegated to child classes
 * - Interacts with Firebase authentication,
 * - Uses callbacks to notify the parent class of successful logout and token refresh events
 */
class StdFirebaseAuthenticationService {
  private readonly FIREBASE_DB_NAME = "firebaseLocalStorageDb";
  private readonly REFRESH_TOKEN_EXPIRATION_PERCENTAGE = 0.1;
  private refreshTimeout: NodeJS.Timeout | null = null;
  private readonly unsubscribeAuthListener: () => void;

  private constructor() {
    this.unsubscribeAuthListener = this.setupAuthListener();
  }

  private async init() {
    await this.finishPendingLogout();
  }

  static async getInstance(): Promise<StdFirebaseAuthenticationService> {
    const instance = new StdFirebaseAuthenticationService();
    await instance.init();
    return instance;
  }
  /**
   * Logs out the user from the Firebase authentication service.
   * It signs out the user, deletes the Firebase IndexedDB, clears the refresh timeout,
   * and clears user data from the authentication state and user preferences state services.
   *
   * @returns {Promise<void>} A promise that resolves when the logout process is complete.
   * @throws {Error} If an error occurs during the logout process.
   */
  async logout(): Promise<void> {
    const errorFactory = getFirebaseErrorFactory("FirebaseAuthService", "logout", "POST", "signOut");
    try {
      await firebaseAuth.signOut();
      await this.deleteFirebaseDB();
      this.clearRefreshTimeout();
      this.unsubscribeAuthListener();
    } catch (error) {
      const firebaseError = (error as any).code;
      throw errorFactory(
        firebaseError || FirebaseErrorCodes.INTERNAL_ERROR,
        firebaseError.message || FirebaseErrorCodes.INTERNAL_ERROR,
        {}
      );
    } finally {
      PersistentStorageService.clearLoggedOutFlag();
    }
  }

  /**
   * Refreshes the user's token if a current user exists.
   * It retrieves the current user's token, updates the authentication state with the new token,
   * and schedules the next token refresh.
   *
   * @returns {Promise<void>} A promise that resolves when the token refresh process is complete.
   * @throws {Error} If an error occurs during the token refresh process.
   */
  public async refreshToken(): Promise<string> {
    console.debug("Attempting to refresh token");
    const oldToken = PersistentStorageService.getToken();
    console.debug("Old token", "..." + oldToken?.slice(-20));

    if (firebaseAuth.currentUser) {
      const newToken = await firebaseAuth.currentUser.getIdToken(true);
      console.debug("New token obtained", "..." + newToken.slice(-20));
      this.scheduleTokenRefresh(newToken);
      return newToken;
    } else {
      console.debug("No current user to refresh token");
      throw new Error("No current user to refresh token");
    }
  }

  /**
   * Schedules the next token refresh based on the token's expiration time.
   * It decodes the token to retrieve the expiration time, calculates the refresh time
   * (10% before expiration), and sets a timeout to trigger the token refresh.
   *
   * @param {string} token - The user's token.
   */
  private scheduleTokenRefresh(token: string) {
    console.debug("Scheduling next token refresh");
    this.clearRefreshTimeout();

    const decodedToken: FirebaseToken = jwtDecode(token);
    const expirationTime = decodedToken.exp * 1000;
    const currentTime = Date.now();
    const timeToExpiration = expirationTime - currentTime;
    const refreshTime = timeToExpiration - timeToExpiration * this.REFRESH_TOKEN_EXPIRATION_PERCENTAGE; // Refresh token 10% before expiration

    console.debug(`Next refresh scheduled in ${refreshTime / 1000} seconds`);

    this.refreshTimeout = setTimeout(async () => {
      await this.refreshToken();
    }, refreshTime);
  }

  /**
   * Sets up the Firebase authentication listener.
   * It listens for changes in the user's authentication state and schedules token refreshes
   * when the user is authenticated.
   *
   * @returns {() => void} A function to unsubscribe from the authentication listener.
   */
  private setupAuthListener(): () => void {
    console.debug("Setting up auth listener");
    return firebaseAuth.onAuthStateChanged(async (user) => {
      if (user) {
        console.debug("User authenticated");
        const token = await user.getIdToken(true);
        this.scheduleTokenRefresh(token);
      } else {
        console.debug("User not authenticated");
      }
    });
  }

  /**
   * Deletes the Firebase IndexedDB.
   * It attempts to delete the IndexedDB and resolves the promise after a timeout
   * or when the deletion is successful or blocked.
   *
   * @returns {Promise<void>} A promise that resolves when the deletion process is complete.
   */
  private deleteFirebaseDB(): Promise<void> {
    return new Promise((resolve) => {
      console.debug("Attempting to delete Firebase IndexedDB");

      const DBDeleteRequest = window.indexedDB.deleteDatabase(this.FIREBASE_DB_NAME);
      const timeoutDuration = 1000; // 1 second timeout

      const timeoutId = setTimeout(() => {
        console.warn("Firebase IndexedDB deletion timed out or blocked");
        resolve();
      }, timeoutDuration);

      DBDeleteRequest.onerror = (event) => {
        console.error("Error deleting Firebase IndexedDB", event);
        clearTimeout(timeoutId);
        resolve();
      };

      DBDeleteRequest.onsuccess = (event) => {
        console.debug("Firebase IndexedDB deleted successfully");
        clearTimeout(timeoutId);
        resolve();
      };

      DBDeleteRequest.onblocked = (event) => {
        console.warn("Firebase IndexedDB deletion blocked", event);
        // No need to do anything here, as the timeout will handle it
      };
    });
  }

  /**
   * Clears the refresh timeout if it exists.
   */
  private clearRefreshTimeout() {
    console.debug("Clearing refresh timeout");
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
      this.refreshTimeout = null;
    }
  }

  /**
   * Cleans up the Firebase authentication service.
   * It unsubscribes from the authentication listener and clears the refresh timeout.
   */
  public cleanup() {
    console.debug("Cleaning up FirebaseAuthService");
    this.unsubscribeAuthListener();
    this.clearRefreshTimeout();
  }

  /**
   * Checks for a pending logout on page load and finishes the logout process.
   */
  private async finishPendingLogout() {
    if (PersistentStorageService.getLoggedOutFlag()) {
      try {
        await this.logout();
      } catch (e) {
        console.error("Failed to logout user on page load", e);
      }
    }
  }

  public getUser(token: string): TabiyaUser | null {
    try {
      const _user = this.getFirebaseUserFromToken(token);
      if (_user) {
        PersistentStorageService.setToken(token);
        authenticationStateService.getInstance().setUser(_user);
        return _user;
      }
      return null;
    } catch (error) {
      console.error("Invalid token", error);
      return null;
    }
  }

  /**
   * Extracts user information from a JWT token.
   *
   * @param {string} token - The JWT token to decode.
   * @returns {TabiyaUser | null} The user object extracted from the token, or null if extraction fails.
   */
  //TODO: remove the idea of storing a user in this state. Store a token instead and decode it when needed (util)
  private readonly getFirebaseUserFromToken = (token: string): TabiyaUser | null => {
    try {
      const decodedToken: FirebaseToken = jwtDecode(token);
      const GOOGLE_ISSUER = "accounts.google.com";
      if (decodedToken.iss === GOOGLE_ISSUER) {
        // Google OAuth Token
        return {
          id: decodedToken.sub,
          name: decodedToken.name || decodedToken.email, // Google tokens might not have a name field
          email: decodedToken.email,
        };
      } else if (decodedToken.firebase?.sign_in_provider) {
        // Firebase Token
        const signInProvider = decodedToken.firebase.sign_in_provider;
        if (signInProvider === "password") {
          // Firebase Password Auth Token
          return {
            id: decodedToken.user_id,
            name: decodedToken.name,
            email: decodedToken.email,
          };
        } else {
          // Other Firebase Auth Providers (e.g., Facebook, Twitter, etc.)
          return {
            id: decodedToken.user_id,
            name: decodedToken.name || decodedToken.email, // Use email if name is not available
            email: decodedToken.email,
          };
        }
      } else {
        throw new Error("Unknown token issuer");
      }
    } catch (error) {
      console.error("Error decoding token:", error);
      return null;
    }
  };
}

export default StdFirebaseAuthenticationService;
