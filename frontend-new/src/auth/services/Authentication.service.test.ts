import "src/_test_utilities/consoleMock";
import AuthenticationService, { CLOCK_TOLERANCE, TokenValidationFailureCause } from "./Authentication.service";
import { jwtDecode } from "jwt-decode";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import UserPreferencesService from "src/userPreferences/UserPreferencesService/userPreferences.service";
import { Language, UserPreference } from "src/userPreferences/UserPreferencesService/userPreferences.types";
import { TabiyaUser, Token, TokenHeader } from "src/auth/auth.types";
import AuthenticationStateService from "./AuthenticationState.service";

import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { RestAPIError } from "src/error/restAPIError/RestAPIError";
import { StatusCodes } from "http-status-codes";
import { resetAllMethodMocks } from "src/_test_utilities/resetAllMethodMocks";
import { nanoid } from "nanoid";

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
    clearAccountConverted: jest.fn(),
  },
}));

// The AuthenticationService class is an abstract class that defines the interface for all authentication services.
// In this test, we will test only the methods that are not abstract and have a default implementation.
// For doing that we will create simple test class that extends AuthenticationService and implements the abstract methods.
class TestAuthenticationService extends AuthenticationService {
  static getInstance(): TestAuthenticationService {
    return new TestAuthenticationService();
  }

  refreshToken(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  cleanup(): void {
    throw new Error("Method not implemented.");
  }

  logout(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  getUser(_token: string): TabiyaUser | null {
    throw new Error("Method not implemented.");
  }
}

function getTestUser(): TabiyaUser {
  const _id = nanoid();
  return {
    id: _id,
    name: _id + "-name",
    email: _id + "-email",
  };
}

describe("AuthenticationService", () => {
  let service: TestAuthenticationService;

  beforeEach(() => {
    service = TestAuthenticationService.getInstance();
    jest.clearAllMocks();

    // Reset the state of all singletons
    AuthenticationStateService.getInstance().setUser(null);
    UserPreferencesStateService.getInstance().clearUserPreferences();

    // Reset all method mocks on the singletons that may have been mocked
    // As a good practice, we should the mock*Once() methods to avoid side effects between tests
    // As a precaution, we reset all method mocks to ensure that no side effects are carried over between tests
    resetAllMethodMocks(UserPreferencesService.getInstance());
  });

  describe("onSuccessfulLogout", () => {

    test("should clear user data and login method", async () => {
      // setup mocks
      jest.spyOn(AuthenticationStateService.getInstance(), "clearUser");
      jest.spyOn(UserPreferencesStateService.getInstance(), "clearUserPreferences");
      jest.spyOn(PersistentStorageService, "clearLoginMethod");
      jest.spyOn(PersistentStorageService, "clearAccountConverted");
      // WHEN onSuccessfulLogout is called
      await service.onSuccessfulLogout();

      // THEN the authentication state should be cleared
      expect(AuthenticationStateService.getInstance().clearUser).toHaveBeenCalled();

      // AND the user preferences state should be cleared
      expect(UserPreferencesStateService.getInstance().clearUserPreferences).toHaveBeenCalled();

      // AND the login method should not be cleared from persistent storage and should be preserved for other logins
      expect(PersistentStorageService.clearLoginMethod).not.toHaveBeenCalled();

      // AND the account conversion flag should be cleared from persistent storage
      expect(PersistentStorageService.clearAccountConverted).toHaveBeenCalled();
    });
  });

  describe("onSuccessfulLogin", () => {

    test("should set user data and preferences on successful login", async () => {
      // GIVEN a token from a given user
      const givenToken = "test-token";
      const givenUser = getTestUser();
      jest.spyOn(service, "getUser").mockImplementationOnce((token) => {
        if (token === givenToken) {
          return givenUser;
        }
        return null;
      });
      // AND the given user has some preferences
      const givenUserPreferences: UserPreference = {
        user_id: "foo-id",
        sessions:[]
      } as unknown as UserPreference;
      jest.spyOn(UserPreferencesService.getInstance(), "getUserPreferences").mockResolvedValueOnce(givenUserPreferences);

      // WHEN onSuccessfulLogin is called
      await service.onSuccessfulLogin(givenToken);

      // THEN the token should be stored
      expect(PersistentStorageService.setToken).toHaveBeenCalledWith(givenToken);
      // AND the user should be set in the authentication state
      expect(AuthenticationStateService.getInstance().getUser()).toEqual(givenUser);
      // AND the user preferences were fetched for given user
      expect(UserPreferencesService.getInstance().getUserPreferences).toHaveBeenCalledWith(givenUser.id);
      // AND the user preferences should be set in the state
      expect(UserPreferencesStateService.getInstance().getUserPreferences()).toEqual(givenUserPreferences);

      // AND expect no errors or warning to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should throw error when user is not found in token", async () => {
      // GIVEN some token that does not contain a user
      jest.spyOn(service, "getUser").mockReturnValue(null);

      // WHEN onSuccessfulLogin is called with the token
      const loginPromise = service.onSuccessfulLogin("some token");

      // THEN it should throw an error
      await expect(loginPromise).rejects.toThrow("User not found in the token");
    });

    test("should not throw error when user preferences are not found", async () => {
      // GIVEN a token from a given user
      const givenToken = "test-token";
      const givenUser = getTestUser();
      jest.spyOn(service, "getUser").mockImplementationOnce((token) => {
        if (token === givenToken) {
          return givenUser;
        }
        return null;
      });
      // AND getting the user preferences service throws a 404 error
      const givenError = new RestAPIError(
        UserPreferencesService.serviceName,
        "getUserPreferences",
        "GET",
        "/",
        StatusCodes.NOT_FOUND,
        "Not Found",
        "",
      );
      jest.spyOn(UserPreferencesService.getInstance(), "getUserPreferences").mockRejectedValueOnce(givenError);

      // WHEN onSuccessfulLogin is called
      await service.onSuccessfulLogin(givenToken);

      // THEN the token should be stored
      expect(PersistentStorageService.setToken).toHaveBeenCalledWith(givenToken);
      // AND the user should be set in the authentication state
      expect(AuthenticationStateService.getInstance().getUser()).toEqual(givenUser);
      // AND user preferences were fetched for given user
      expect(UserPreferencesService.getInstance().getUserPreferences).toHaveBeenCalledWith(givenUser.id);
      // AND user preferences should not be set since they weren't found
      expect(UserPreferencesStateService.getInstance().getUserPreferences()).toBeNull();
      // AND an info message should be logged
      expect(console.info).toHaveBeenCalledWith(
        `User has not registered! Preferences could not be found for userId: ${givenUser.id}`,
      );
      // AND no error should be logged
      expect(console.error).not.toHaveBeenCalled();
    });

    test("should throw error when getting user preferences fails", async () => {
      // GIVEN a token from a given user
      const givenToken = "test-token";
      const givenUser = getTestUser();
      jest.spyOn(service, "getUser").mockImplementationOnce((token) => {
        if (token === givenToken) {
          return givenUser;
        }
        return null;
      });

      // AND getting the user preferences throws an error
      const givenError = new Error("Foo");
      jest.spyOn(UserPreferencesService.getInstance(), "getUserPreferences").mockRejectedValueOnce(givenError);

      // WHEN onSuccessfulLogin is called with the given token
      // THEN the error should be thrown
      await expect(service.onSuccessfulLogin(givenToken)).rejects.toThrow(givenError);
    });
  });

  describe("onSuccessfulRegistration", () => {

    test("should set user data and create preferences on successful registration", async () => {
      // GIVEN a registration code
      const givenRegistrationCode = "test-registration-code";
      // AND a token from a given user
      const givenToken = "test-token";
      const givenUser = getTestUser();
      jest.spyOn(service, "getUser").mockImplementationOnce((token) => {
        if (token === givenToken) {
          return givenUser;
        }
        return null;
      });

      // AND some user preferences will be created for the user
      const givenReturnedPrefs: UserPreference = {
        user_id: "foo-id",
        sessions:[]
      } as unknown as UserPreference;
      jest.spyOn(UserPreferencesService.getInstance(), "createUserPreferences").mockResolvedValueOnce(givenReturnedPrefs);

      // WHEN onSuccessfulRegistration is called for the given token and registration code
      await service.onSuccessfulRegistration(givenToken, givenRegistrationCode);

      // THEN the token should be stored
      expect(PersistentStorageService.setToken).toHaveBeenCalledWith(givenToken);

      // AND the user should be set in the authentication state
      expect(AuthenticationStateService.getInstance().getUser()).toEqual(givenUser);

      // AND new user preferences should be created for the user with the registration code
      expect((UserPreferencesService.getInstance().createUserPreferences)).toHaveBeenCalledWith({
        user_id: givenUser.id,
        invitation_code: givenRegistrationCode,
        language: Language.en,
      });

      // AND the preferences return from the service should be set in the state
      expect(UserPreferencesStateService.getInstance().getUserPreferences()).toEqual(givenReturnedPrefs);

      // AND expect no errors or warning to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should throw error when user is not found in token", async () => {
      // GIVEN some token that does not contain a user
      const givenToken = "test-token";
      jest.spyOn(service, "getUser").mockReturnValue(null);
      // AND some registration code
      const givenRegistrationCode = "test-registration-code";

      // WHEN onSuccessfulRegistration is called
      const registrationPromise = service.onSuccessfulRegistration(givenToken, givenRegistrationCode);

      // THEN it should throw an error
      await expect(registrationPromise).rejects.toThrow("User not found in the token");
    });
  });

  describe("onSuccessfulRefresh", () => {
    test("should update token and user data on successful refresh", async () => {
      // GIVEN a token from a given user
      const givenToken = "test-token";
      const givenUser = getTestUser();
      jest.spyOn(service, "getUser").mockImplementationOnce((token) => {
        if (token === givenToken) {
          return givenUser;
        }
        return null;
      });

      // WHEN onSuccessfulRefresh is called for the given token
      await service.onSuccessfulRefresh(givenToken);

      // THEN the token should be stored in the persistent storage
      expect(PersistentStorageService.setToken).toHaveBeenCalledWith(givenToken);

      // AND the user should be set in the authentication state
      expect(AuthenticationStateService.getInstance().getUser()).toEqual(givenUser);

      // AND expect no errors or warning to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should throw error when user is not found in token", async () => {
      // GIVEN some token that does not contain a user
      const givenToken = "test-token";
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

      // AND expect no errors or warning to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
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

      // AND expect no errors or warning to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test.each([
      ["expired token", { iat: currentTime - CLOCK_TOLERANCE - 100, exp: currentTime - CLOCK_TOLERANCE - 1 }, "TOKEN_EXPIRED"],
      ["future token", { iat: currentTime + CLOCK_TOLERANCE + 1, exp: currentTime + CLOCK_TOLERANCE + 100 }, "TOKEN_NOT_YET_VALID"],
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

      // AND expect no errors or warning to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
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

      // AND expect the error to have been logged
      expect(console.error).toHaveBeenCalled();
      // AND expect no warning to have occurred
      expect(console.warn).not.toHaveBeenCalled();
    });
  });
});
