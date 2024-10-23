// mock noisy console
import "src/_test_utilities/consoleMock";
import FirebaseSocialAuthService from "src/auth/services/FirebaseAuthenticationService/socialAuth/FirebaseSocialAuthentication.service";
import firebase from "firebase/compat/app";
import authenticationStateService from "src/auth/services/AuthenticationState.service";

jest.mock("firebase/compat/app", () => {
  return {
    initializeApp: jest.fn(),
    auth: jest.fn().mockReturnValue({
      signOut: jest.fn(),
      signInWithPopup: jest.fn(),
      onAuthStateChanged: jest.fn(),
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

jest.mock("src/userPreferences/UserPreferencesService/userPreferences.service", () => {
  return {
    userPreferencesService: {
      getUserPreferences: jest.fn()
    },
  };
})

describe("SocialAuthService class tests", () => {
  let authService: FirebaseSocialAuthService;
  beforeEach(async () => {
    authService = await FirebaseSocialAuthService.getInstance();
    // @ts-ignore
    firebase.auth.GoogleAuthProvider = class {
      static PROVIDER_ID = "google.com";
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("handleLoginWithGoogle", () => {
    const givenUser = { id: "123", name: "Foo Bar ", email: "email" };
    test("should handle Google login successfully", async () => {
      // GIVEN the Firebase UI is initialized
      const mockUser = { multiFactor: { user: { accessToken: "mockAccessToken" } } };
      // @ts-ignore
      jest.spyOn(firebase.auth(), "signInWithPopup").mockResolvedValueOnce({ user: mockUser });
      // AND the token is decoded into a user
      jest.spyOn(await authenticationStateService, "getUser").mockReturnValue(givenUser);

      // WHEN the Google login is attempted
      const socialLoginCallback = async () => await authService.loginWithGoogle();

      // THEN the token should be returned
      await expect(socialLoginCallback()).resolves.toEqual(mockUser.multiFactor.user.accessToken);
    });

    test("should throw an error if user is not found during sign-in", async () => {
      // GIVEN the Firebase UI is initialized
      // @ts-ignore
      jest.spyOn(firebase.auth(), "signInWithPopup").mockResolvedValueOnce({ user: { multiFactor: { user: {} } } });

      // WHEN the Google login is attempted
      const socialLoginCallback = async () => await authService.loginWithGoogle();

      // THEN the error should be thrown
      await expect(socialLoginCallback()).rejects.toThrow("The user could not be found");
    });
  });
});
