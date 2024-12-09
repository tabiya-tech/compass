import { firebaseAuth } from "src/auth/firebaseConfig";
import { getFirebaseErrorFactory } from "src/error/FirebaseError/firebaseError";
import { FirebaseErrorCodes } from "src/error/FirebaseError/firebaseError.constants";
import firebase from "firebase/compat/app";
import StdFirebaseAuthenticationService, {
  FirebaseToken,
  FirebaseTokenProvider,
} from "src/auth/services/FirebaseAuthenticationService/StdFirebaseAuthenticationService";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import { AuthenticationServices, TabiyaUser } from "src/auth/auth.types";
import AuthenticationService from "src/auth/services/Authentication.service";
import { formatTokenForLogging } from "src/auth/utils/formatTokenForLogging";
import { TokenError } from "src/error/commonErrors";

class FirebaseSocialAuthenticationService extends AuthenticationService {
  private static instance: FirebaseSocialAuthenticationService;
  private readonly stdFirebaseAuthServiceInstance: StdFirebaseAuthenticationService;

  private constructor() {
    super();
    this.stdFirebaseAuthServiceInstance = StdFirebaseAuthenticationService.getInstance();
  }

  /**
   * Get the singleton instance of the SocialAuthService.
   * @returns {FirebaseSocialAuthenticationService} The singleton instance
   * @throws {Error} If initialization of StdFirebaseAuthService fails
   */
  static getInstance(): FirebaseSocialAuthenticationService {
    if (!this.instance) {
      this.instance = new this();
    }
    return this.instance;
  }

  /**
   * Handle login with Google popup
   * @returns {Promise<string>} The firebase token
   * @throws {FirebaseError} If the firebase authentication fails or user is not found after successful login
   * @throws {Error} If token is missing from user credentials
   */
  async loginWithGoogle(): Promise<string> {
    const firebaseErrorFactory = getFirebaseErrorFactory(
      "SocialAuthService",
      "handleLoginWithGoogle",
      "POST",
      "signInWithPopup"
    );

    let userCredential;
    try {
      // first login with google
      userCredential = await firebaseAuth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
    } catch (error) {
      throw firebaseErrorFactory((error as any).code, (error as any).message);
    }

    // @ts-expect-error - we know that the userCredential is not null
    if (!userCredential?.user?.multiFactor?.user?.accessToken) {
      throw firebaseErrorFactory(FirebaseErrorCodes.USER_NOT_FOUND, "The user could not be found", {});
    }

    // @ts-ignore
    const tokenResponse = userCredential.user.multiFactor.user.accessToken as string;
    // set the login method to social for future reference
    // we'll want to know how the user logged in, when we want to log them out for example
    PersistentStorageService.setLoginMethod(AuthenticationServices.FIREBASE_SOCIAL);

    // call the parent class method once the user is successfully logged in
    await super.onSuccessfulLogin(tokenResponse);
    return tokenResponse;
  }

  /**
   * Clean up any resources used by the authentication service
   * @throws {Error} If cleanup of StdFirebaseAuthService fails
   */
  async cleanup(): Promise<void> {
    this.stdFirebaseAuthServiceInstance.cleanup();
  }

  /**
   * Log out the current user
   */
  async logout(): Promise<void> {
    await this.stdFirebaseAuthServiceInstance.logout();
    await super.onSuccessfulLogout();
  }

  /**
   * Refresh the current authentication token
   * @throws {Error} If token refresh fails (will attempt to logout)
   */
  async refreshToken(): Promise<void> {
    try {
      const newToken = await this.stdFirebaseAuthServiceInstance.refreshToken();
      // call the parent class method once the token is successfully refreshed
      await super.onSuccessfulRefresh(newToken);
    } catch (error) {
      console.error(new TokenError("Error refreshing token:", error as Error));
      // if token refresh fails, log the user out
      await this.logout();
    }
  }

  /**
   * Get user information from token
   * @param {string} token - The authentication token
   * @returns {TabiyaUser | null} The user information or null if token is invalid
   * @throws {Error} If token parsing fails
   */
  getUser(token: string): TabiyaUser | null {
    const { isValid, decodedToken, failureCause } = this.isTokenValid(token);

    if (!isValid) {
      console.warn(new TokenError(`token is invalid:${formatTokenForLogging(token)}`, failureCause));
      return null;
    }
    return this.stdFirebaseAuthServiceInstance.getUserFromDecodedToken(decodedToken!);
  }

  /**
   * Check if the token is a valid Google firebase token
   * @param {string} token - The authentication token
   * @returns {boolean} True if the token is valid, false otherwise
   */
  public isTokenValid(token: string): { isValid: boolean; decodedToken: FirebaseToken | null; failureCause?: string } {
    const {
      isValid: isValidToken,
      decodedToken,
      failureCause: tokenValidationFailureCause,
    } = super.isTokenValid(token);

    if (!isValidToken) {
      console.debug(`token is invalid: ${tokenValidationFailureCause} - ${formatTokenForLogging(token)}`);
      return { isValid: false, decodedToken: null, failureCause: tokenValidationFailureCause! };
    }

    const { isValid: isValidFirebaseToken, failureCause: firebaseTokenValidationFailureCause } =
      this.stdFirebaseAuthServiceInstance.isFirebaseTokenValid(
        decodedToken as FirebaseToken,
        FirebaseTokenProvider.GOOGLE
      );
    if (!isValidFirebaseToken) {
      console.debug(
        `token is not a valid firebase token: ${firebaseTokenValidationFailureCause} - ${formatTokenForLogging(token)}`
      );
      return { isValid: false, decodedToken: null, failureCause: firebaseTokenValidationFailureCause! };
    }

    return { isValid: true, decodedToken: decodedToken as FirebaseToken };
  }
}

export default FirebaseSocialAuthenticationService;
