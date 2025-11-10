import AuthenticationStateService from "./AuthenticationState.service";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import UserPreferencesService from "src/userPreferences/UserPreferencesService/userPreferences.service";
import { Language } from "src/userPreferences/UserPreferencesService/userPreferences.types";
import { TabiyaUser, Token, TokenHeader } from "src/auth/auth.types";
import { jwtDecode } from "jwt-decode";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import { RestAPIError } from "src/error/restAPIError/RestAPIError";
import { StatusCodes } from "http-status-codes";

export const CLOCK_TOLERANCE = 10; // 10 second buffer for expiration and issuance time, in case of clock skew

export enum TokenValidationFailureCause {
  TOKEN_EXPIRED = "TOKEN_EXPIRED",
  TOKEN_NOT_YET_VALID = "TOKEN_NOT_YET_VALID",
  TOKEN_NOT_A_JWT = "TOKEN_NOT_A_JWT",
  TOKEN_NOT_SIGNED = "TOKEN_NOT_SIGNED",
  TOKEN_DOES_NOT_HAVE_A_KEY_ID = "TOKEN_DOES_NOT_HAVE_A_KEY_ID",
  ERROR_DECODING_TOKEN = "ERROR_DECODING_TOKEN",
}

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
   * Checks if an active session, especially when using third party authentication providers.
   * like firebase or OAuth providers, exists.
   *
   * @returns {boolean} True if an active session exists, false otherwise.
   */
  abstract isProviderSessionValid(): Promise<boolean>

  /**
   * Updates the application state when a successful logout occurs
   */
  async onSuccessfulLogout(): Promise<void> {
    // clear the user from the context, and the persistent storage
    this.authenticationStateService.clearUser();
    this.authenticationStateService.clearToken();
    // clear the userPreferences from the "state"
    this.userPreferencesStateService.clearUserPreferences();
    // clear the personal info from the persistent storage only if the user is successfully logged out
    PersistentStorageService.clearPersonalInfo();
    PersistentStorageService.clearAccountConverted();
    // Dont clear the login method, we want to preserve the login method for other logins (e.g on a different tab)
    // the login method will be overwritten by the next login (doesnt need to be cleared)
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
    this.authenticationStateService.setUser(user);
    this.authenticationStateService.setToken(token);
    let prefs = null;
    try {
      prefs = await UserPreferencesService.getInstance().getUserPreferences(user.id);
    } catch (error) {
      if (error instanceof RestAPIError) {
        // if the user preferences are not found by user id, but has a valid token, log an info and continue with the prefs as null
        if (error.statusCode === StatusCodes.NOT_FOUND) {
          console.info(`User has not registered! Preferences could not be found for userId: ${user.id}`);
          return;
        }
      }
      // rethrow the error if it is not a 404 error
      throw error;
    }
    if (prefs !== null) {
      // set the local preferences "state" ( for lack of a better word )
      UserPreferencesStateService.getInstance().setUserPreferences(prefs);
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
    this.authenticationStateService.setUser(user);
    this.authenticationStateService.setToken(token);
    // create user preferences for the first time.
    // in order to do this, there needs to be a logged-in user in the persistent storage
    const prefs = await UserPreferencesService.getInstance().createUserPreferences({
      user_id: user.id,
      invitation_code: registrationCode,
      language: Language.en,
    });
    UserPreferencesStateService.getInstance().setUserPreferences(prefs);
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
    this.authenticationStateService.setUser(user);
    this.authenticationStateService.setToken(token)
  }

  /**
   * Checks the header and payload of the token to ensure it is a valid JWT
   *
   * @param {string} token - The token to validate.
   * @returns {boolean} True if the token is valid, false otherwise.
   */
  public isTokenValid(token: string): { isValid: boolean; decodedToken: Token | null; failureCause?: string } {
    try {
      // Decode the header and validate it
      const decodedHeader: TokenHeader = jwtDecode(token, { header: true });
      if (decodedHeader.typ !== "JWT") {
        console.debug("Token is not a JWT");
        return { isValid: false, decodedToken: null, failureCause: TokenValidationFailureCause.TOKEN_NOT_A_JWT };
      }
      if (!decodedHeader.alg) {
        console.debug("Token is not signed");
        return { isValid: false, decodedToken: null, failureCause: TokenValidationFailureCause.TOKEN_NOT_SIGNED };
      }
      if (!decodedHeader.kid) {
        console.debug("Token does not have a key ID (kid)");
        return {
          isValid: false,
          decodedToken: null,
          failureCause: TokenValidationFailureCause.TOKEN_DOES_NOT_HAVE_A_KEY_ID,
        };
      }

      // Decode the token and validate it
      const decodedToken: Token = jwtDecode(token);
      // The tolerance must be at lest greater than the precision loss by the Math.floor function (1 second)
      const currentTime = Math.floor(Date.now() / 1000);

      // Check expiration with buffer
      // ideally this would be a simple check, but since there is a chance that the server and client clocks are not perfectly synchronized,
      // we add a buffer to the expiration time to account for the potential time difference
      if (currentTime > decodedToken.exp + CLOCK_TOLERANCE) {
        console.debug("Token is expired: ", { exp: decodedToken.exp, currentTime });
        return { isValid: false, decodedToken: null, failureCause: TokenValidationFailureCause.TOKEN_EXPIRED };
      } else if (currentTime > decodedToken.exp) {
        console.warn(
          "Warning: token expiration time has elapsed, but is still within the acceptable tolerance period",
          {
            exp: decodedToken.exp,
            currentTime,
          },
        );
      }

      // Check issued time with buffer
      // similarly, we add a buffer to the issuance time to account for the potential time difference between the server and client clocks
      if (currentTime < decodedToken.iat - CLOCK_TOLERANCE) {
        console.debug("Token issued in the future: ", { iat: decodedToken.iat, currentTime });
        return { isValid: false, decodedToken: null, failureCause: TokenValidationFailureCause.TOKEN_NOT_YET_VALID };
      } else if (currentTime < decodedToken.iat) {
        console.warn(
          "Warning: token issued at time was after the current time, but within the acceptable tolerance period ",
          {
            iat: decodedToken.iat,
            currentTime,
          },
        );
      }
      return { isValid: true, decodedToken: decodedToken };
    } catch (error) {
      return { isValid: false, decodedToken: null, failureCause: TokenValidationFailureCause.ERROR_DECODING_TOKEN };
    }
  }
}

export default AuthenticationService;
