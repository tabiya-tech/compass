import { firebaseAuth } from "src/auth/firebaseConfig";
import { castToFirebaseError, getFirebaseErrorFactory } from "src/error/FirebaseError/firebaseError";
import { FirebaseErrorCodes } from "src/error/FirebaseError/firebaseError.constants";
import StdFirebaseAuthenticationService, {
  FirebaseToken,
  FirebaseTokenProvider,
} from "src/auth/services/FirebaseAuthenticationService/StdFirebaseAuthenticationService";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import { AuthenticationServices, TabiyaUser } from "src/auth/auth.types";
import { invitationsService } from "src/auth/services/invitationsService/invitations.service";
import { InvitationStatus, InvitationType } from "src/auth/services/invitationsService/invitations.types";
import UserPreferencesService from "src/userPreferences/UserPreferencesService/userPreferences.service";
import { Language } from "src/userPreferences/UserPreferencesService/userPreferences.types";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import AuthenticationService from "src/auth/services/Authentication.service";
import { formatTokenForLogging } from "src/auth/utils/formatTokenForLogging";
import { TokenError } from "src/error/commonErrors";

class FirebaseInvitationCodeAuthenticationService extends AuthenticationService {
  private static instance: FirebaseInvitationCodeAuthenticationService;
  private readonly stdFirebaseAuthServiceInstance: StdFirebaseAuthenticationService;

  private constructor() {
    super();
    this.stdFirebaseAuthServiceInstance = StdFirebaseAuthenticationService.getInstance();
  }

  /**
   * Get the singleton instance of the InvitationCodeAuthService.
   * @returns {FirebaseInvitationCodeAuthenticationService} The singleton instance of the InvitationCodeAuthService.
   */
  static getInstance(): FirebaseInvitationCodeAuthenticationService {
    if (!this.instance) {
      this.instance = new this();
    }
    return this.instance;
  }

  /**
   * handle anonymous login
   * @param {string} code - The invitation code to login with
   * @returns {Promise<string>} The firebase token
   * @throws {FirebaseError} If the firebase authentication fails
   * @throws {RestAPIError} If the invitation code is invalid or has wrong type
   */
  async login(code: string): Promise<string> {
    const firebaseErrorFactory = getFirebaseErrorFactory("InvitationCodeAuthService", "handleInvitationCodeLogin");
    let userCredential;
    let invitation;

    invitation = await invitationsService.checkInvitationCodeStatus(code);
    if (invitation.status !== InvitationStatus.VALID) {
      throw firebaseErrorFactory(FirebaseErrorCodes.INVALID_INVITATION_CODE, `invalid invitation code: ${code}`);
    }
    if (invitation.invitation_type !== InvitationType.LOGIN) {
      throw firebaseErrorFactory(
        FirebaseErrorCodes.INVALID_INVITATION_TYPE,
        `the invitation code is not for login: ${code}`
      );
    }
    try {
      userCredential = await firebaseAuth.signInAnonymously();
    } catch (error) {
      throw castToFirebaseError(error, firebaseErrorFactory);
    }

    if (!userCredential.user) {
      throw firebaseErrorFactory(FirebaseErrorCodes.USER_NOT_FOUND, "User not found", {});
    }
    // in the case of anonymous login, firebase doesn't give us a way to access the access token directly,
    // but we can use the getIdToken method to get the id token, which will be identical to the access token
    const token = await userCredential.user.getIdToken();
    // set the login method to anonymous for future reference
    // we'll want to know how the user logged in, when we want to log them out for example
    PersistentStorageService.setLoginMethod(AuthenticationServices.FIREBASE_ANONYMOUS);

    // we set the user state in order to get a decoded version of the token
    this.authenticationStateService.setUser(this.getUser(token));
    const _user = this.authenticationStateService.getUser();

    if (!_user) {
      throw firebaseErrorFactory(
        FirebaseErrorCodes.USER_NOT_FOUND,
        `user could not be extracted from token: ...${token.slice(-20)}`
      );
    }

    // Update the token in the state with the new valid token.
    // `super.onSuccessfulLogin` also sets the token,
    // We are setting it here because we want to createUserPreferences before calling
    // super.onSuccessfulLogin, otherwise creating will fail.
    this.authenticationStateService.setToken(token)

    // create user preferences for the first time.
    const prefs = await UserPreferencesService.getInstance().createUserPreferences({
      user_id: _user.id,
      invitation_code: invitation.invitation_code,
      language: Language.en,
    });
    UserPreferencesStateService.getInstance().setUserPreferences(prefs);

    // call the parent class method once the user is successfully logged in
    await super.onSuccessfulLogin(token);
    return token;
  }

  /**
   * Cleanup resources used by the authentication service
   * @throws {Error} If cleanup fails
   */
  async cleanup(): Promise<void> {
    this.stdFirebaseAuthServiceInstance.cleanup();
  }

  /**
   * Logout the current user
   */
  async logout(): Promise<void> {
    await this.stdFirebaseAuthServiceInstance.logout();
    // Clear feedback notification on logout since anonymous users can't log in with the same user id again.
    const user = this.authenticationStateService.getUser();
    if (user) {
      PersistentStorageService.clearSeenFeedbackNotification(user.id);
    }
    await super.onSuccessfulLogout();
  }

  /**
   * Refresh the current authentication token
   * @throws {Error} If token refresh fails, will attempt to logout
   */
  async refreshToken(): Promise<void> {
    try {
      const newToken = await this.stdFirebaseAuthServiceInstance.refreshToken();
      // call the parent class method once the token is successfully refreshed
      await super.onSuccessfulRefresh(newToken);
    } catch (error) {
      console.error(new TokenError("error refreshing token", error));
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
      console.warn(new TokenError(`invalid token: ${formatTokenForLogging(token)}`, failureCause));
      return null;
    }
    return this.stdFirebaseAuthServiceInstance.getUserFromDecodedToken(decodedToken!);
  }

  /**
   * Check if the token is a valid anonymous firebase token
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
        FirebaseTokenProvider.ANONYMOUS
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

export default FirebaseInvitationCodeAuthenticationService;
