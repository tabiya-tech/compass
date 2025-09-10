// mock noisy console
import "src/_test_utilities/consoleMock";
import FirebaseSocialAuthService from "src/auth/services/FirebaseAuthenticationService/socialAuth/FirebaseSocialAuthentication.service";
import firebase from "firebase/compat/app";
import { UserPreference } from "src/userPreferences/UserPreferencesService/userPreferences.types";
import UserPreferencesService from "src/userPreferences/UserPreferencesService/userPreferences.service";
import AuthenticationStateService from "src/auth/services/AuthenticationState.service";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { resetAllMethodMocks } from "src/_test_utilities/resetAllMethodMocks";
import StdFirebaseAuthenticationService from "src/auth/services/FirebaseAuthenticationService/StdFirebaseAuthenticationService";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import { AuthChannelMessage } from "src/auth/services/authBroadcastChannel/authBroadcastChannel";

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

// mock authBroadcastChannel
const mockBroadcast = jest.fn();
jest.mock("src/auth/services/authBroadcastChannel/authBroadcastChannel.ts", () => {
  return {
    AuthChannelMessage: { LOGOUT_USER: "LOGOUT_USER" },
    AuthBroadcastChannel: {
      getInstance: jest.fn(() => ({
        registerListener: jest.fn(),
        broadcast: mockBroadcast,
        closeChannel: jest.fn(),
      })),
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
        sessions: [],
      } as unknown as UserPreference;
      jest
        .spyOn(UserPreferencesService.getInstance(), "getUserPreferences")
        .mockResolvedValueOnce(givenUserPreferences);

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

  describe("logout", () => {
    test("should log out the user successfully", async () => {
      // GIVEN the user is logged in with social auth
      PersistentStorageService.setLoginMethod("FIREBASE_SOCIAL");
      // AND the logout method resolves
      jest.spyOn(StdFirebaseAuthenticationService.getInstance(), "logout").mockResolvedValueOnce();

      // WHEN logging out the user
      await authService.logout();

      // THEN the StdFirebaseAuthenticationService logout method should be called
      expect(StdFirebaseAuthenticationService.getInstance().logout).toHaveBeenCalled();

      // AND the Authentication State should be cleared
      expect(AuthenticationStateService.getInstance().getUser()).toBeNull();

      // AND the UserPreference State should be cleared
      expect(UserPreferencesStateService.getInstance().getUserPreferences()).toBeNull();

      // AND a logout message should be broadcasted to other tabs
      expect(mockBroadcast).toHaveBeenCalledWith(AuthChannelMessage.LOGOUT_USER);

      // AND no errors or warnings should be logged
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should handle errors during logout", async () => {
      // GIVEN the user is logged in with social auth
      PersistentStorageService.setLoginMethod("FIREBASE_SOCIAL");
      // AND logout method rejects with an error
      jest
        .spyOn(StdFirebaseAuthenticationService.getInstance(), "logout")
        .mockRejectedValueOnce(new Error("Logout failed!"));

      // WHEN logging out the user
      const logoutPromise = authService.logout();

      // THEN the logout promise should be rejected with the error
      await expect(logoutPromise).rejects.toThrow("Logout failed!");

      // AND the StdFirebaseAuthenticationService logout method should be called
      expect(StdFirebaseAuthenticationService.getInstance().logout).toHaveBeenCalled();

      // AND no errors or warnings should be logged
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });
  });

  describe("isProviderSessionValid", () => {
    it.each([true, false])(
      "should always return '%s' stdFirebaseAuthService.isAuthSessionValid returns '%s'",
      async (expected) => {
        // GIVEN the expected result from StdFirebaseAuthenticationService.isAuthSessionValid
        const expectedResult = expected;
        jest
          .spyOn(StdFirebaseAuthenticationService.getInstance(), "isAuthSessionValid")
          .mockResolvedValue(expectedResult);

        // WHEN we query if the provider session is valid
        const actualResult = await authService.isProviderSessionValid();

        // THEN it should return the expected result
        expect(actualResult).toBe(expectedResult);
        expect(StdFirebaseAuthenticationService.getInstance().isAuthSessionValid).toHaveBeenCalled();

        // AND no errors or warnings should be logged
        expect(console.error).not.toHaveBeenCalled();
        expect(console.warn).not.toHaveBeenCalled();
      }
    );
  });
});
