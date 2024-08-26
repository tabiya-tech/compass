import { auth } from "src/auth/firebaseConfig";
import { AuthService, AuthServices } from "src/auth/auth.types";
import { StatusCodes } from "http-status-codes";
import { FirebaseError, getFirebaseErrorFactory } from "src/error/FirebaseError/firebaseError";
import { FirebaseErrorCodes } from "src/error/FirebaseError/firebaseError.constants";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";

export class EmailAuthService implements AuthService {
  private static instance: EmailAuthService;

  private constructor() {}

  /**
   * Get the singleton instance of the EmailAuthService.
   * @returns {EmailAuthService} The singleton instance of the EmailAuthService.
   */
  static getInstance(): EmailAuthService {
    if (!EmailAuthService.instance) {
      EmailAuthService.instance = new EmailAuthService();
    }
    return EmailAuthService.instance;
  }

  /**
   * Handle user logout.
   * @returns {Promise<void>}
   */
  async handleLogout(): Promise<void> {
    const errorFactory = getFirebaseErrorFactory("EmailAuthService", "handleLogout", "POST", "signOut");
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
   * Handle user login with email and password.
   * @param {string} email - The user's email address.
   * @param {string} password - The user's password.
   * @param {(data: TFirebaseAccessToken) => void} successCallback - Callback to execute on successful login.
   * @param {(error: any) => void} failureCallback - Callback to execute on login error.
   * @returns {Promise<void>}
   */
  async handleLoginWithEmail(
    email: string,
    password: string,
    successCallback: (data: string) => void,
    failureCallback: (error: FirebaseError) => void
  ): Promise<void> {
    const errorFactory = getFirebaseErrorFactory(
      "EmailAuthService",
      "handleLogin",
      "POST",
      "signInWithEmailAndPassword"
    );
    try {
      const userCredential = await auth.signInWithEmailAndPassword(email, password);
      if (!userCredential.user) {
        failureCallback(errorFactory(StatusCodes.NOT_FOUND, FirebaseErrorCodes.USER_NOT_FOUND, "User not found", {}));
        return;
      }
      if (!userCredential.user.emailVerified) {
        failureCallback(
          errorFactory(StatusCodes.FORBIDDEN, FirebaseErrorCodes.EMAIL_NOT_VERIFIED, "Email not verified", {})
        );
        return;
      }

      // in the case of email login, firebase doesnt give us a way to access the access token directly
      // but we can use the getIdToken method to get the id token, which will be identical to the access token
      const token = await userCredential.user.getIdToken();
      // set the login method to email for future reference
      // we'll want to know how the user logged in, when we want to log them out for example
      PersistentStorageService.setLoginMethod(AuthServices.EMAIL);
      successCallback(token);
    } catch (error) {
      const firebaseError = (error as any).code;

      failureCallback(
        errorFactory(
          firebaseError.statusCode || StatusCodes.INTERNAL_SERVER_ERROR,
          firebaseError || FirebaseErrorCodes.INTERNAL_ERROR,
          firebaseError.message || FirebaseErrorCodes.INTERNAL_ERROR,
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
   * @param {(data: TFirebaseAccessToken) => void} successCallback - Callback to execute on successful registration.
   * @param {(error: any) => void} failureCallback - Callback to execute on registration error.
   * @returns {Promise<TFirebaseAccessToken | undefined>} The registration response, or undefined if there was an error.
   */
  async handleRegisterWithEmail(
    email: string,
    password: string,
    name: string,
    successCallback: (token: string) => void,
    failureCallback: (error: FirebaseError) => void
  ): Promise<void> {
    const errorFactory = getFirebaseErrorFactory(
      "EmailAuthService",
      "handleRegister",
      "POST",
      "createUserWithEmailAndPassword"
    );
    try {
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      if (!userCredential.user) {
        failureCallback(errorFactory(StatusCodes.NOT_FOUND, FirebaseErrorCodes.USER_NOT_FOUND, "User not found", {}));
        return;
      }
      await userCredential.user.updateProfile({
        displayName: name,
      });
      await userCredential.user.sendEmailVerification();
      // return the user object
      // in the case of email login, firebase doesnt give us a way to access the access token directly
      // but we can use the getIdToken method to get the id token, which will be identical to the access token
      const token = await userCredential.user.getIdToken();
      // set the login method to email for future reference
      // we'll want to know how the user logged in, when we want to log them out for example
      PersistentStorageService.setLoginMethod(AuthServices.EMAIL);

      //Note: when you register a user on firebase, they are automatically logged in
      // typically we would sign the user out immediately after registration
      // however we need to keep the user logged in to create user preferences
      // so once the preferences are created we will log the user out
      successCallback(token);
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

export const emailAuthService = EmailAuthService.getInstance();
