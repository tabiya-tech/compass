import AuthenticationStateService from "./AuthenticationState.service";
import {
  userPreferencesStateService,
  UserPreferencesStateService,
} from "src/userPreferences/UserPreferencesStateService";
import { userPreferencesService } from "src/userPreferences/UserPreferencesService/userPreferences.service";
import { Language } from "src/userPreferences/UserPreferencesService/userPreferences.types";
import { TabiyaUser, Token, TokenHeader } from "src/auth/auth.types";
import { jwtDecode } from "jwt-decode";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";

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
   * Updates the application state when a successful logout occurs
   * @throws {Error} If clearing the persistent storage fails
   */
  async onSuccessfulLogout(): Promise<void> {
    // clear the user from the context, and the persistent storage
    this.authenticationStateService.clearUser();
    // clear the userPreferences from the "state"
    this.userPreferencesStateService.clearUserPreferences();
    // clear the login method from the persistent storage only if the user is successfully logged out
    PersistentStorageService.clearLoginMethod();
  }

  /**
   * Updates the application state when a successful login occurs
   * @throws {FirebaseError} If the user is not found after successful login
   */
  async onSuccessfulLogin(token: string): Promise<void> {
    const user = this.getUser(token);
    if (!user) {
      throw Error("User not found in the token");
    }
    PersistentStorageService.setToken(token);
    this.authenticationStateService.setUser(user);
    const prefs = await userPreferencesService.getUserPreferences(user.id);
    if (prefs !== null) {
      // set the local preferences "state" ( for lack of a better word )
      userPreferencesStateService.setUserPreferences(prefs);
    }
  }

  /**
   * Updates the application state when a successful registration occurs
   * @throws {FirebaseError} If the user is not found after successful registration
   */
  async onSuccessfulRegistration(token: string, registrationCode: string): Promise<void> {
    const user = this.getUser(token);
    if (!user) {
      throw Error("User not found in the token");
    }
    PersistentStorageService.setToken(token);
    this.authenticationStateService.setUser(user);

    // create user preferences for the first time.
    // in order to do this, there needs to be a logged-in user in the persistent storage
    const prefs = await userPreferencesService.createUserPreferences({
      user_id: user.id,
      invitation_code: registrationCode,
      language: Language.en,
    });
    userPreferencesStateService.setUserPreferences(prefs);
  }

  /**
   * Updates the application state when a successful refresh occurs
   * @param {string} token - The authentication token
   */
  async onSuccessfulRefresh(token: string): Promise<void> {
    const user = this.getUser(token);
    if (!user) {
      throw Error("User not found in the token");
    }
    PersistentStorageService.setToken(token);
    this.authenticationStateService.setUser(user);
  }

  /**
   * Checks if a given token is valid (not expired and not issued in the future).
   *
   * @param {string} token - The token to validate.
   * @returns {boolean} True if the token is valid, false otherwise.
   */
  public isTokenValid(token: string): { isValid: boolean; decodedToken: Token | null } {
    try {
      // Decode the header and validate it
      const decodedHeader: TokenHeader = jwtDecode(token, { header: true });
      if (decodedHeader.typ !== "JWT") {
        console.debug("Token is not a JWT");
        return { isValid: false, decodedToken: null };
      }
      if (!decodedHeader.alg) {
        console.debug("Token is not signed");
        return { isValid: false, decodedToken: null };
      }
      if (!decodedHeader.kid) {
        console.debug("Token does not have a key ID (kid)");
        return { isValid: false, decodedToken: null };
      }

      // Decode the token and validate it
      const decodedToken: Token = jwtDecode(token);
      const currentTime = Math.floor(Date.now() / 1000);
      if (decodedToken.exp < currentTime) {
        console.debug("Token is expired");
        return { isValid: false, decodedToken: null };
      }
      if (decodedToken.iat > currentTime) {
        console.debug("Token issued in the future");
        return { isValid: false, decodedToken: null };
      }

      console.debug("Token checked. Token is valid");
      return { isValid: true, decodedToken: decodedToken };
    } catch (error) {
      console.error("Error decoding token:", error);
      return { isValid: false, decodedToken: null };
    }
  }
}

export default AuthenticationService;
