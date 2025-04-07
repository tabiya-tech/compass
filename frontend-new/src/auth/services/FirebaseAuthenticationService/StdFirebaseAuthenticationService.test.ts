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
    })
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
      jest.spyOn(AuthenticationStateService.getInstance(), "setToken")

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
    
    test("should handle errors during token refresh", async () => {
      // GIVEN a current user exists
      const mockError = new Error("Token refresh failed");
      const mockUser = {
        getIdToken: jest.fn().mockRejectedValue(mockError),
      };
      
      // AND the auth state listener is set up to return the user
      const mockUnsubscribe = jest.fn();
      (firebaseAuth.onAuthStateChanged as jest.Mock).mockImplementation((callback) => {
        // Simulate the callback being called with the mock user
        callback(mockUser);
        return mockUnsubscribe;
      });

      // WHEN refreshToken is called
      const refreshPromise = service.refreshToken();

      // THEN it should reject with the error
      await expect(refreshPromise).rejects.toThrow("Token refresh failed");
      
      // AND it should call the unsubscribe function
      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });

  describe("scheduleTokenRefresh", () => {
    test("should schedule token refresh correctly", () => {
      const mockTimeout = jest.spyOn(window, "setTimeout");
      // GIVEN a valid token with expiration
      const mockToken = "test-token";
      const mockDecodedToken: FirebaseToken = {
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        name: "Test User",
        aud: "test-audience",
        auth_time: 123456789,
        user_id: "test-user",
        sub: "test-sub",
        email: "test@example.com",
        email_verified: true,
        firebase: {
          identities: {
            email: ["test@example.com"],
          },
          sign_in_provider: "password",
        },
        iss: "https://securetoken.google.com/test",
        iat: 123456789,
      };
      (jwtDecode as jest.Mock).mockReturnValue(mockDecodedToken);

      // WHEN scheduling token refresh
      service["scheduleTokenRefresh"](mockToken);

      // THEN a timeout should be set
      expect(mockTimeout).toHaveBeenCalled();
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
});
