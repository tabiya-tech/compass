import { firebaseAuth } from "src/auth/firebaseConfig";
import { getFirebaseErrorFactory } from "src/error/FirebaseError/firebaseError";
import { FirebaseErrorCodes } from "src/error/FirebaseError/firebaseError.constants";
import StdFirebaseAuthenticationService
  from "src/auth/services/FirebaseAuthenticationService/StdFirebaseAuthenticationService";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import { AuthenticationServices, TabiyaUser } from "src/auth/auth.types";
import { invitationsService } from "src/invitations/InvitationsService/invitations.service";
import { InvitationStatus, InvitationType } from "src/invitations/InvitationsService/invitations.types";
import { userPreferencesService } from "src/userPreferences/UserPreferencesService/userPreferences.service";
import { Language } from "src/userPreferences/UserPreferencesService/userPreferences.types";
import { userPreferencesStateService } from "src/userPreferences/UserPreferencesStateService";
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
    let userCredential;
    let invitation;

    invitation = await invitationsService.checkInvitationCodeStatus(code);
    if(invitation.status !== InvitationStatus.VALID) {
      throw firebaseErrorFactory(
        FirebaseErrorCodes.INVALID_INVITATION_CODE,
        "Invalid invitation code"
      )
    }
    if (invitation.invitation_type !== InvitationType.AUTO_REGISTER) {
      throw firebaseErrorFactory(
        FirebaseErrorCodes.INVALID_INVITATION_TYPE,
        "The invitation code is not for login"
      )
    }
    try {
      userCredential = await firebaseAuth.signInAnonymously();
    } catch (error) {
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

    // we set the user state in order to get a decoded version of the token
    this.authenticationStateService.setUser(this.getUser(token));
    const _user =(this.authenticationStateService).getUser();



      if (_user) {
        try {
        // create user preferences for the first time.
        // in order to do this, there needs to be a logged in user in the persistent storage
        const prefs = await userPreferencesService.createUserPreferences({
          user_id: _user.id,
          invitation_code: invitation.invitation_code,
          language: Language.en,
        });
        userPreferencesStateService.setUserPreferences(prefs);
        } catch (err) { // REVIEW after moving this out of the try catch this now become a serviceErrorFactory because that is what createUserPreferences throws
          throw firebaseErrorFactory((err as any).code, (err as any).message);
        }
      } else {
        throw firebaseErrorFactory(
          FirebaseErrorCodes.USER_NOT_FOUND,
          "User could not be extracted from token"
        )
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
