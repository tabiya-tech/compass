import { auth } from "src/auth/firebaseConfig";
import { AuthService, AuthServices } from "src/auth/auth.types";
import { StatusCodes } from "http-status-codes";
import { FirebaseError, getFirebaseErrorFactory } from "src/error/FirebaseError/firebaseError";
import { FirebaseErrorCodes } from "src/error/FirebaseError/firebaseError.constants";
import firebase from "firebase/compat/app";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import { getServiceErrorFactory, ServiceError } from "../../../error/ServiceError/ServiceError";

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
    const errorFactory = getServiceErrorFactory(
      "SocialAuthService",
      "handleLoginWithGoogle",
      "POST",
      "signInWithPopup"
    );
    const firebaseErrorFactory = getFirebaseErrorFactory(
      "SocialAuthService",
      "handleLoginWithGoogle",
      "POST",
      "signInWithPopup"
    );
    try {
      const data = await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
      // @ts-ignore
      if (!data?.user?.multiFactor?.user?.accessToken) {
        throw errorFactory(StatusCodes.NOT_FOUND, FirebaseErrorCodes.USER_NOT_FOUND, "The user could not be found", {})
      }
      // @ts-ignore
      const tokenResponse = data.user.multiFactor.user.accessToken as string;
      // set the login method to social for future reference
      // we'll want to know how the user logged in, when we want to log them out for example
      PersistentStorageService.setLoginMethod(AuthServices.SOCIAL);
      return tokenResponse;
    } catch (error) {
      if(Object.values(FirebaseErrorCodes).includes((error as any).code)) {
        throw firebaseErrorFactory(StatusCodes.INTERNAL_SERVER_ERROR, (error as any).code, (error as any).message);
      }
      else if (error instanceof FirebaseError) {
        throw error; // rethrow the error if it is a FirebaseError
      } else if (error instanceof ServiceError) {
        throw error; // rethrow the error if it is a ServiceError
      }
      throw errorFactory(
        StatusCodes.INTERNAL_SERVER_ERROR,
        FirebaseErrorCodes.INTERNAL_ERROR,
        FirebaseErrorCodes.INTERNAL_ERROR,
        {}
      );
    }
  }
}

export const socialAuthService = SocialAuthService.getInstance();
