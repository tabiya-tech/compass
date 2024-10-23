import { firebaseAuth } from "src/auth/firebaseConfig";
import { getFirebaseErrorFactory } from "src/error/FirebaseError/firebaseError";
import { FirebaseErrorCodes } from "src/error/FirebaseError/firebaseError.constants";
import firebase from "firebase/compat/app";
import StdFirebaseAuthenticationService from "src/auth/services/FirebaseAuthenticationService/StdFirebaseAuthenticationService";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import { AuthenticationServices, TabiyaUser } from "src/auth/auth.types";
import AuthenticationService from "src/auth/services/Authentication.service";

class FirebaseSocialAuthenticationService extends AuthenticationService {
  private static instance: FirebaseSocialAuthenticationService;
  private static stdFirebaseAuthServiceInstance: StdFirebaseAuthenticationService;

  private constructor() {
    super();
  }

  static async getInstance(): Promise<FirebaseSocialAuthenticationService> {
    this.stdFirebaseAuthServiceInstance = await StdFirebaseAuthenticationService.getInstance();
    if (!FirebaseSocialAuthenticationService.instance) {
      FirebaseSocialAuthenticationService.instance = new FirebaseSocialAuthenticationService();
    }
    return FirebaseSocialAuthenticationService.instance;
  }

  /**
   * Handle login with google popup.
   * @returns {Promise<string>} - The firebase token.
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
      //  qREVIEW do not throw to catch
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

  async cleanup(): Promise<void> {
    FirebaseSocialAuthenticationService.stdFirebaseAuthServiceInstance.cleanup();
  }

  async logout(): Promise<void> {
    await FirebaseSocialAuthenticationService.stdFirebaseAuthServiceInstance.logout();
    // call the parent class method once the user is successfully logged out (or even if it fails)
    await super.onSuccessfulLogout();
  }

  async refreshToken(): Promise<void> {
    try {
      const newToken = await FirebaseSocialAuthenticationService.stdFirebaseAuthServiceInstance.refreshToken();
      // call the parent class method once the token is successfully refreshed
      await super.onSuccessfulRefresh(newToken);
    } catch (error) {
      console.error("Error refreshing token:", error);
      // if token refresh fails, log the user out
      await this.logout();
    }
  }

  getUser(token: string): TabiyaUser | null {
    if (!this.isTokenValid(token)) {
      console.error("Could not get user from token. Token is invalid.");
      return null;
    }
    return FirebaseSocialAuthenticationService.stdFirebaseAuthServiceInstance.getUser(token);
  }
}

export default FirebaseSocialAuthenticationService;
