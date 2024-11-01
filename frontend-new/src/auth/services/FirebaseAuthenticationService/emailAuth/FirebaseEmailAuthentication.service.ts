import { firebaseAuth } from "src/auth/firebaseConfig";
import { getFirebaseErrorFactory } from "src/error/FirebaseError/firebaseError";
import { FirebaseErrorCodes } from "src/error/FirebaseError/firebaseError.constants";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import { AuthenticationServices, TabiyaUser } from "src/auth/auth.types";
import { invitationsService } from "src/invitations/InvitationsService/invitations.service";
import { InvitationStatus, InvitationType } from "src/invitations/InvitationsService/invitations.types";
import AuthenticationService from "src/auth/services/Authentication.service";
import StdFirebaseAuthenticationService, {
  FirebaseToken,
  FirebaseTokenProviders,
} from "src/auth/services/FirebaseAuthenticationService/StdFirebaseAuthenticationService";

class FirebaseEmailAuthenticationService extends AuthenticationService {
  private static instance: FirebaseEmailAuthenticationService;
  private stdFirebaseAuthServiceInstance: StdFirebaseAuthenticationService;

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
      "POST",
      "signInWithEmailAndPassword"
    );

    let userCredential;

    try {
      userCredential = await firebaseAuth.signInWithEmailAndPassword(email, password);
    } catch (error) {
      throw firebaseErrorFactory((error as any).code, (error as any).message);
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
        throw firebaseErrorFactory((signOutError as any).code, (signOutError as any).message);
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
  async register(email: string, password: string, username: string, registrationCode: string): Promise<string> {
    const firebaseErrorFactory = getFirebaseErrorFactory(
      "EmailAuthService",
      "handleRegister",
      "POST",
      "createUserWithEmailAndPassword"
    );
    const invitation = await invitationsService.checkInvitationCodeStatus(registrationCode);
    if (invitation.status === InvitationStatus.INVALID) {
      throw firebaseErrorFactory(FirebaseErrorCodes.INVALID_REGISTRATION_CODE, "The registration code is invalid");
    }
    if (invitation.invitation_type !== InvitationType.REGISTER) {
      throw firebaseErrorFactory(
        FirebaseErrorCodes.INVALID_REGISTRATION_TYPE,
        "The invitation code is not for registration"
      );
    }

    let userCredential;

    try {
      userCredential = await firebaseAuth.createUserWithEmailAndPassword(email, password);
    } catch (error) {
      throw firebaseErrorFactory((error as any).code, (error as any).message);
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
      throw firebaseErrorFactory((error as any).code, (error as any).message);
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
    await super.onSuccessfulRegistration(token, invitation.invitation_code);
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
      console.error("Error refreshing token:", error);
      // if token refresh fails, log the user out
      await this.logout();
    }
  }

  /**
   * Get user information from token
   * @param {string} token - The authentication token
   * @returns {TabiyaUser | null} The user information or null if token is invalid
   */
  public getUser(token: string): TabiyaUser | null {
    const { isValid, decodedToken } = this.isTokenValid(token);

    if (!isValid) {
      console.error("Could not get user from token. Token is invalid.");
      return null;
    }
    return this.stdFirebaseAuthServiceInstance.getUserFromDecodedToken(decodedToken!);
  }

  /**
   * Check if the token is a valid email firebase token
   * @param {string} token - The authentication token
   * @returns {boolean} True if the token is valid, false otherwise
   */
  public isTokenValid(token: string): { isValid: boolean; decodedToken: FirebaseToken | null } {
    const { isValid, decodedToken } = super.isTokenValid(token);

    if (!isValid || !this.stdFirebaseAuthServiceInstance.isFirebaseTokenValid(decodedToken as FirebaseToken)) {
      console.debug("token is invalid");
      return { isValid: false, decodedToken: null };
    }
    if ((decodedToken as FirebaseToken).firebase.sign_in_provider !== FirebaseTokenProviders.PASSWORD) {
      console.debug("token is not a valid firebase email token");
      return { isValid: false, decodedToken: null };
    }

    return { isValid: true, decodedToken: decodedToken as FirebaseToken };
  }
}

export default FirebaseEmailAuthenticationService;
