import { getFirebaseErrorFactory } from "src/error/FirebaseError/firebaseError";
import { auth } from "src/auth/firebaseConfig";
import { StatusCodes } from "http-status-codes";
import { FirebaseErrorCodes } from "src/error/FirebaseError/firebaseError.constants";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import { FirebaseToken } from "src/auth/auth.types";
import { jwtDecode } from "jwt-decode";
import AuthenticationService from "src/auth/services/Authentication.service";

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
class FirebaseAuthenticationService extends AuthenticationService {
  private readonly FIREBASE_DB_NAME = "firebaseLocalStorageDb";
  private readonly REFRESH_TOKEN_EXPIRATION_PERCENTAGE = 0.1;
  private refreshTimeout: NodeJS.Timeout | null = null;
  private readonly unsubscribeAuthListener: () => void;

  protected constructor(
  ) {
    super();
    this.finishPendingLogout(); // REVIEW: why is the promise not awaited? this should be moved to the getInstance()
                                //  or where the getInstance is used or the factory depending on how you want ot handle it
    this.unsubscribeAuthListener = this.setupAuthListener();
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
      await auth.signOut();
      await this.deleteFirebaseDB();
      this.clearRefreshTimeout(); // REVIEW On logout do unsubscribeAuthListener()
      // call the parent class method once the user is successfully logged out
      await super.onSuccessfulLogout();
    } catch (error) {
      const firebaseError = (error as any).code;
      throw errorFactory(
        firebaseError.statusCode || StatusCodes.INTERNAL_SERVER_ERROR,
        firebaseError || FirebaseErrorCodes.INTERNAL_ERROR,
        firebaseError.message || FirebaseErrorCodes.INTERNAL_ERROR,
        {}
      );
    } finally {
      PersistentStorageService.clearLoggedOutFlag();
      // call the parent class method in case the logout was unsuccessful
      // this means that even if the logout fails on the firebase side, the user will still be logged out of the app
      await super.onSuccessfulLogout();
    }
  }

  /**
   * Refreshes the user's token if a current user exists.
   * It retrieves the current user's token, updates the authentication state with the new token,
   * and schedules the next token refresh.
   *
   * @returns {Promise<void>} A promise that resolves when the token refresh process is complete.
   */
  public async refreshToken(): Promise<void> {
    console.debug("Attempting to refresh token");
    const oldToken = PersistentStorageService.getToken();
    console.debug("Old token", "..." + oldToken?.slice(-20));

    if (auth.currentUser) {
      try {
        const newToken = await auth.currentUser.getIdToken(true);
        console.debug("New token obtained", "..." + newToken.slice(-20));
        this.scheduleTokenRefresh(newToken);
        // call the parent class method once the token is successfully refreshed
        await super.onSuccessfulRefresh(newToken);
      } catch (error) {
        console.error("Error refreshing token:", error);
        // if token refresh fails, log the user out
        await this.logout();
      }
    } else {
      console.debug("No current user to refresh token");
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
    return auth.onAuthStateChanged(async (user) => {
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
        await this.logout()
      } catch (e) {
        console.error("Failed to logout user on page load", e);
      }
    }
  }
}

export default FirebaseAuthenticationService;