import "src/_test_utilities/consoleMock";
import StdFirebaseAuthenticationService, {
  FirebaseTokenProvider,
  FirebaseTokenValidationFailureCause,
} from "./StdFirebaseAuthenticationService";
import { firebaseAuth } from "src/auth/firebaseConfig";
import { jwtDecode } from "jwt-decode";
import { FirebaseToken } from "./StdFirebaseAuthenticationService";
import AuthenticationStateService from "src/auth/services/AuthenticationState.service";
import { resetAllMethodMocks } from "src/_test_utilities/resetAllMethodMocks";
import firebase from "firebase/compat/app";

// Mock jwt-decode
jest.mock("jwt-decode", () => ({
  jwtDecode: jest.fn(),
}));

// Mock firebase auth
jest.mock("src/auth/firebaseConfig", () => ({
  firebaseAuth: {
    signOut: jest.fn(),
    currentUser: null,
    onAuthStateChanged: jest.fn(),
  },
}));

describe("StdFirebaseAuthenticationService", () => {
  let service: StdFirebaseAuthenticationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = StdFirebaseAuthenticationService.getInstance();
  });

  beforeAll(() => {
    Object.defineProperty(global, "indexedDB", {
      value: {
        deleteDatabase: jest.fn().mockReturnValue({
          onerror: jest.fn(),
          onblocked: jest.fn(),
          onsuccess: jest.fn(),
        }),
      },
      writable: true,
    });
  });

  describe("getInstance", () => {
    test("should return the same instance when called multiple times", () => {
      // WHEN getting instances multiple times
      const instance1 = StdFirebaseAuthenticationService.getInstance();
      const instance2 = StdFirebaseAuthenticationService.getInstance();

      // THEN they should be the same instance
      expect(instance1).toBe(instance2);
    });
  });

  describe("logout", () => {
    test("should successfully logout and cleanup", async () => {
      // GIVEN firebase signOut succeeds
      jest.spyOn(firebaseAuth, "signOut").mockResolvedValue();

      // WHEN logout is called
      await service.logout();

      // THEN firebase signOut should be called
      expect(firebaseAuth.signOut).toHaveBeenCalled();
    });

    test("should handle logout failure gracefully", async () => {
      // GIVEN firebase signOut fails
      const error = new Error("Logout failed");
      jest.spyOn(firebaseAuth, "signOut").mockRejectedValue(error);

      // WHEN logout is called
      await service.logout();

      // THEN it should log a warning
      expect(console.warn).toHaveBeenCalledWith(
        "An error occurred while logging out from firebase. Cleaning firebase DB explicitly.",
        error
      );
    });
  });

  describe("refreshToken", () => {
    beforeEach(() => {
      resetAllMethodMocks(AuthenticationStateService.getInstance());
    });
    test("should successfully refresh token when user exists", async () => {
      // GIVEN a current user exists with a token
      const mockToken = "new-token";
      (jwtDecode as jest.Mock).mockReturnValue({ exp: 123456789 });
      const mockUser = {
        getIdToken: jest.fn().mockResolvedValue(mockToken),
      };

      // AND the auth state listener is set up to return the user
      const mockUnsubscribe = jest.fn();
      (firebaseAuth.onAuthStateChanged as jest.Mock).mockImplementation((callback) => {
        // Simulate the callback being called with the mock user
        callback(mockUser);
        return mockUnsubscribe;
      });

      // AND setting the token into state will succeed
      jest.spyOn(AuthenticationStateService.getInstance(), "setToken");

      // WHEN refreshToken is called
      const result = await service.refreshToken();

      // THEN it should return the new token
      expect(result).toBe(mockToken);

      // AND it should set the token into state
      expect(AuthenticationStateService.getInstance().setToken).toHaveBeenCalledWith(mockToken);

      // AND it should call getIdToken with force refresh
      expect(mockUser.getIdToken).toHaveBeenCalledWith(true);

      // AND it should call the unsubscribe function
      expect(mockUnsubscribe).toHaveBeenCalled();
    });

    test("should handle non-network errors during token refresh without retrying", async () => {
      // GIVEN a current user exists
      const mockError = new Error("Token refresh failed");
      const mockUser = {
        getIdToken: jest.fn().mockRejectedValue(mockError),
      };

      // AND the auth state listener is set up to return the user
      const mockUnsubscribe = jest.fn();
      (firebaseAuth.onAuthStateChanged as jest.Mock).mockImplementation((callback) => {
        callback(mockUser);
        return mockUnsubscribe;
      });

      // WHEN refreshToken is called
      const refreshPromise = service.refreshToken();

      // THEN it should reject with the error immediately (no retries for non-network errors)
      await expect(refreshPromise).rejects.toThrow("Token refresh failed");

      // AND it should only have called onAuthStateChanged once
      expect(firebaseAuth.onAuthStateChanged).toHaveBeenCalledTimes(1);

      // AND it should call the unsubscribe function
      expect(mockUnsubscribe).toHaveBeenCalled();
    });

    xtest("should retry up to 3 times on network errors and eventually succeed", async () => {
      jest.useFakeTimers();

      // GIVEN a network error on the first two attempts, then success
      const networkError = Object.assign(new Error("network-request-failed"), {
        code: "auth/network-request-failed",
      });
      const mockToken = "new-token";
      const mockUserFailing = { getIdToken: jest.fn().mockRejectedValue(networkError) };
      const mockUserSuccess = { getIdToken: jest.fn().mockResolvedValue(mockToken) };
      const mockUnsubscribe = jest.fn();

      (firebaseAuth.onAuthStateChanged as jest.Mock)
        .mockImplementationOnce((callback) => {
          callback(mockUserFailing);
          return mockUnsubscribe;
        })
        .mockImplementationOnce((callback) => {
          callback(mockUserFailing);
          return mockUnsubscribe;
        })
        .mockImplementationOnce((callback) => {
          callback(mockUserSuccess);
          return mockUnsubscribe;
        });

      jest.spyOn(AuthenticationStateService.getInstance(), "setToken");

      // WHEN refreshToken is called
      const refreshPromise = service.refreshToken();

      // Advance timers for each retry delay (1s, 2s)
      // Flush microtasks between timer advances to allow async code to run
      await Promise.resolve();
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
      jest.advanceTimersByTime(2000);
      await Promise.resolve();

      const result = await refreshPromise;

      // THEN it should eventually return the new token
      expect(result).toBe(mockToken);

      // AND it should have retried (3 total attempts)
      expect(firebaseAuth.onAuthStateChanged).toHaveBeenCalledTimes(3);

      jest.useRealTimers();
    });

    xtest("should fail after 3 network error retries", async () => {
      jest.useFakeTimers();

      // GIVEN a network error on all attempts
      const networkError = Object.assign(new Error("network-request-failed"), {
        code: "auth/network-request-failed",
      });
      const mockUserFailing = { getIdToken: jest.fn().mockRejectedValue(networkError) };
      const mockUnsubscribe = jest.fn();

      (firebaseAuth.onAuthStateChanged as jest.Mock).mockImplementation((callback) => {
        callback(mockUserFailing);
        return mockUnsubscribe;
      });

      // WHEN refreshToken is called
      const refreshPromise = service.refreshToken();

      // Advance timers through all retry delays
      await jest.runAllTimersAsync();

      // THEN it should reject after exhausting retries
      await expect(refreshPromise).rejects.toThrow("network-request-failed");

      // AND it should have tried 3 times
      expect(firebaseAuth.onAuthStateChanged).toHaveBeenCalledTimes(3);

      jest.useRealTimers();
    });
  });

  describe("getUserFromDecodedToken", () => {
    test("should correctly map token to user with name", () => {
      // GIVEN a decoded token with name
      const mockToken: FirebaseToken = {
        name: "Test User",
        user_id: "123",
        email: "test@example.com",
        aud: "test",
        auth_time: 123456789,
        sub: "test",
        email_verified: true,
        exp: 123456789,
        firebase: {
          identities: { email: ["test@example.com"] },
          sign_in_provider: "password",
        },
        iss: "https://securetoken.google.com/test",
        iat: 123456789,
      };

      // WHEN getting user from token
      const user = service.getUserFromDecodedToken(mockToken);

      // THEN user should be correctly mapped
      expect(user).toEqual({
        id: "123",
        name: "Test User",
        email: "test@example.com",
      });
    });

    test("should use email as name when name is not available", () => {
      // GIVEN a decoded token without name
      const mockToken: FirebaseToken = {
        name: "",
        user_id: "123",
        email: "test@example.com",
        aud: "test",
        auth_time: 123456789,
        sub: "test",
        email_verified: true,
        exp: 123456789,
        firebase: {
          identities: { email: ["test@example.com"] },
          sign_in_provider: "password",
        },
        iss: "https://securetoken.google.com/test",
        iat: 123456789,
      };

      // WHEN getting user from token
      const user = service.getUserFromDecodedToken(mockToken);

      // THEN email should be used as name
      expect(user).toEqual({
        id: "123",
        name: "test@example.com",
        email: "test@example.com",
      });
    });
  });

  describe("isFirebaseTokenValid", () => {
    test.each([FirebaseTokenProvider.GOOGLE, FirebaseTokenProvider.PASSWORD, FirebaseTokenProvider.ANONYMOUS])(
      "should return true for valid %s token",
      (givenTokenProvider) => {
        // GIVEN a valid firebase token with the given provider
        const mockToken: FirebaseToken = {
          name: "Test User",
          user_id: "123",
          email: "test@example.com",
          aud: "test",
          auth_time: 123456789,
          sub: "test",
          email_verified: true,
          exp: 123456789,
          firebase: {
            identities: { email: ["test@example.com"] },
            sign_in_provider: givenTokenProvider,
          },
          iss: "https://securetoken.google.com/test",
          iat: 123456789,
        };

        // WHEN validating the token
        const result = service.isFirebaseTokenValid(mockToken, givenTokenProvider);

        // THEN it should be valid
        expect(result.isValid).toBe(true);
      }
    );

    test.each([
      ["missing firebase property", { user_id: "123" }, FirebaseTokenValidationFailureCause.INVALID_FIREBASE_TOKEN],
      [
        "missing sign_in_provider",
        { firebase: {}, user_id: "123" },
        FirebaseTokenValidationFailureCause.INVALID_FIREBASE_SIGN_IN_PROVIDER,
      ],
      [
        "missing user_id",
        { firebase: { sign_in_provider: "password" } },
        FirebaseTokenValidationFailureCause.INVALID_FIREBASE_USER_ID,
      ],
    ])("should return false when %s", (_scenario, tokenData, expectedFailureCause) => {
      // GIVEN an invalid token
      const givenToken = tokenData as FirebaseToken;
      // AND some token provider
      const givenTokenProvider = FirebaseTokenProvider.PASSWORD;

      // WHEN validating the token
      const result = service.isFirebaseTokenValid(givenToken, givenTokenProvider);

      // THEN it should be invalid
      expect(result.isValid).toBe(false);
      expect(result.failureCause).toBe(expectedFailureCause);
    });
  });

  describe("getCurrentUser", () => {
    it("should return null if there is no user in the firebase storage", async () => {
      // GIVEN firebase.onAuthStateChanged calls back with null
      const mockUnsubscribe = jest.fn();
      (firebaseAuth.onAuthStateChanged as jest.Mock).mockImplementation((callback) => {
        // Simulate the callback being called with the null/no-user
        callback(null);
        return mockUnsubscribe;
      });

      // WHEN getting the current user
      const user = await service.getCurrentUser();

      // THEN it should return the user
      expect(user).toBe(null);
    });

    it("should return the user if the user is in the firebase storage", async () => {
      // GIVEN firebase.onAuthStateChanged calls back with a user
      const mockUser = { displayName: "Test User" } as firebase.User;
      const mockUnsubscribe = jest.fn();
      (firebaseAuth.onAuthStateChanged as jest.Mock).mockImplementation((callback) => {
        // Simulate the callback being called with the mock user
        callback(mockUser);
        return mockUnsubscribe;
      });

      // WHEN getting the current user
      const user = await service.getCurrentUser();

      // THEN it should return the user
      expect(user).toBe(mockUser);
    });

    it("should reject with an error if firebase.getUser throws an error", async () => {
      // GIVEN firebase.onAuthStateChanged calls the onError callback
      const mockUnsubscribe = jest.fn();
      (firebaseAuth.onAuthStateChanged as jest.Mock).mockImplementation((_callback, onError) => {
        // Simulate the callback being called with the null/no-user
        onError(new Error("Firebase error"));
        return mockUnsubscribe;
      });

      // WHEN getting the current user
      const getCurrentUserPromise = service.getCurrentUser();

      // THEN it should reject with an error
      await expect(getCurrentUserPromise).rejects.toThrow("Failed to get current user from Firebase Auth");
    });
  });

  describe("isAuthSessionValid", () => {
    it("should return true if there is a valid auth session", async () => {
      // GIVEN getCurrentUser returns a valid user
      jest.spyOn(service, "getCurrentUser").mockResolvedValue({ displayName: "kkk" } as firebase.User);

      // WHEN checking if auth session is valid
      const isValid = await service.isAuthSessionValid();

      // THEN it should be false
      expect(isValid).toBe(true);
    });

    it("should return false if there is no valid auth session", async () => {
      // GIVEN getCurrentUser returns null
      jest.spyOn(service, "getCurrentUser").mockResolvedValue(null);

      // WHEN checking if auth session is valid
      const isValid = await service.isAuthSessionValid();

      // THEN it should be false
      expect(isValid).toBe(false);
    });

    it("should return false if getCurrentUser throws an error", async () => {
      // GIVEN getCurrentUser throws an error
      jest.spyOn(service, "getCurrentUser").mockRejectedValue(new Error("Failed to get user"));

      // WHEN checking if auth session is valid
      const isValid = await service.isAuthSessionValid();

      // THEN it should be false
      expect(isValid).toBe(false);

      // AND it should log the error
      expect(console.error).toHaveBeenCalledWith(new Error("Failed to get user"));
    });
  });
});
