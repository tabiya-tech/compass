import { firebaseAuth } from "src/auth/firebaseConfig";
import { castToFirebaseError, getFirebaseErrorFactory } from "src/error/FirebaseError/firebaseError";
import { FirebaseErrorCodes } from "src/error/FirebaseError/firebaseError.constants";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import { AuthenticationServices, TabiyaUser } from "src/auth/auth.types";
import { invitationsService } from "src/auth/services/invitationsService/invitations.service";
import { InvitationStatus, InvitationType } from "src/auth/services/invitationsService/invitations.types";
import AuthenticationService, { TokenValidationFailureCause } from "src/auth/services/Authentication.service";
import StdFirebaseAuthenticationService, {
  FirebaseToken,
  FirebaseTokenProvider,
} from "src/auth/services/FirebaseAuthenticationService/StdFirebaseAuthenticationService";
import { formatTokenForLogging } from "src/auth/utils/formatTokenForLogging";
import { TokenError } from "src/error/commonErrors";
import firebase from "firebase/compat/app";
import { EmailAuthProvider } from "firebase/auth";
import { AuthBroadcastChannel, AuthChannelMessage } from "src/auth/services/authBroadcastChannel/authBroadcastChannel";

type UserCredential = firebase.auth.UserCredential;


class FirebaseEmailAuthenticationService extends AuthenticationService {
  private static instance: FirebaseEmailAuthenticationService;
  private readonly stdFirebaseAuthServiceInstance: StdFirebaseAuthenticationService;

  private constructor() {
    super();
    this.stdFirebaseAuthServiceInstance = StdFirebaseAuthenticationService.getInstance();
  }

  /**
   * Get the singleton instance of the EmailAuthService.
   * @returns {FirebaseEmailAuthenticationService} The singleton instance
   * @throws {Error} If initialization of StdFirebaseAuthService fails
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
   * @throws {FirebaseError} If login fails or email is not verified
   */
  async login(email: string, password: string): Promise<string> {
    const firebaseErrorFactory = getFirebaseErrorFactory(
      "EmailAuthService",
      "handleLogin",
    );

    let userCredential;

    try {
      userCredential = await firebaseAuth.signInWithEmailAndPassword(email, password);
    } catch (error) {
      throw castToFirebaseError(error, firebaseErrorFactory);
    }

    if (!userCredential.user) {
      throw firebaseErrorFactory(FirebaseErrorCodes.USER_NOT_FOUND, "User not found", {});
    }

    if (!userCredential.user.emailVerified) {
      // we cant stop firebase from logging the user in when their email is unverified,
      // best we can do is log them out ourselves and then throw an error
      try {
        await this.logout();
      } catch (signOutError) {
        throw castToFirebaseError(signOutError, firebaseErrorFactory);
      }
      throw firebaseErrorFactory(FirebaseErrorCodes.EMAIL_NOT_VERIFIED, "Email not verified", {});
    }

    // in the case of email login, firebase doesnt give us a way to access the access token directly
    // but we can use the getIdToken method to get the id token, which will be identical to the access token
    const token = await userCredential.user.getIdToken();
    // set the login method to email for future reference
    // we'll want to know how the user logged in, when we want to log them out for example
    PersistentStorageService.setLoginMethod(AuthenticationServices.FIREBASE_EMAIL);
    // call the parent class method once the user is successfully logged in
    await super.onSuccessfulLogin(token);

    // Broadcast login to other tabs
    AuthBroadcastChannel.getInstance().broadcast(AuthChannelMessage.LOGIN_USER);

    return token;
  }

  /**
   * Handle user registration with email, password, and username.
   * @param {string} email - The user's email address.
   * @param {string} password - The user's password.
   * @param {string} username - The user's username.
   * @param {string} registrationCode - The registration code.
   * @returns {Promise<string>} - The firebase token.
   * @throws {FirebaseError} If registration fails or verification email fails
   * @throws {FirebaseError} If user is not found after successful registration
   * @throws {FirebaseError} If registration code is invalid or wrong type
   */
  async register(email: string, password: string, username: string, registrationCode: string, reportToken?: string): Promise<string> {
    const firebaseErrorFactory = getFirebaseErrorFactory(
      "EmailAuthService",
      "handleRegister",
    );
    const invitation = await invitationsService.checkInvitationCodeStatus(registrationCode, reportToken);
    if (invitation.status === InvitationStatus.INVALID || invitation.status === InvitationStatus.USED) {
      throw firebaseErrorFactory(
        FirebaseErrorCodes.INVALID_REGISTRATION_CODE,
        `the registration code is invalid: ${registrationCode}`,
      );
    }
    if (!invitation.source && invitation.invitation_type && invitation.invitation_type !== InvitationType.REGISTER) {
      throw firebaseErrorFactory(
        FirebaseErrorCodes.INVALID_REGISTRATION_TYPE,
        `the invitation code is not for registration: ${registrationCode}`,
      );
    }

    let userCredential;

    try {
      userCredential = await firebaseAuth.createUserWithEmailAndPassword(email, password);
    } catch (error) {
      throw castToFirebaseError(error, firebaseErrorFactory);
    }

    if (!userCredential.user) {
      throw firebaseErrorFactory(FirebaseErrorCodes.USER_NOT_FOUND, "User not found", {});
    }

    try {
      // update the user's display username
      await userCredential.user.updateProfile({
        displayName: username,
      });
      // send a verification email
      await userCredential.user.sendEmailVerification();
    } catch (error) {
      throw castToFirebaseError(error, firebaseErrorFactory);
    }

    // in the case of email login, firebase doesnt give us a way to access the access token directly
    // but we can use the getIdToken method to get the id token, which will be identical to the access token
    const token = await userCredential.user.getIdToken();
    // set the login method to email for future reference
    // we'll want to know how the user logged in, when we want to log them out for example
    PersistentStorageService.setLoginMethod(AuthenticationServices.FIREBASE_EMAIL);

    //Note: when you register a user on firebase, they are automatically logged in
    // typically we would sign the user out immediately after registration
    // however we need to keep the user logged in to create user preferences
    // so once the preferences are created we will log the user out
    // we expect this to be done in the onSuccessfulRegistration method
    // by calling the parent class method once the user is successfully registered
    await super.onSuccessfulRegistration(token, invitation.code, reportToken);
    return token;
  }

  /**
   * Clean up any resources used by the authentication service
   * @throws {Error} If cleanup fails
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

    AuthBroadcastChannel.getInstance().broadcast(AuthChannelMessage.LOGOUT_USER);
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
      console.error(new TokenError("error refreshing token", error));
      // if token refresh fails, log the error and do nothing
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
        FirebaseTokenProvider.PASSWORD,
      );
    if (!isValidFirebaseToken) {
      console.debug(
        `token is not a valid firebase token: ${firebaseTokenValidationFailureCause} - ${formatTokenForLogging(token)}`,
      );
      return { isValid: false, decodedToken: null, failureCause: firebaseTokenValidationFailureCause! };
    }

    return { isValid: true, decodedToken: decodedToken as FirebaseToken };
  }

  /**
   * Link an anonymous account with email and password credentials
   * @param {string} email - The user's email address
   * @param {string} password - The user's password
   * @param {string} username - The user's username
   * @returns {Promise<string>} - The firebase token
   * @throws {FirebaseError} If linking fails or verification email fails
   */
  async linkAnonymousAccount(email: string, password: string, username: string): Promise<string> {
    const firebaseErrorFactory = getFirebaseErrorFactory(
      "EmailAuthService",
      "linkAnonymousAccount",
    );

    const currentUser = firebaseAuth.currentUser;
    if (!currentUser) {
      throw firebaseErrorFactory(FirebaseErrorCodes.USER_NOT_FOUND, "No anonymous user is currently logged in", {});
    }

    if (!currentUser.isAnonymous) {
      throw firebaseErrorFactory(FirebaseErrorCodes.INVALID_LOGIN_METHOD, "Current user is not an anonymous user", {});
    }
    let userCredential: UserCredential;
    try {
      // Create email credential
      const credential = EmailAuthProvider.credential(email, password);

      // Link anonymous account with email credential
      userCredential = await currentUser.linkWithCredential(credential);
    } catch (error) {
      throw castToFirebaseError(error, firebaseErrorFactory);
    }

    if (!userCredential.user) {
      throw firebaseErrorFactory(FirebaseErrorCodes.USER_NOT_FOUND, "User not found after linking", {});
    }
    try {
      // Update display name
      await userCredential.user.updateProfile({ displayName: username });

      // Send verification email
      await userCredential.user.sendEmailVerification();

      // Get new token after linking
      const token = await userCredential.user.getIdToken();

      // Update login method
      PersistentStorageService.setLoginMethod(AuthenticationServices.FIREBASE_EMAIL);

      // Call onSuccessfulLogin to ensure all necessary state is updated
      await super.onSuccessfulLogin(token);

      return token;
    } catch (error) {
      throw castToFirebaseError(error, firebaseErrorFactory);
    }
  }

  /**
   * Resend verification email to the user
   * @param {string} email - The user's email address
   * @param {string} password - The user's password
   * @returns {Promise<void>}
   * @throws {FirebaseError} If sending verification email fails
   */
  async resendVerificationEmail(email: string, password: string): Promise<void> {
    const firebaseErrorFactory = getFirebaseErrorFactory(
      "EmailAuthService",
      "resendVerificationEmail",
    );

    let userCredential;
    try {
      userCredential = await firebaseAuth.signInWithEmailAndPassword(email, password);
    } catch (error) {
      throw castToFirebaseError(error, firebaseErrorFactory);
    }

    if (!userCredential.user) {
      throw firebaseErrorFactory(FirebaseErrorCodes.USER_NOT_FOUND, "User not found", {});
    }

    if (userCredential.user.emailVerified) {
      throw firebaseErrorFactory(FirebaseErrorCodes.EMAIL_ALREADY_VERIFIED, "Email already verified", {});
    }

    try {
      await userCredential.user.sendEmailVerification();
    } catch (error) {
      throw castToFirebaseError(error, firebaseErrorFactory);
    }
  }

  /**
   * Send a password reset email to the user.
   * @param {string} email - The user's email address
   * @returns {Promise<void>}
   * @throws {FirebaseError} If sending the reset email fails
   */
  async resetPassword(email: string): Promise<void> {

    const firebaseErrorFactory = getFirebaseErrorFactory(
      "EmailAuthService",
      "resetPassword",
    );

    try {
      await firebaseAuth.sendPasswordResetEmail(email);
    } catch (error) {
      throw castToFirebaseError(error, firebaseErrorFactory);
    }
  }

  /**
   * Checks if a firebase active session/user exists in the local storage. (i.e.: IndexDB)
   *
   * @returns {boolean} True if an active session exists, false otherwise.
   */
  async isProviderSessionValid(): Promise<boolean> {
    return await this.stdFirebaseAuthServiceInstance.isAuthSessionValid()
  }
}

export default FirebaseEmailAuthenticationService;
