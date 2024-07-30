import { auth } from "src/auth/firebaseConfig";
import { TFirebaseTokenResponse } from "src/auth/auth.types";
import { getServiceErrorFactory, FIREBASE_ERROR_MESSAGES } from "src/error/error";
import { StatusCodes } from "http-status-codes";
import ErrorConstants from "src/error/error.constants";

export class AuthService {
  private static instance: AuthService;

  private constructor() {}

  /**
   * Get the singleton instance of the AuthService.
   * @returns {AuthService} The singleton instance of the AuthService.
   */
  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Handle user logout.
   * @param {() => void} successCallback - Callback to execute on successful logout.
   * @param {(error: any) => void} errorCallback - Callback to execute on logout error.
   */
  async handleLogout(successCallback: () => void, errorCallback: (error: any) => void): Promise<void> {
    const errorFactory = getServiceErrorFactory("AuthService", "handleLogout", "POST", "signOut");
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
   * Handle user login with email and password.
   * @param {string} email - The user's email address.
   * @param {string} password - The user's password.
   * @param {(data: TFirebaseTokenResponse) => void} successCallback - Callback to execute on successful login.
   * @param {(error: any) => void} errorCallback - Callback to execute on login error.
   * @returns {Promise<TFirebaseTokenResponse | undefined>} The login response, or undefined if there was an error.
   */
  async handleLoginWithEmail(
    email: string,
    password: string,
    successCallback: (data: TFirebaseTokenResponse) => void,
    errorCallback: (error: any) => void
  ): Promise<TFirebaseTokenResponse | undefined> {
    const errorFactory = getServiceErrorFactory("AuthService", "handleLogin", "POST", "signInWithEmailAndPassword");
    try {
      const userCredential = await auth.signInWithEmailAndPassword(email, password);
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
      if (!userCredential.user.emailVerified) {
        errorCallback(
          errorFactory(
            StatusCodes.FORBIDDEN,
            ErrorConstants.FirebaseErrorCodes.EMAIL_NOT_VERIFIED,
            FIREBASE_ERROR_MESSAGES[ErrorConstants.FirebaseErrorCodes.EMAIL_NOT_VERIFIED],
            {}
          )
        );
        return;
      }

      const data = {
        access_token: await userCredential.user.getIdToken(),
        expires_in: 3600,
      };
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

  /**
   * Handle user registration with email, password, and name.
   * @param {string} email - The user's email address.
   * @param {string} password - The user's password.
   * @param {string} name - The user's name.
   * @param {(data: TFirebaseTokenResponse) => void} successCallback - Callback to execute on successful registration.
   * @param {(error: any) => void} errorCallback - Callback to execute on registration error.
   * @returns {Promise<TFirebaseTokenResponse | undefined>} The registration response, or undefined if there was an error.
   */
  async handleRegisterWithEmail(
    email: string,
    password: string,
    name: string,
    successCallback: (data: TFirebaseTokenResponse) => void,
    errorCallback: (error: any) => void
  ): Promise<TFirebaseTokenResponse | undefined> {
    const errorFactory = getServiceErrorFactory(
      "AuthService",
      "handleRegister",
      "POST",
      "createUserWithEmailAndPassword"
    );
    try {
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
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
      await userCredential.user.updateProfile({
        displayName: name,
      });
      await userCredential.user.sendEmailVerification();
      await auth.signOut();
      const data = {
        access_token: await userCredential.user.getIdToken(),
        expires_in: 3600,
      };
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

export const authService = AuthService.getInstance();
