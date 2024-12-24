import "src/_test_utilities/consoleMock";
import AuthenticationService, { TokenValidationFailureCause } from "./Authentication.service";
import { jwtDecode } from "jwt-decode";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import UserPreferencesService, {
  userPreferencesService,
} from "src/userPreferences/UserPreferencesService/userPreferences.service";
import { Language } from "src/userPreferences/UserPreferencesService/userPreferences.types";
import { TabiyaUser, Token, TokenHeader } from "src/auth/auth.types";
import AuthenticationStateService from "./AuthenticationState.service";

import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { ServiceError } from "src/error/ServiceError/ServiceError";
import { StatusCodes } from "http-status-codes";

// Mock jwt-decode
jest.mock("jwt-decode", () => ({
  jwtDecode: jest.fn(),
}));

// Mock PersistentStorageService
jest.mock("src/app/PersistentStorageService/PersistentStorageService", () => ({
  PersistentStorageService: {
    setToken: jest.fn(),
    clearToken: jest.fn(),
    clearLoginMethod: jest.fn(),
    clearPersonalInfo: jest.fn(),
  },
}));

// Mock userPreferencesService
jest.mock("src/userPreferences/UserPreferencesService/userPreferences.service", () => ({
  userPreferencesService: {
    getUserPreferences: jest.fn(),
    createUserPreferences: jest.fn(),
  },
}));

// Create a child class of AuthenticationService for testing
class TestAuthenticationService extends AuthenticationService {
  static getInstance(): TestAuthenticationService {
    return new TestAuthenticationService();
  }
  refreshToken(): Promise<void> {
    return Promise.resolve();
  }
  cleanup(): void {}
  logout(): Promise<void> {
    return Promise.resolve();
  }
  getUser(token: string): TabiyaUser | null {
    return {
      id: "test-id",
      name: "Test User",
      email: "test@example.com",
    };
  }
}

describe("AuthenticationService", () => {
  let service: TestAuthenticationService;

  beforeEach(() => {
    service = TestAuthenticationService.getInstance();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("onSuccessfulLogout", () => {
    beforeEach(() => {
      jest.spyOn(AuthenticationStateService.getInstance(), "clearUser");
      jest.spyOn(UserPreferencesStateService.getInstance(), "clearUserPreferences");
    });
    test("should clear user data and login method", async () => {
      // WHEN onSuccessfulLogout is called
      await service.onSuccessfulLogout();

      // THEN the authentication state should be cleared
      expect(AuthenticationStateService.getInstance().clearUser).toHaveBeenCalled();

      // AND the user preferences state should be cleared
      expect(service["userPreferencesStateService"].clearUserPreferences).toHaveBeenCalled();

      // AND the login method should be cleared from persistent storage
      expect(PersistentStorageService.clearLoginMethod).toHaveBeenCalled();
    });
  });

  describe("onSuccessfulLogin", () => {
    const givenToken = "test-token";
    const givenUser = {
      id: "test-id",
      name: "Test User",
      email: "test@example.com",
    };

    beforeEach(() => {
      jest.spyOn(AuthenticationStateService.getInstance(), "setUser");
      jest.spyOn(UserPreferencesStateService.getInstance(), "setUserPreferences");
    });

    test("should set user data and preferences on successful login", async () => {
      // GIVEN a user exists in the token
      jest.spyOn(service, "getUser").mockReturnValue(givenUser);

      // AND user preferences exist
      const givenPrefs = { language: Language.en };
      (userPreferencesService.getUserPreferences as jest.Mock).mockResolvedValue(givenPrefs);

      // WHEN onSuccessfulLogin is called
      await service.onSuccessfulLogin(givenToken);

      // THEN the token should be stored
      expect(PersistentStorageService.setToken).toHaveBeenCalledWith(givenToken);

      // AND the user should be set in the authentication state
      expect(AuthenticationStateService.getInstance().setUser).toHaveBeenCalledWith(givenUser);

      // AND the user preferences should be fetched and set
      expect(userPreferencesService.getUserPreferences).toHaveBeenCalledWith(givenUser.id);
      expect(service["userPreferencesStateService"].setUserPreferences).toHaveBeenCalledWith(givenPrefs);
    });

    test("should throw error when user is not found in token", async () => {
      // GIVEN no user exists in the token
      jest.spyOn(service, "getUser").mockReturnValue(null);

      // WHEN onSuccessfulLogin is called
      const loginPromise = service.onSuccessfulLogin(givenToken);

      // THEN it should throw an error
      await expect(loginPromise).rejects.toThrow("User not found in the token");
    });

    test("should not throw error when user preferences are not found", async () => {
      // GIVEN a user exists in the token
      const givenToken = "test-token";
      const givenUser = {
        id: "test-id",
        name: "Test User",
        email: "test@example.com",
      };
      jest.spyOn(service, "getUser").mockReturnValue(givenUser);

      // AND user preferences service throws a 404 error
      const givenError = new ServiceError(
        UserPreferencesService.serviceName,
        "getUserPreferences",
        "GET",
        "/",
        StatusCodes.NOT_FOUND,
        "Not Found",
        ""
      );
      (userPreferencesService.getUserPreferences as jest.Mock).mockRejectedValue(givenError);

      // WHEN onSuccessfulLogin is called
      await service.onSuccessfulLogin(givenToken);

      // THEN the token should be stored
      expect(PersistentStorageService.setToken).toHaveBeenCalledWith(givenToken);

      // AND the user should be set in the authentication state
      expect(AuthenticationStateService.getInstance().setUser).toHaveBeenCalledWith(givenUser);

      // AND user preferences should have been attempted to be fetched
      expect(userPreferencesService.getUserPreferences).toHaveBeenCalledWith(givenUser.id);

      // AND user preferences should not be set since they weren't found
      expect(service["userPreferencesStateService"].setUserPreferences).not.toHaveBeenCalled();

      // AND an info message should be logged
      expect(console.info).toHaveBeenCalledWith(
        `User has not registered! Preferences could not be found for userId: ${givenUser.id}`
      );

      // AND the error should not be rethrown
      expect(console.error).not.toHaveBeenCalled();
    });
  });

  describe("onSuccessfulRegistration", () => {
    const givenToken = "test-token";
    const givenRegistrationCode = "test-code";
    const givenUser = {
      id: "test-id",
      name: "Test User",
      email: "test@example.com",
    };

    beforeEach(() => {
      jest.spyOn(AuthenticationStateService.getInstance(), "setUser");
      jest.spyOn(UserPreferencesStateService.getInstance(), "setUserPreferences");
    });

    test("should set user data and create preferences on successful registration", async () => {
      // GIVEN a user exists in the token
      jest.spyOn(service, "getUser").mockReturnValue(givenUser);

      // AND user preferences are created successfully
      const givenPrefs = { language: Language.en };
      (userPreferencesService.createUserPreferences as jest.Mock).mockResolvedValue(givenPrefs);

      // WHEN onSuccessfulRegistration is called
      await service.onSuccessfulRegistration(givenToken, givenRegistrationCode);

      // THEN the token should be stored
      expect(PersistentStorageService.setToken).toHaveBeenCalledWith(givenToken);

      // AND the user should be set in the authentication state
      expect(AuthenticationStateService.getInstance().setUser).toHaveBeenCalledWith(givenUser);

      // AND new user preferences should be created
      expect(userPreferencesService.createUserPreferences).toHaveBeenCalledWith({
        user_id: givenUser.id,
        invitation_code: givenRegistrationCode,
        language: Language.en,
      });

      // AND the preferences should be set in the state
      expect(service["userPreferencesStateService"].setUserPreferences).toHaveBeenCalledWith(givenPrefs);
    });

    test("should throw error when user is not found in token", async () => {
      // GIVEN no user exists in the token
      jest.spyOn(service, "getUser").mockReturnValue(null);

      // WHEN onSuccessfulRegistration is called
      const registrationPromise = service.onSuccessfulRegistration(givenToken, givenRegistrationCode);

      // THEN it should throw an error
      await expect(registrationPromise).rejects.toThrow("User not found in the token");
    });
  });

  describe("onSuccessfulRefresh", () => {
    const givenToken = "refreshed-token";
    const givenUser = {
      id: "test-id",
      name: "Test User",
      email: "test@example.com",
    };

    beforeEach(() => {
      jest.spyOn(AuthenticationStateService.getInstance(), "setUser");
      jest.spyOn(UserPreferencesStateService.getInstance(), "setUserPreferences");
    });

    test("should update token and user data on successful refresh", async () => {
      // GIVEN a user exists in the token
      jest.spyOn(service, "getUser").mockReturnValue(givenUser);

      // WHEN onSuccessfulRefresh is called
      await service.onSuccessfulRefresh(givenToken);

      // THEN the token should be stored
      expect(PersistentStorageService.setToken).toHaveBeenCalledWith(givenToken);

      // AND the user should be set in the authentication state
      expect(AuthenticationStateService.getInstance().setUser).toHaveBeenCalledWith(givenUser);
    });

    test("should throw error when user is not found in token", async () => {
      // GIVEN no user exists in the token
      jest.spyOn(service, "getUser").mockReturnValue(null);

      // WHEN onSuccessfulRefresh is called
      const refreshPromise = service.onSuccessfulRefresh(givenToken);

      // THEN it should throw an error
      await expect(refreshPromise).rejects.toThrow("User not found in the token");
    });
  });

  describe("isTokenValid", () => {
    const currentTime = 1000;

    beforeEach(() => {
      jest.spyOn(Date, "now").mockReturnValue(currentTime * 1000);
    });

    test("should return true for valid token", () => {
      // GIVEN a valid token with correct header and payload
      const givenToken = "valid-token";
      (jwtDecode as jest.Mock)
        .mockReturnValueOnce({
          typ: "JWT",
          alg: "RS256",
          kid: "key-id",
        } as TokenHeader)
        .mockReturnValueOnce({
          exp: currentTime + 3600,
          iat: currentTime - 3600,
        } as Token);

      // WHEN isTokenValid is called
      const result = service.isTokenValid(givenToken);

      // THEN it should return true and the decoded token
      expect(result.isValid).toBe(true);
      expect(result.decodedToken).toBeDefined();
      expect(result.failureCause).toBeUndefined();
    });

    test.each([
      ["missing JWT type", { alg: "RS256", kid: "key-id" }, TokenValidationFailureCause.TOKEN_NOT_A_JWT],
      ["missing algorithm", { typ: "JWT", kid: "key-id" }, TokenValidationFailureCause.TOKEN_NOT_SIGNED],
      ["missing key ID", { typ: "JWT", alg: "RS256" }, TokenValidationFailureCause.TOKEN_DOES_NOT_HAVE_A_KEY_ID],
    ])("should return false when token header is invalid due to %s", (_, header, expectedFailureCause) => {
      // GIVEN a token with invalid header
      const givenToken = "invalid-token";
      (jwtDecode as jest.Mock).mockReturnValueOnce(header);

      // WHEN isTokenValid is called
      const result = service.isTokenValid(givenToken);

      // THEN it should return false
      expect(result.isValid).toBe(false);
      expect(result.decodedToken).toBeNull();
      expect(result.failureCause).toBe(expectedFailureCause);
    });

    test.each([
      ["expired token", { exp: currentTime - 2, iat: currentTime - 3600 }, "TOKEN_EXPIRED"],
      ["future token", { exp: currentTime + 3600, iat: currentTime + 2 }, "TOKEN_NOT_YET_VALID"],
    ])("should return false for %s", (_, payload, expectedFailureCause) => {
      // GIVEN a token with invalid timing
      const givenToken = "invalid-token";
      (jwtDecode as jest.Mock)
        .mockReturnValueOnce({
          typ: "JWT",
          alg: "RS256",
          kid: "key-id",
        } as TokenHeader)
        .mockReturnValueOnce(payload as Token);

      // WHEN isTokenValid is called
      const result = service.isTokenValid(givenToken);

      // THEN it should return false
      expect(result.isValid).toBe(false);
      expect(result.decodedToken).toBeNull();
      expect(result.failureCause).toBe(expectedFailureCause);
    });

    test("should return false when token decoding fails", () => {
      // GIVEN jwt-decode throws an error
      const givenToken = "invalid-token";
      (jwtDecode as jest.Mock).mockImplementation(() => {
        throw new Error("Invalid token");
      });

      // WHEN isTokenValid is called
      const result = service.isTokenValid(givenToken);

      // THEN it should return false
      expect(result.isValid).toBe(false);
      expect(result.decodedToken).toBeNull();
      expect(result.failureCause).toBe(TokenValidationFailureCause.ERROR_DECODING_TOKEN);
    });
  });
});
