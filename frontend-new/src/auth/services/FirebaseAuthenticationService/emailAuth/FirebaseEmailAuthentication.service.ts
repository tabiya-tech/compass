import { auth } from "src/auth/firebaseConfig";
import { StatusCodes } from "http-status-codes";
import { getFirebaseErrorFactory } from "src/error/FirebaseError/firebaseError";
import { FirebaseErrorCodes } from "src/error/FirebaseError/firebaseError.constants";
import FirebaseAuthenticationService from "src/auth/services/FirebaseAuthenticationService/FirebaseAuthentication.service";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import { AuthenticationServices } from "src/auth/auth.types";
import { invitationsService } from "src/invitations/InvitationsService/invitations.service";
import { InvitationStatus, InvitationType } from "src/invitations/InvitationsService/invitations.types";

class FirebaseEmailAuthenticationService extends FirebaseAuthenticationService {
  private static instance: FirebaseEmailAuthenticationService;

  private constructor() {
    super();
  }
  /**
   * Get the singleton instance of the EmailAuthService.
   * @returns {FirebaseEmailAuthenticationService} The singleton instance of the EmailAuthService.
   */
  static getInstance(): FirebaseEmailAuthenticationService {
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
      userCredential = await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
      throw firebaseErrorFactory(StatusCodes.INTERNAL_SERVER_ERROR, (error as any).code, (error as any).message);
    }

    if (!userCredential.user) {
      throw firebaseErrorFactory(StatusCodes.NOT_FOUND, FirebaseErrorCodes.USER_NOT_FOUND, "User not found", {});
    }

    if (!userCredential.user.emailVerified) {
      // we cant stop firebase from logging the user in when their email is unverified,
      // best we can do is log them out ourselves and then throw an error
      try {
        await this.logout();
      } catch (signOutError) {
        throw firebaseErrorFactory(
          StatusCodes.INTERNAL_SERVER_ERROR,
          (signOutError as any).code,
          (signOutError as any).message
        );
      }
      throw firebaseErrorFactory(
        StatusCodes.FORBIDDEN,
        FirebaseErrorCodes.EMAIL_NOT_VERIFIED,
        "Email not verified",
        {}
      );
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
   * Handle user registration with email, password, and name.
   * @param {string} email - The user's email address.
   * @param {string} password - The user's password.
   * @param {string} name - The user's name.
   * @param registrationCode - The registration code.
   * @returns {Promise<string>} - The firebase token.
   */
  // REVIEW name -> username as opposed to name=lastname, firstname?
  async register(email: string, password: string, name: string, registrationCode: string): Promise<string> {
    const firebaseErrorFactory = getFirebaseErrorFactory(
      "EmailAuthService",
      "handleRegister",
      "POST",
      "createUserWithEmailAndPassword"
    );
    const invitation = await invitationsService.checkInvitationCodeStatus(registrationCode);
    if (invitation.status === InvitationStatus.INVALID || invitation.invitation_type !== InvitationType.REGISTER) {
      console.log(invitation) // REVIEW remove this
      throw new Error("Invalid invitation code"); // REVIEW (1) should be invalid registration code,
                                                  //  (2) perhaps even a differentiation between the two conditions to give a better error message
                                                  //  (not a registration code vs invalid)
                                                  //  (3) shouldn't this be a firebaseErrorFactory?
    }

    let userCredential;

    try {
      userCredential = await auth.createUserWithEmailAndPassword(email, password);
    } catch (error) {
      throw firebaseErrorFactory(StatusCodes.INTERNAL_SERVER_ERROR, (error as any).code, (error as any).message);
    }

    if (!userCredential.user) {
      throw firebaseErrorFactory(StatusCodes.NOT_FOUND, FirebaseErrorCodes.USER_NOT_FOUND, "User not found", {});
    }

    try {
      // update the user's display name
      await userCredential.user.updateProfile({
        displayName: name,
      });
      // send a verification email
      await userCredential.user.sendEmailVerification();
    } catch (error) {
      throw firebaseErrorFactory(StatusCodes.INTERNAL_SERVER_ERROR, (error as any).code, (error as any).message);
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
}

export default FirebaseEmailAuthenticationService;
