import { firebaseAuth } from "src/auth/firebaseConfig";
import { TabiyaUser, Token } from "src/auth/auth.types";
import AuthenticationStateService from "src/auth/services/AuthenticationState.service";

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

export enum FirebaseTokenProvider {
  GOOGLE = "google.com",
  PASSWORD = "password",
  ANONYMOUS = "anonymous",
}

export enum FirebaseTokenValidationFailureCause {
  INVALID_FIREBASE_TOKEN = "INVALID_FIREBASE_TOKEN",
  INVALID_FIREBASE_SIGN_IN_PROVIDER = "INVALID_FIREBASE_SIGN_IN_PROVIDER",
  INVALID_FIREBASE_USER_ID = "INVALID_FIREBASE_USER_ID"
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

  private static instance: StdFirebaseAuthenticationService;

  private constructor() {
  }

  static getInstance(): StdFirebaseAuthenticationService {
    if (!this.instance) {
      this.instance = new this();
    }
    return this.instance;
  }

  /**
   * Logs out the user from the Firebase authentication service.
   * It signs out the user, deletes the Firebase IndexedDB
   * and clears user data from the authentication state and user preferences state services.
   *
   * @returns {Promise<void>} A promise that resolves when the logout process is complete.
   */
  async logout(): Promise<void> {
    try {
      await firebaseAuth.signOut();
    } catch (error) {
      console.warn("An error occurred while logging out from firebase. Cleaning firebase DB explicitly.", error);
      await this.deleteFirebaseDB();
    }
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
        console.warn("Error deleting Firebase IndexedDB", event);
        clearTimeout(timeoutId);
        resolve();
      };

      DBDeleteRequest.onsuccess = (_event) => {
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
   * Refreshes the user's token if a current user exists.
   * It retrieves the current user's token, updates the authentication state with the new token,
   * and schedules the next token refresh.
   *
   * @returns {Promise<string>} A promise that resolves with the new token when the token refresh process is complete.
   * @throws {Error} If an error occurs during the token refresh process.
   */
  public async refreshToken(): Promise<string> {
    console.debug("Attempting to refresh token");
    const oldToken = AuthenticationStateService.getInstance().getToken();
    console.debug("Old token", "..." + oldToken?.slice(-20));

    // We need to use a one-time auth state listener because firebaseAuth.currentUser
    // might not be available immediately on page load. Its not perfectly documented that this will be triggered on
    // subscribing to onAuthStateChanged, but it seems to be the case. And this is the recommended way to handle auth state changes in Firebase.
    return new Promise<string>((resolve, reject) => {
      // Create a one-time listener that will be removed after the first auth state change
      const unsubscribeFunction = firebaseAuth.onAuthStateChanged(async (currentUser) => {
        if (currentUser) {
          try {
            const newToken = await currentUser.getIdToken(true);
            console.debug("New token obtained", "..." + newToken.slice(-20));
            AuthenticationStateService.getInstance().setToken(newToken);

            resolve(newToken);
          } catch (error) {
            console.error("Error refreshing token:", error);
            reject(error as Error);
          }
        } else {
          console.debug("No current user to refresh token");
          reject(new Error("No current user to refresh token"));
        }

        unsubscribeFunction();
      });
    });
  }

  /**
   * Cleans up the Firebase authentication service.
   * Presently does nothing, but will be used in the future to clean up resources like refresh listeners,
   * @throws {Error} If the cleanup fails
   */
  public cleanup() {
    console.debug("Cleaning up FirebaseAuthService");

  }

  public getUserFromDecodedToken(decodedToken: FirebaseToken): TabiyaUser {
    return {
      id: decodedToken.user_id,
      name: decodedToken.name || decodedToken.email, // Use email if name is not available
      email: decodedToken.email,
    };
  }

  /**
   * Checks if a given decoded token is valid firebase token.
   * Checks if the decoded has a firebase object the expected sign in provider and user ID.
   *
   * @param {FirebaseToken} decodedToken - The decoded token to validate.
   * @param expectedTokenProvider
   * @returns {boolean} True if the token is a valid firebase token, false otherwise.
   */
  public isFirebaseTokenValid(
    decodedToken: FirebaseToken,
    expectedTokenProvider: FirebaseTokenProvider
  ): { isValid: boolean; failureCause?: FirebaseTokenValidationFailureCause } {
    if (!decodedToken.firebase) {
      console.debug("Firebase Token Validation Failed: Token is not a valid firebase token");
      return { isValid: false, failureCause: FirebaseTokenValidationFailureCause.INVALID_FIREBASE_TOKEN };
    }
    if (decodedToken.firebase.sign_in_provider !== expectedTokenProvider) {
      console.debug(
        `Firebase Token Validation Failed: Token does not have the expected sign in provider: expected ${expectedTokenProvider}, got ${decodedToken.firebase.sign_in_provider}`
      );
      return { isValid: false, failureCause: FirebaseTokenValidationFailureCause.INVALID_FIREBASE_SIGN_IN_PROVIDER };
    }
    if (!decodedToken.user_id) {
      console.debug("Firebase Token Validation Failed: Token does not have a user ID");
      return { isValid: false, failureCause: FirebaseTokenValidationFailureCause.INVALID_FIREBASE_USER_ID };
    }
    return { isValid: true };
  }
}

export default StdFirebaseAuthenticationService;
