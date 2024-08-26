import { auth } from "src/auth/firebaseConfig";
import { AuthService, AuthServices } from "src/auth/auth.types";
import { StatusCodes } from "http-status-codes";
import { getFirebaseErrorFactory } from "src/error/FirebaseError/firebaseError";
import { FirebaseErrorCodes } from "src/error/FirebaseError/firebaseError.constants";
import firebase from "firebase/compat/app";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";

export class SocialAuthService implements AuthService {
  private constructor() {}

  static getInstance(): SocialAuthService {
    return new SocialAuthService();
  }

  /**
   * Handle user logout.
   * @returns {Promise<void>}
   */
  async handleLogout(): Promise<void> {
    const errorFactory = getFirebaseErrorFactory("SocialAuthService", "handleLogout", "POST", "signOut");
    try {
      await auth.signOut();
    } catch (error) {
      const firebaseError = (error as any).code;
      throw errorFactory(
          firebaseError.statusCode || StatusCodes.INTERNAL_SERVER_ERROR,
          firebaseError || FirebaseErrorCodes.INTERNAL_ERROR,
          firebaseError.message || FirebaseErrorCodes.INTERNAL_ERROR,
          {}
      );
    }
  }

  /**
   * Handle login with google popup.
   * @returns {Promise<string>} - The firebase token.
   */
  async handleLoginWithGoogle(): Promise<string> {
    const firebaseErrorFactory = getFirebaseErrorFactory(
      "SocialAuthService",
      "handleLoginWithGoogle",
      "POST",
      "signInWithPopup"
    );

    let userCredential;

    try {
      userCredential = await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
    } catch (error) {
      throw firebaseErrorFactory(StatusCodes.INTERNAL_SERVER_ERROR, (error as any).code, (error as any).message);
    }

    // @ts-ignore
    if (!userCredential?.user?.multiFactor?.user?.accessToken) {
      throw firebaseErrorFactory(StatusCodes.NOT_FOUND, FirebaseErrorCodes.USER_NOT_FOUND, "The user could not be found", {})
    }

    // @ts-ignore
    const tokenResponse = userCredential.user.multiFactor.user.accessToken as string;
    // set the login method to social for future reference
    // we'll want to know how the user logged in, when we want to log them out for example
    PersistentStorageService.setLoginMethod(AuthServices.SOCIAL);
    return tokenResponse;
  }
}

export const socialAuthService = SocialAuthService.getInstance();
