import { auth } from "src/auth/firebaseConfig";
import { StatusCodes } from "http-status-codes";
import { getFirebaseErrorFactory } from "src/error/FirebaseError/firebaseError";
import { FirebaseErrorCodes } from "src/error/FirebaseError/firebaseError.constants";
import StdFirebaseAuthenticationService from "src/auth/services/FirebaseAuthenticationService/StdFirebaseAuthenticationService";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import { AuthenticationServices, TabiyaUser } from "src/auth/auth.types";
import { invitationsService } from "src/invitations/InvitationsService/invitations.service";
import { InvitationStatus, InvitationType } from "src/invitations/InvitationsService/invitations.types";
import { userPreferencesService } from "src/userPreferences/UserPreferencesService/userPreferences.service";
import { Language } from "src/userPreferences/UserPreferencesService/userPreferences.types";
import { userPreferencesStateService } from "src/userPreferences/UserPreferencesStateService";
import { getServiceErrorFactory } from "src/error/ServiceError/ServiceError";
import serviceErrorConstants from "src/error/ServiceError/ServiceError.constants";
import AuthenticationService from "src/auth/services/Authentication.service";

class FirebaseInvitationCodeAuthenticationService extends AuthenticationService {
  private static instance: FirebaseInvitationCodeAuthenticationService;
  private static stdFirebaseAuthServiceInstance: StdFirebaseAuthenticationService;

  private constructor() {
    super();
  }

  /**
   * Get the singleton instance of the InvitationCodeAuthService.
   * @returns {FirebaseInvitationCodeAuthenticationService} The singleton instance of the InvitationCodeAuthService.
   */
  static async getInstance(): Promise<FirebaseInvitationCodeAuthenticationService> {
    this.stdFirebaseAuthServiceInstance = await StdFirebaseAuthenticationService.getInstance()
    if (!FirebaseInvitationCodeAuthenticationService.instance) {
      FirebaseInvitationCodeAuthenticationService.instance = new FirebaseInvitationCodeAuthenticationService();
    }
    return FirebaseInvitationCodeAuthenticationService.instance;
  }

  /**
   * handle anonymous login
   * @param {string} code - The invitation code to login with
   * @returns {Promise<string>} The firebase token
   */
  async login(code: string): Promise<string> {
    const firebaseErrorFactory = getFirebaseErrorFactory(
      "InvitationCodeAuthService",
      "handleInvitationCodeLogin",
      "POST",
      "signInAnonymously"
    );
    const serviceErrorFactory = getServiceErrorFactory(
      "InvitationCodeAuthService",
      "handleInvitationCodeLogin",
      "POST",
      "signInAnonymously"
    )
    let userCredential;
    let invitation;
    try {
      // first check if the invitation code is valid
      invitation = await invitationsService.checkInvitationCodeStatus(code);
      if (
        invitation.status !== InvitationStatus.VALID ||
        invitation.invitation_type !== InvitationType.AUTO_REGISTER
      ) {
      // REVIEW (1) perhaps even a differentiation between the two conditions to give a better error message
      //  (not a registration code vs invalid)
      //  (2) this is a misuse of serviceErrorFactory(), serviceErrorFactory is a convenient way to handle backend errors
      //  this is a frontend error, and it artificially constructs an error as if a HTTP response return a FORBIDDEN.
      //  this is deceiving because it implies that the API return that but it did not!
      //  this should simply be a  firebaseErrorFactory with  INVALID_INVITATION_CODE nothing else
      // additionally why throw and catch put this in a separate try catch
        throw serviceErrorFactory(
          StatusCodes.FORBIDDEN,
          serviceErrorConstants.ErrorCodes.INVALID_INVITATION_CODE,
          "Invalid invitation code"
        )
      }
      userCredential = await auth.signInAnonymously();
    } catch (error: unknown) {
      console.log("error", error); // REVIEW remove this
      throw firebaseErrorFactory((error as any).code, (error as any).message);
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

    try {
      // we set the user state in order to get a decoded version of the token
        this.authenticationStateService.setUser(await this.getUser(token));
        const _user =(this.authenticationStateService).getUser();
      if (_user) {
        // create user preferences for the first time.
        // in order to do this, there needs to be a logged in user in the persistent storage
        const prefs = await userPreferencesService.createUserPreferences({
          user_id: _user.id,
          invitation_code: invitation.invitation_code,
          language: Language.en,
        });
        userPreferencesStateService.setUserPreferences(prefs);
      } else {
        // REVIEW do not throw and catch, and do not misuse the serviceErrorFactory!
        //  move this error out of the try catch
        throw serviceErrorFactory(
          StatusCodes.NOT_FOUND,
          serviceErrorConstants.ErrorCodes.NOT_FOUND,
          "User could not be extracted from token"
        )
      }
    } catch (err) { // REVIEW after moving this out of the try catch this now become a serviceErrorFactory because that is what createUserPreferences throws
      throw firebaseErrorFactory((err as any).code, (err as any).message);
    }
    // call the parent class method once the user is successfully logged in
    await super.onSuccessfulLogin(token)
    return token;
  }

  async cleanup(): Promise<void> {
    FirebaseInvitationCodeAuthenticationService.stdFirebaseAuthServiceInstance.cleanup();
  }

  async logout(): Promise<void> {
    await FirebaseInvitationCodeAuthenticationService.stdFirebaseAuthServiceInstance.logout();
    // call the parent class method once the user is successfully logged out (or even if it fails)
    await super.onSuccessfulLogout();
  }

  async refreshToken(): Promise<void> {
    try{
      const newToken = await FirebaseInvitationCodeAuthenticationService.stdFirebaseAuthServiceInstance.refreshToken();
      // call the parent class method once the token is successfully refreshed
      await super.onSuccessfulRefresh(newToken);
    } catch (error) {
      console.error("Error refreshing token:", error);
      // if token refresh fails, log the user out
      await this.logout();
    }
  }

  getUser(token: string): TabiyaUser | null {
    if(!this.isTokenValid(token)) {
      console.error("Could not get user from token. Token is invalid.")
      return null;
    }
    return FirebaseInvitationCodeAuthenticationService.stdFirebaseAuthServiceInstance.getUser(token);
  }
}

export default FirebaseInvitationCodeAuthenticationService;
