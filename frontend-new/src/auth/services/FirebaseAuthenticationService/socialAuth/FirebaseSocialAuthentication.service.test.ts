// mock noisy console
import "src/_test_utilities/consoleMock";
import FirebaseSocialAuthService from "src/auth/services/FirebaseAuthenticationService/socialAuth/FirebaseSocialAuthentication.service";
import firebase from "firebase/compat/app";
import { UserPreference } from "src/userPreferences/UserPreferencesService/userPreferences.types";
import UserPreferencesService from "src/userPreferences/UserPreferencesService/userPreferences.service";
import AuthenticationStateService from "src/auth/services/AuthenticationState.service";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { resetAllMethodMocks } from "src/_test_utilities/resetAllMethodMocks";

jest.mock("firebase/compat/app", () => {
  const mockAuth = {
    initializeApp: jest.fn(),
    auth: jest.fn().mockReturnValue({
      signOut: jest.fn(),
      signInWithPopup: jest.fn(),
      onAuthStateChanged: jest.fn(),
    }),
  };
  // @ts-ignore
 mockAuth.auth.GoogleAuthProvider = class {
   static PROVIDER_ID = "google.com";
  };
  return mockAuth;
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
  const authService: FirebaseSocialAuthService = FirebaseSocialAuthService.getInstance();
  beforeEach(async () => {
    jest.clearAllMocks();
    AuthenticationStateService.getInstance().setUser(null);
    UserPreferencesStateService.getInstance().clearUserPreferences();
    // Reset all method mocks on the singletons that may have been mocked
    // As a good practice, we should the mock*Once() methods to avoid side effects between tests
    // As a precaution, we reset all method mocks to ensure that no side effects are carried over between tests
    resetAllMethodMocks(UserPreferencesService.getInstance());
  });

  test("should construct a singleton", async () => {
    // WHEN the singleton is constructed
    const instance = FirebaseSocialAuthService.getInstance();

    // THEN the instance should be defined
    expect(instance).toBeDefined();

    // AND WHEN the singleton is constructed again
    const newInstance = FirebaseSocialAuthService.getInstance();

    // THEN the instance should be the same as the first instance
    expect(newInstance).toBe(instance);

    // AND expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  describe("handleLoginWithGoogle", () => {
    const givenUser = { id: "123", name: "Foo Bar ", email: "email" };
    test("should handle Google login successfully", async () => {
      // GIVEN the Firebase UI is initialized
      const mockUser = { multiFactor: { user: { accessToken: "mockAccessToken" } } };
      // @ts-ignore
      jest.spyOn(firebase.auth(), "signInWithPopup").mockResolvedValueOnce({ user: mockUser });
      // AND the token is decoded into a user
      jest.spyOn(authService, "getUser").mockReturnValue(givenUser);

      // AND the user has some preferences
      const givenUserPreferences: UserPreference = {
        user_id: "foo-id",
        sessions:[]
      } as unknown as UserPreference;
      jest.spyOn(UserPreferencesService.getInstance(), "getUserPreferences").mockResolvedValueOnce(givenUserPreferences);

      // WHEN the Google login is attempted
      const actualToken = await authService.loginWithGoogle();

      // THEN the token should be returned
      expect(actualToken).toEqual(mockUser.multiFactor.user.accessToken);

      // AND the Authentication State should be set
      expect(AuthenticationStateService.getInstance().getUser()).toEqual(givenUser);

      // AND the UserPreference State should be set
      expect(UserPreferencesStateService.getInstance().getUserPreferences()).toEqual(givenUserPreferences);

      // AND expect no errors or warning to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should throw an error if user is not found during sign-in", async () => {
      // GIVEN the Firebase UI is initialized
      // @ts-ignore
      jest.spyOn(firebase.auth(), "signInWithPopup").mockResolvedValueOnce({ user: { multiFactor: { user: {} } } });

      // WHEN the Google login is attempted
      const socialLoginPromise = authService.loginWithGoogle();

      // THEN the error should be thrown
      await expect(socialLoginPromise).rejects.toThrow("The user could not be found");
    });
  });
});
