import { auth } from "src/auth/firebaseConfig";
import { TFirebaseTokenResponse } from "src/auth/auth.types";
import { getServiceErrorFactory, FIREBASE_ERROR_MESSAGES } from "src/error/error";
import { StatusCodes } from "http-status-codes";
import ErrorConstants from "src/error/error.constants";

export class AnonymousAuthService {
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
   * @param {() => void} successCallback - Callback to execute on successful logout.
   * @param {(error: any) => void} errorCallback - Callback to execute on logout error.
   */
  async handleLogout(successCallback: () => void, errorCallback: (error: any) => void): Promise<void> {
    const errorFactory = getServiceErrorFactory("AnonymousAuthService", "handleLogout", "POST", "signOut");
    try {
      await auth.signOut();
      successCallback();
    } catch (error) {
      const firebaseError = (error as any).code;
      //@ts-ignore
      const errorMessage = FIREBASE_ERROR_MESSAGES[firebaseError] || (error as Error).message;
      errorCallback(
        errorFactory(
          StatusCodes.INTERNAL_SERVER_ERROR,
          firebaseError || ErrorConstants.ErrorCodes.FAILED_TO_FETCH,
          errorMessage,
          {}
        )
      );
    }
  }

  /**
   * handle anonymous login
   * @param {(data: TFirebaseTokenResponse) => void} successCallback - Callback to execute on successful login.
   * @param {(error: any) => void} errorCallback - Callback to execute on login error.
   * @returns {Promise<TFirebaseTokenResponse | undefined>} The login response, or undefined if there was an error.
   */
  async handleAnonymousLogin(
    successCallback: (data: TFirebaseTokenResponse) => void,
    errorCallback: (error: any) => void
  ): Promise<TFirebaseTokenResponse | undefined> {
    const errorFactory = getServiceErrorFactory(
      "AnonymousAuthService",
      "handleAnonymousLogin",
      "POST",
      "signInAnonymously"
    );
    try {
      const userCredential = await auth.signInAnonymously();
      if (!userCredential.user) {
        errorCallback(
          errorFactory(
            StatusCodes.NOT_FOUND,
            ErrorConstants.FirebaseErrorCodes.USER_NOT_FOUND,
            FIREBASE_ERROR_MESSAGES[ErrorConstants.FirebaseErrorCodes.USER_NOT_FOUND],
            {}
          )
        );
        return;
      }
      const data = {
        access_token: await userCredential.user.getIdToken(),
        expires_in: 3600,
      };
      console.log("Anonymous login successful", data);
      successCallback(data);
      return data;
    } catch (error) {
      const firebaseError = (error as any).code;
      //@ts-ignore
      const errorMessage = FIREBASE_ERROR_MESSAGES[firebaseError] || (error as Error).message;
      errorCallback(
        errorFactory(
          StatusCodes.INTERNAL_SERVER_ERROR,
          firebaseError || ErrorConstants.ErrorCodes.FAILED_TO_FETCH,
          errorMessage,
          {}
        )
      );
    }
  }
}

export const anonymousAuthService = AnonymousAuthService.getInstance();
