import firebase from "firebase/compat/app";
import { firebaseAuth } from "src/auth/firebaseConfig";
import {
  castToFirebaseError,
  getFirebaseErrorFactory,
  FirebaseErrorFactory,
} from "src/error/FirebaseError/firebaseError";
import { AdminUser } from "src/auth/auth.types";
import { TokenError } from "src/error/commonErrors";
import UserStateService from "src/userState/UserStateService";
import { AccessRole } from "src/auth/services/FirebaseAuthenticationService/types";
import { FirebaseErrorCodes } from "src/error/FirebaseError/firebaseError.constants";
import StdFirebaseAuthenticationService, {
  FirebaseToken,
  FirebaseTokenProvider,
} from "src/auth/services/FirebaseAuthenticationService/StdFirebaseAuthenticationService";
import AuthenticationService, { TokenValidationFailureCause } from "src/auth/services/Authentication.service";

/**
 * Formats a token for logging by showing only the last 20 characters.
 */
const formatTokenForLogging = (token: string): string => {
  return "..." + token.slice(-20);
};

/**
 * Firebase Email Authentication Service that handles email/password authentication
 * for the admin frontend.
 */
class FirebaseEmailAuthenticationService extends AuthenticationService {
  private static instance: FirebaseEmailAuthenticationService;
  private readonly stdFirebaseAuthServiceInstance: StdFirebaseAuthenticationService;

  private constructor() {
    super();
    this.stdFirebaseAuthServiceInstance = StdFirebaseAuthenticationService.getInstance();
  }

  /**
   * Get the singleton instance of the FirebaseEmailAuthenticationService.
   */
  static getInstance(): FirebaseEmailAuthenticationService {
    if (!this.instance) {
      this.instance = new this();
    }
    return this.instance;
  }

  /**
   * Handle user login with email and password.
   * @param {string} email - The user's email address.
   * @param {string} password - The user's password.
   * @returns {Promise<string>} - The firebase token.
   */
  async login(email: string, password: string): Promise<string> {
    const firebaseErrorFactory = getFirebaseErrorFactory("FirebaseEmailAuthService", "login");

    let userCredential;

    try {
      userCredential = await firebaseAuth.signInWithEmailAndPassword(email, password);
    } catch (error) {
      throw castToFirebaseError(error, firebaseErrorFactory);
    }

    if (!userCredential.user) {
      throw firebaseErrorFactory(FirebaseErrorCodes.USER_NOT_FOUND, "User not found", {});
    }

    // Verify the user has access enabled and get the access role from token custom claims
    const profile = await this.stdFirebaseAuthServiceInstance.getProfile(userCredential.user, firebaseErrorFactory);

    // Get the ID token
    const token = await userCredential.user.getIdToken();

    // Call the parent class method once the user is successfully logged in
    await super.onSuccessfulLogin(token);

    // Populate the user state service with the user profile
    const user = this.getUser(token);
    if (user) {
      this.populateUserState(user, profile);
    }

    return token;
  }

  /**
   * Populates the UserStateService with user profile data.
   * @param user - The admin user data from the token.
   * @param accessRole - The user's access role from Firestore.
   */
  private populateUserState(user: AdminUser, accessRole: AccessRole): void {
    UserStateService.getInstance().setUserState({
      id: user.id,
      name: user.name,
      email: user.email,
      accessRole,
    });
    console.debug("UserStateService populated for user:", user.email);
  }

  /**
   * Fetches the user's access role from their token custom claims.
   * @param firebaseUser - The Firebase user object.
   * @param errorFactory - Factory function to create FirebaseError instances.
   * @returns The user's access role.
   */
  async getAccessRole(firebaseUser: firebase.User, errorFactory: FirebaseErrorFactory): Promise<AccessRole> {
    return this.stdFirebaseAuthServiceInstance.getProfile(firebaseUser, errorFactory);
  }

  /**
   * Send a password-reset email via Firebase's hosted template.
   * @param {string} email - Recipient address.
   * @throws {FirebaseError} If the send fails (e.g. user-not-found, too-many-requests).
   */
  async resetPassword(email: string): Promise<void> {
    const firebaseErrorFactory = getFirebaseErrorFactory("FirebaseEmailAuthService", "resetPassword");
    try {
      // No actionCodeSettings: passing a continueUrl forces Firebase's hosted
      // reset page to load /__/firebase/init.json from the auth domain, which
      // breaks on dev (auth subdomain Hosting site doesn't serve it; the apex
      // redirect lacks CORS). After the reset, Firebase's default page links
      // back to the app — close enough.
      await firebaseAuth.sendPasswordResetEmail(email);
    } catch (error) {
      throw castToFirebaseError(error, firebaseErrorFactory);
    }
  }

  /**
   * Clean up any resources used by the authentication service
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
   */
  async refreshToken(): Promise<void> {
    try {
      const newToken = await this.stdFirebaseAuthServiceInstance.refreshToken();
      await super.onSuccessfulRefresh(newToken);
    } catch (error) {
      console.error(new TokenError("error refreshing token", error));
    }
  }

  /**
   * Get user information from token
   */
  getUser(token: string): AdminUser | null {
    const { isValid, decodedToken, failureCause } = this.isTokenValid(token);

    if (!isValid) {
      if (failureCause === TokenValidationFailureCause.TOKEN_EXPIRED) {
        console.debug(new TokenError(`token is invalid: ${formatTokenForLogging(token)}`, failureCause));
        return null;
      }
      console.error(new TokenError(`token is invalid: ${formatTokenForLogging(token)}`, failureCause));
      return null;
    }

    return this.stdFirebaseAuthServiceInstance.getUserFromDecodedToken(decodedToken!);
  }

  /**
   * Check if the token is a valid email firebase token
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
        FirebaseTokenProvider.PASSWORD
      );
    if (!isValidFirebaseToken) {
      console.debug(
        `token is not a valid firebase token: ${firebaseTokenValidationFailureCause} - ${formatTokenForLogging(token)}`
      );
      return { isValid: false, decodedToken: null, failureCause: firebaseTokenValidationFailureCause! };
    }

    return { isValid: true, decodedToken: decodedToken as FirebaseToken };
  }

  /**
   * Checks if a firebase active session/user exists in the local storage.
   */
  async isProviderSessionValid(): Promise<boolean> {
    return await this.stdFirebaseAuthServiceInstance.isAuthSessionValid();
  }
}

export default FirebaseEmailAuthenticationService;
