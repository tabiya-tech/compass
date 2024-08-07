import { auth } from "src/auth/firebaseConfig";
import { AuthService, AuthServices } from "src/auth/auth.types";
import { StatusCodes } from "http-status-codes";
import { FirebaseError, getFirebaseErrorFactory } from "src/error/FirebaseError/firebaseError";
import { FirebaseErrorCodes } from "src/error/FirebaseError/firebaseError.constants";
import firebase from "firebase/compat/app";
import React from "react";
import * as firebaseui from "firebaseui";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";

export class SocialAuthService implements AuthService {
  private firebaseUiWidget: firebaseui.auth.AuthUI;

  private constructor() {
    this.firebaseUiWidget = firebaseui.auth.AuthUI.getInstance() || new firebaseui.auth.AuthUI(auth);
  }

  static getInstance(): SocialAuthService {
    return new SocialAuthService();
  }

  /**
   * Handle user logout.
   * @param {() => void} successCallback - Callback to execute on successful logout.
   * @param {(error: any) => void} failureCallback - Callback to execute on logout error.
   */
  async handleLogout(successCallback: () => void, failureCallback: (error: FirebaseError) => void): Promise<void> {
    const errorFactory = getFirebaseErrorFactory("SocialAuthService", "handleLogout", "POST", "signOut");
    try {
      await auth.signOut();
      successCallback();
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
   * Initialize the Firebase UI on the given element.
   * @param firebaseUIElementRef
   * @param successCallback
   * @param failureCallback
   */

  async initializeFirebaseUI(
    firebaseUIElementRef: React.RefObject<HTMLDivElement>,
    successCallback: (data: string) => void,
    failureCallback: (error: FirebaseError) => void
  ): Promise<void> {
    const errorFactory = getFirebaseErrorFactory("IDPAuthService", "initializeUI", "POST", "signInWithPopup");
    const uiConfig = {
      signInFlow: "popup", // 'redirect', if you do not want to use popup
      signInOptions: [firebase.auth.GoogleAuthProvider.PROVIDER_ID],
      callbacks: {
        signInSuccessWithAuthResult: (data: any) => {
          if (data?.user?.multiFactor?.user?.accessToken) {
            const tokenResponse = data.user.multiFactor.user.accessToken as string;
            // set the login method to social for future reference
            // we'll want to know how the user logged in, when we want to log them out for example
            PersistentStorageService.setLoginMethod(AuthServices.SOCIAL);
            successCallback(tokenResponse);
            return false;
          } else {
            failureCallback(
              errorFactory(StatusCodes.NOT_FOUND, FirebaseErrorCodes.USER_NOT_FOUND, "The user could not be found", {})
            );
          }
          return false;
        },
        signInFailure: (error: { message: string }) => {
          failureCallback(
            errorFactory(
              StatusCodes.INTERNAL_SERVER_ERROR,
              FirebaseErrorCodes.INTERNAL_ERROR,
              error.message || FirebaseErrorCodes.INTERNAL_ERROR,
              {}
            )
          );
        },
      },
    };

    try {
      this.firebaseUiWidget.start(firebaseUIElementRef.current!, uiConfig);
    } catch (error) {
      const firebaseError = (error as any).code;
      console.log({ error });
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
