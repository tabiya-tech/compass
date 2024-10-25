import { AuthenticationStateService } from "./AuthenticationState.service";
import {
  userPreferencesStateService,
  UserPreferencesStateService,
} from "src/userPreferences/UserPreferencesStateService";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import { userPreferencesService } from "src/userPreferences/UserPreferencesService/userPreferences.service";
import { Language } from "src/userPreferences/UserPreferencesService/userPreferences.types";
import { getFirebaseErrorFactory } from "src/error/FirebaseError/firebaseError";
import { TabiyaUser, Token } from "src/auth/auth.types";
import { jwtDecode } from "jwt-decode";

/**
 * Abstract class representing an authentication service.
 *
 * Its responsibilities are:
 * (a) to offer a common interface for all authentication services.
 * This class defines the interface that specific authentication service implementations should implement,
 * which includes how to refresh tokens, cleanup operations, and logout.
 *
 * (b) to manage the application state and user preferences.
 * Additionally, this class provides callback methods that should be called by the child classes when specific events occur to update the application state,
 * which includes the authentication state and user preferences. Subclasses should manage the state directly
 *
 * All instances of AuthenticationServices should be singletons.
 */
abstract class AuthenticationService {
  protected readonly authenticationStateService: AuthenticationStateService;
  protected readonly userPreferencesStateService: UserPreferencesStateService;

  protected constructor() {
    this.authenticationStateService = AuthenticationStateService.getInstance();
    this.userPreferencesStateService = UserPreferencesStateService.getInstance();
  }

  /**
   * Refreshes the authentication token.
   * This method should be called to schedule a refresh of the token
   * It should obtain a new token from the authentication provider and update it in the application state.
   * @returns {Promise<void>} A promise that resolves when the token has been refreshed.
   */
  abstract refreshToken(): Promise<void>;

  /**
   * Performs cleanup operations when the application unmounts.
   * This method should be used to clear any artifacts, listeners, or timeouts set up by the authentication service.
   * It's crucial for preventing memory leaks and ensuring proper application shutdown.
   */
  abstract cleanup(): void;

  /**
   * Logs out the current user.
   * This method should clear all user-related data from the application state and storage.
   * @returns {Promise<void>} A promise that resolves when the logout process is complete.
   */
  abstract logout(): Promise<void>;

  /**
   * Retrieves user information based on the provided token.
   * This method should decode the token and extract relevant user data.
   * @param {string} token - The authentication token.
   * @returns {TabiyaUser | null} The user object if the token is valid, null otherwise.
   */
  abstract getUser(token: string): TabiyaUser | null;

  /**
   * "callbacks" to be called by the child classes when specific events occur
   */
  async onSuccessfulLogout(): Promise<void> {
    // clear the user from the context, and the persistent storage
    this.authenticationStateService.clearUser();
    // clear the userPreferences from the "state"
    this.userPreferencesStateService.clearUserPreferences();
    // clear the login method from the persistent storage
    PersistentStorageService.clearLoginMethod();
  }

  async onSuccessfulLogin(token: string): Promise<void> {
    const firebaseErrorFactory = getFirebaseErrorFactory(
      "AuthenticationService",
      "onSuccessfulRegistration",
      "POST",
      "onSuccessfulRegistration"
    );
    try {
      const _user = await this.getUser(token);
      this.authenticationStateService.setUser(_user);
      const user = this.authenticationStateService.getUser();
      const prefs = await userPreferencesService.getUserPreferences(user!.id);
      if (prefs !== null) {
        // set the local preferences "state" ( for lack of a better word )
        userPreferencesStateService.setUserPreferences(prefs);
      }
    } catch (err) {
      throw firebaseErrorFactory((err as any).code, (err as any).message);
    }
  }

  async onSuccessfulRegistration(token: string, registrationCode: string): Promise<void> {
    const firebaseErrorFactory = getFirebaseErrorFactory(
      "AuthenticationService",
      "onSuccessfulRegistration",
      "POST",
      "onSuccessfulRegistration"
    );
    try {
      const _user = await this.getUser(token);
      this.authenticationStateService.setUser(_user);
      const user = this.authenticationStateService.getUser();
      if (user) {
        // create user preferences for the first time.
        // in order to do this, there needs to be a logged in user in the persistent storage
        const prefs = await userPreferencesService.createUserPreferences({
          user_id: user.id,
          invitation_code: registrationCode,
          language: Language.en,
        });
        userPreferencesStateService.setUserPreferences(prefs);
      } else {
        throw new Error("User not found");
      }
    } catch (error) {
      throw firebaseErrorFactory((error as any).code, (error as any).message);
    }
  }

  async onSuccessfulRefresh(token: string): Promise<void> {
    const _user = await this.getUser(token);
    this.authenticationStateService.setUser(_user);
  }

  /**
   * Checks if a given token is valid (not expired and not issued in the future).
   *
   * @param {string} token - The token to validate.
   * @returns {boolean} True if the token is valid, false otherwise.
   */
  public isTokenValid(token: string): boolean {
    try {
      const decodedToken: Token = jwtDecode(token);
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

export default AuthenticationService;
