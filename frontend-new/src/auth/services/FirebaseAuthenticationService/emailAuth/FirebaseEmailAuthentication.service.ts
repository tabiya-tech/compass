import { firebaseAuth } from "src/auth/firebaseConfig";
import { getFirebaseErrorFactory } from "src/error/FirebaseError/firebaseError";
import { FirebaseErrorCodes } from "src/error/FirebaseError/firebaseError.constants";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import { AuthenticationServices, TabiyaUser } from "src/auth/auth.types";
import { invitationsService } from "src/invitations/InvitationsService/invitations.service";
import { InvitationStatus, InvitationType } from "src/invitations/InvitationsService/invitations.types";
import AuthenticationService from "src/auth/services/Authentication.service";
import StdFirebaseAuthenticationService from "src/auth/services/FirebaseAuthenticationService/StdFirebaseAuthenticationService";

class FirebaseEmailAuthenticationService extends AuthenticationService {
  private static instance: FirebaseEmailAuthenticationService;
  private static stdFirebaseAuthServiceInstance: StdFirebaseAuthenticationService;

  private constructor() {
    super();
  }
  /**
   * Get the singleton instance of the EmailAuthService.
   * @returns {FirebaseEmailAuthenticationService} The singleton instance of the EmailAuthService.
   */
  static async getInstance(): Promise<FirebaseEmailAuthenticationService> {
    this.stdFirebaseAuthServiceInstance = await StdFirebaseAuthenticationService.getInstance();
    await StdFirebaseAuthenticationService.getInstance();
    if (!FirebaseEmailAuthenticationService.instance) {
      FirebaseEmailAuthenticationService.instance = new FirebaseEmailAuthenticationService();
    }
    return FirebaseEmailAuthenticationService.instance;
  }

  /**
   * Handle user login with email and password.
   * @param {string} email - The user's email address.
   * @param {string} password - The user's password.
   * @returns {Promise<string>} - The firebase token.
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
   * @param registrationCode - The registration code.
   * @returns {Promise<string>} - The firebase token.
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

  async cleanup(): Promise<void> {
    FirebaseEmailAuthenticationService.stdFirebaseAuthServiceInstance.cleanup();
  }

  async logout(): Promise<void> {
    try {
      await FirebaseEmailAuthenticationService.stdFirebaseAuthServiceInstance.logout();
    } catch (e) {
      throw e; // rethrow the error if logout fails so that calling code can handle it
    } finally {
      // call the parent class method once the user is successfully logged out (or even if it fails)
      await super.onSuccessfulLogout();
    }
  }

  async refreshToken(): Promise<void> {
    try {
      const newToken = await FirebaseEmailAuthenticationService.stdFirebaseAuthServiceInstance.refreshToken();
      // call the parent class method once the token is successfully refreshed
      await super.onSuccessfulRefresh(newToken);
    } catch (error) {
      console.error("Error refreshing token:", error);
      // if token refresh fails, log the user out
      await this.logout();
    }
  }

  public getUser(token: string): TabiyaUser | null {
    if (!this.isTokenValid(token)) {
      console.error("Could not get user from token. Token is invalid.");
      return null;
    }
    return FirebaseEmailAuthenticationService.stdFirebaseAuthServiceInstance.getUser(token);
  }
}

export default FirebaseEmailAuthenticationService;
