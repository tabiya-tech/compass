import { auth } from "src/auth/firebaseConfig";
import { AuthService, AuthServices } from "src/auth/auth.types";
import { getServiceErrorFactory, ServiceError } from "src/error/ServiceError/ServiceError";
import { StatusCodes } from "http-status-codes";
import { FirebaseError, getFirebaseErrorFactory } from "src/error/FirebaseError/firebaseError";
import { FirebaseErrorCodes } from "src/error/FirebaseError/firebaseError.constants";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";

export class AnonymousAuthService implements AuthService {
  private static instance: AnonymousAuthService;

  private constructor() {}

  /**
   * Get the singleton instance of the AnonymousAuthService.
   * @returns {AnonymousAuthService} The singleton instance of the AnonymousAuthService.
   */
  static getInstance(): AnonymousAuthService {
    if (!AnonymousAuthService.instance) {
      AnonymousAuthService.instance = new AnonymousAuthService();
    }
    return AnonymousAuthService.instance;
  }

  /**
   * Handle user logout.
   * @returns {Promise<void>}
   */
  async handleLogout(): Promise<void> {
    const errorFactory = getServiceErrorFactory("AnonymousAuthService", "handleLogout", "POST", "signOut");
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
   * handle anonymous login
   * @returns {Promise<string>} The firebase token
   */
  async handleAnonymousLogin(
  ): Promise<string> {
    const errorFactory = getFirebaseErrorFactory(
      "AnonymousAuthService",
      "handleAnonymousLogin",
      "POST",
      "signInAnonymously"
    );
    const firebaseErrorFactory = getFirebaseErrorFactory(
      "AnonymousAuthService",
      "handleAnonymousLogin",
      "POST",
      "signInAnonymously"
    );
    try {
      const userCredential = await auth.signInAnonymously();
      if (!userCredential.user) {
        throw errorFactory(StatusCodes.NOT_FOUND, FirebaseErrorCodes.USER_NOT_FOUND, "User not found", {});
      }
      // in the case of anonymous login, firebase doesnt give us a way to access the access token directly
      // but we can use the getIdToken method to get the id token, which will be identical to the access token
      const token = await userCredential.user.getIdToken();
      // set the login method to anonymous for future reference
      // we'll want to know how the user logged in, when we want to log them out for example
      PersistentStorageService.setLoginMethod(AuthServices.ANONYMOUS);
      return token;
    } catch (error: unknown) {
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

export const anonymousAuthService = AnonymousAuthService.getInstance();
