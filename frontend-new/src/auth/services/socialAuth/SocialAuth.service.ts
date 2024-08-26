import { auth } from "src/auth/firebaseConfig";
import { AuthService, AuthServices } from "src/auth/auth.types";
import { StatusCodes } from "http-status-codes";
import { FirebaseError, getFirebaseErrorFactory } from "src/error/FirebaseError/firebaseError";
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
   * @param {(data: string) => void} successCallback - Callback to execute on successful login.
   * @param {(error: any) => void} failureCallback - Callback to execute on login error.
   */
  async handleLoginWithGoogle(
    successCallback: (data: string) => void,
    failureCallback: (error: FirebaseError) => void
  ): Promise<void> {
    const errorFactory = getFirebaseErrorFactory(
      "SocialAuthService",
      "handleLoginWithGoogle",
      "POST",
      "signInWithPopup"
    );
    try {
      const data = await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
      // @ts-ignore
      if (!data?.user?.multiFactor?.user?.accessToken) {
        failureCallback(
          errorFactory(StatusCodes.NOT_FOUND, FirebaseErrorCodes.USER_NOT_FOUND, "The user could not be found", {})
        );
        return;
      }
      // @ts-ignore
      const tokenResponse = data.user.multiFactor.user.accessToken as string;
      // set the login method to social for future reference
      // we'll want to know how the user logged in, when we want to log them out for example
      PersistentStorageService.setLoginMethod(AuthServices.SOCIAL);
      successCallback(tokenResponse);
    } catch (error) {
      const firebaseError = (error as any).code;
      failureCallback(
        errorFactory(
          firebaseError?.statusCode || StatusCodes.INTERNAL_SERVER_ERROR,
          firebaseError || FirebaseErrorCodes.INTERNAL_ERROR,
          firebaseError?.message || FirebaseErrorCodes.INTERNAL_ERROR,
          {}
        )
      );
    }
  }
}

export const socialAuthService = SocialAuthService.getInstance();
