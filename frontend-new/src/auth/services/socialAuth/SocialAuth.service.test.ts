import { socialAuthService } from "src/auth/services/socialAuth/SocialAuth.service";
import { FirebaseError } from "src/error/FirebaseError/firebaseError";
import firebase from "firebase/compat/app";

jest.mock("firebase/compat/app", () => {
  return {
    initializeApp: jest.fn(),
    auth: jest.fn().mockReturnValue({
      signOut: jest.fn(),
      signInWithPopup: jest.fn(),
    }),
  };
});

jest.mock("firebaseui", () => {
  return {
    auth: {
      AuthUI: {
        start: jest.fn(),
        getInstance: jest.fn().mockReturnValue({
          start: jest.fn(),
          reset: jest.fn(),
        }),
        reset: jest.fn(),
      },
    },
  };
});

describe("SocialAuthService class tests", () => {
  let successCallback: jest.Mock;
  let failureCallback: jest.Mock;

  beforeEach(() => {
    successCallback = jest.fn();
    failureCallback = jest.fn();
    // @ts-ignore
    firebase.auth.GoogleAuthProvider = class {
      static PROVIDER_ID = "google.com";
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("handleLoginWithGoogle", () => {
    test("should handle Google login successfully", async () => {
      // GIVEN the Firebase UI is initialized
      const mockUser = { multiFactor: { user: { accessToken: "mockAccessToken" } } };
      // @ts-ignore
      jest.spyOn(firebase.auth(), "signInWithPopup").mockResolvedValueOnce({ user: mockUser });

      // WHEN the Google login is attempted
      await socialAuthService.handleLoginWithGoogle(successCallback, failureCallback);

      // THEN the success callback should be called with the access token
      expect(successCallback).toHaveBeenCalledWith("mockAccessToken");
      // AND the failure callback should not be called
      expect(failureCallback).not.toHaveBeenCalled();
    });

    test("should call failureCallback if user is not found during sign-in", async () => {
      // GIVEN the Firebase UI is initialized
      // @ts-ignore
      jest.spyOn(firebase.auth(), "signInWithPopup").mockResolvedValueOnce({ user: { multiFactor: { user: {} } } });

      // WHEN the Google login is attempted
      await socialAuthService.handleLoginWithGoogle(successCallback, failureCallback);

      // THEN the success callback should not be called
      expect(successCallback).not.toHaveBeenCalled();
      // AND the failure callback should be called with a FirebaseError
      expect(failureCallback).toHaveBeenCalledWith(expect.any(FirebaseError));
    });
  });

  describe("handleLogout", () => {
    test("should handle user logout successfully", async () => {
      // GIVEN the user is logged in
      const successCallback = jest.fn();
      const failureCallback = jest.fn();
      jest.spyOn(firebase.auth(), "signOut").mockResolvedValueOnce(undefined);

      // WHEN the logout is attempted
      await socialAuthService.handleLogout(successCallback, failureCallback);

      // THEN the success callback should be called
      expect(successCallback).toHaveBeenCalled();
      // AND the failure callback should not be called
      expect(failureCallback).not.toHaveBeenCalled();
    });

    test("should call failureCallback on logout error", async () => {
      // GIVEN the user is logged in
      const mockError = {
        code: "auth/internal-error",
        message: "Internal error",
      };
      const successCallback = jest.fn();
      const failureCallback = jest.fn();
      jest.spyOn(firebase.auth(), "signOut").mockRejectedValueOnce(mockError);

      // WHEN the logout is attempted
      await socialAuthService.handleLogout(successCallback, failureCallback);

      // THEN the success callback should not be called
      expect(successCallback).not.toHaveBeenCalled();
      // AND the failure callback should be called with a FirebaseError
      expect(failureCallback).toHaveBeenCalledWith(expect.any(FirebaseError));
    });
  });
});
