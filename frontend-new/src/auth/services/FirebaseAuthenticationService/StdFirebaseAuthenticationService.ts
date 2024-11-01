import { firebaseAuth } from "src/auth/firebaseConfig";
import { TabiyaUser, Token } from "src/auth/auth.types";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import { jwtDecode } from "jwt-decode";

export interface FirebaseToken extends Token {
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
}

export enum FirebaseTokenProviders {
  GOOGLE = "google.com",
  PASSWORD = "password",
  ANONYMOUS = "anonymous",
}

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

  private static instance: StdFirebaseAuthenticationService;

  private constructor() {
    this.unsubscribeAuthListener = this.setupAuthListener();
  }

  static getInstance(): StdFirebaseAuthenticationService {
    if (!this.instance) {
      this.instance = new this();
    }
    return this.instance;
  }

  /**
   * Logs out the user from the Firebase authentication service.
   * It signs out the user, deletes the Firebase IndexedDB, clears the refresh timeout,
   * and clears user data from the authentication state and user preferences state services.
   *
   * @returns {Promise<void>} A promise that resolves when the logout process is complete.
   * @throws {FirebaseError} If an error occurs during the logout process.
   */
  async logout(): Promise<void> {
    try {
      await firebaseAuth.signOut();
    } catch (error) {
      console.warn("An error occurred while logging out from firebase. Cleaning firebase DB explicitly.", error);
      await this.deleteFirebaseDB();
    } finally {
      this.clearRefreshTimeout();
      this.unsubscribeAuthListener();
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
   * @throws {Error} If an error occurs during the setup of the authentication listener.
   */
  private setupAuthListener(): () => void {
    console.debug("Setting up auth listener");
    return firebaseAuth.onAuthStateChanged(async (user) => {
      if (user) {
        console.debug("User authenticated");
        user.getIdToken(true).then((token) => {
          this.scheduleTokenRefresh(token);
        });
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
   * @throws {Error} If an error occurs during the deletion process.
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
   * @throws {Error} If the unsubscribe from the authentication listener fails.
   */
  public cleanup() {
    console.debug("Cleaning up FirebaseAuthService");
    this.unsubscribeAuthListener();
    this.clearRefreshTimeout();
  }

  public getUserFromDecodedToken(decodedToken: FirebaseToken): TabiyaUser {
    return {
      id: decodedToken.user_id,
      name: decodedToken.name || decodedToken.email, // Use email if name is not available
      email: decodedToken.email,
    };
  }

  /**
   * Checks if a given decode token is valid firebase token.
   * It does not general token validation, but checks specifically for firebase token properties.
   *
   * @param {FirebaseToken} decodedToken - The decoded token to validate.
   * @returns {boolean} True if the token is a valid firebase token, false otherwise.
   */
  public isFirebaseTokenValid(decodedToken: FirebaseToken): boolean {
    if (!decodedToken.firebase) {
      console.debug("Token is not a valid firebase token");
      return false;
    }
    if (!decodedToken.firebase.sign_in_provider) {
      console.debug("Token does not have a sign in provider");
      return false;
    }
    if (!decodedToken.user_id) {
      console.debug("Token does not have a user ID");
      return false;
    }
    return true;
  }
}

export default StdFirebaseAuthenticationService;
