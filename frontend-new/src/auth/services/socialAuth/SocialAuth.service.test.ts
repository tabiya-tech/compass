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
  beforeEach(() => {
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
      const socialLoginCalback = async () => await socialAuthService.handleLoginWithGoogle();

      // THEN the token should be returned
      await expect(socialLoginCalback()).resolves.toEqual(mockUser.multiFactor.user.accessToken);
    });

    test("should throw an error if user is not found during sign-in", async () => {
      // GIVEN the Firebase UI is initialized
      // @ts-ignore
      jest.spyOn(firebase.auth(), "signInWithPopup").mockResolvedValueOnce({ user: { multiFactor: { user: {} } } });

      // WHEN the Google login is attempted
      const socialLoginCallback = async () =>  await socialAuthService.handleLoginWithGoogle();

      // THEN the error should be thrown
      await expect(socialLoginCallback()).rejects.toThrow("The user could not be found");
    });
  });

  describe("handleLogout", () => {
    test("should handle user logout successfully", async () => {
      // GIVEN the user is logged in
      jest.spyOn(firebase.auth(), "signOut").mockResolvedValueOnce(undefined);

      // WHEN the logout is attempted
      const socialAuthCallback = async () => await socialAuthService.handleLogout();

      // THEN the success callback should be called
      await expect(socialAuthCallback()).resolves.toBeUndefined();
    });

    test("should call failureCallback on logout error", async () => {
      // GIVEN the user is logged in
      const mockError = {
        code: "auth/internal-error",
        message: "Internal error",
      };

      jest.spyOn(firebase.auth(), "signOut").mockRejectedValueOnce(mockError);

      // WHEN the logout is attempted
      const socialAuthCallback = async () =>  await socialAuthService.handleLogout();

      // THEN the success callback should not be called
      await expect(socialAuthCallback()).rejects.toEqual(expect.any(FirebaseError));
    });
  });
});
