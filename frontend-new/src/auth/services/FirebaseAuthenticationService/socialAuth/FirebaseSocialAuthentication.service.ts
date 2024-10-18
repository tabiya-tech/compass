import { auth } from "src/auth/firebaseConfig";
import { StatusCodes } from "http-status-codes";
import { getFirebaseErrorFactory } from "src/error/FirebaseError/firebaseError";
import { FirebaseErrorCodes } from "src/error/FirebaseError/firebaseError.constants";
import firebase from "firebase/compat/app";
import FirebaseAuthenticationService from "src/auth/services/FirebaseAuthenticationService/FirebaseAuthentication.service";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import { AuthenticationServices } from "src/auth/auth.types";

class FirebaseSocialAuthenticationService extends FirebaseAuthenticationService {
  static getInstance(): FirebaseSocialAuthenticationService {
    return new FirebaseSocialAuthenticationService();
  }

  private constructor() {
    super();
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
      userCredential = await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());

      // @ts-expect-error - we know that the userCredential is not null
      if (!userCredential?.user?.multiFactor?.user?.accessToken) {
        throw firebaseErrorFactory(
          StatusCodes.NOT_FOUND,
          FirebaseErrorCodes.USER_NOT_FOUND,
          "The user could not be found",
          {}
        );
      }

      // @ts-ignore
      const tokenResponse = userCredential.user.multiFactor.user.accessToken as string;
      // set the login method to social for future reference
      // we'll want to know how the user logged in, when we want to log them out for example
      PersistentStorageService.setLoginMethod(AuthenticationServices.FIREBASE_SOCIAL);

      // call the parent class method once the user is successfully logged in
      await super.onSuccessfulLogin(tokenResponse);
      return tokenResponse;

    } catch (error) {
      throw firebaseErrorFactory(StatusCodes.INTERNAL_SERVER_ERROR, (error as any).code, (error as any).message);
    }
  }
}

export default FirebaseSocialAuthenticationService;
