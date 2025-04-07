// mock the console logs
import "src/_test_utilities/consoleMock";

import AuthenticationStateService from "src/auth/services/AuthenticationState.service";
import { TabiyaUser } from "src/auth/auth.types";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import { nanoid } from "nanoid";

// Mock the PersistentStorageService
jest.mock("src/app/PersistentStorageService/PersistentStorageService", () => ({
  PersistentStorageService: {
    getToken: jest.fn(),
    setToken: jest.fn(),
    clearToken: jest.fn(),
  },
}));

// Mock Sentry
jest.mock("@sentry/react", () => ({
  setUser: jest.fn(),
}));

function getMockTabiyaUser(): TabiyaUser {
  return {
    id: nanoid(), // ensure a unique user id
    name: "Test User",
    email: "test@example.com",
  };
}

describe("AuthenticationStateService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the singleton instance before each test
    (AuthenticationStateService as any).instance = undefined;
  });

  describe("AuthenticationStateService Singleton", () => {
    test("should get a single instance successfully", () => {
      // WHEN the service is constructed
      const actualFirstInstance = AuthenticationStateService.getInstance();

      // THEN expect the service to be constructed successfully
      expect(actualFirstInstance).toBeDefined();

      // AND WHEN the service is constructed again
      const actualSecondInstance = AuthenticationStateService.getInstance();

      // THEN expect the second instance to be the same as the first instance
      expect(actualFirstInstance).toBe(actualSecondInstance);
    });
  });

  describe("AuthenticationStateService", () => {
    let service: AuthenticationStateService;

    beforeEach(() => {
      service = AuthenticationStateService.getInstance();
      service.clearUser();
    });

    describe("getUser", () => {
      it("should return null when no user is set", () => {
        // GIVEN the service is newly instantiated
        service = AuthenticationStateService.getInstance();

        // WHEN getUser is called
        const actualUser = service.getUser();

        // THEN expect the user to be null
        expect(actualUser).toBeNull();
      });

      it("should return the user when set", () => {
        // GIVEN a user is set
        const givenUser = getMockTabiyaUser();
        service.setUser(givenUser);

        // WHEN getUser is called
        const actualUser = service.getUser();

        // THEN expect the user to be returned
        expect(actualUser).toEqual(givenUser);
      });
    });

    describe("setUser", () => {
      it("should set the user and update Sentry", () => {
        // GIVEN a user
        const givenUser = getMockTabiyaUser();
        const setUserSpy = jest.spyOn(require("@sentry/react"), "setUser");

        // WHEN setUser is called
        const result = service.setUser(givenUser);

        // THEN expect the user to be set
        expect(service.getUser()).toEqual(givenUser);
        // AND expect Sentry to be updated
        expect(setUserSpy).toHaveBeenCalledWith({
          user_id: givenUser.id
        });
        // AND expect the result to be the user
        expect(result).toEqual(givenUser);
      });

      it("should handle null user and update Sentry", () => {
        // GIVEN a null user
        const setUserSpy = jest.spyOn(require("@sentry/react"), "setUser");

        // WHEN setUser is called with null
        const result = service.setUser(null);

        // THEN expect the user to be null
        expect(service.getUser()).toBeNull();
        // AND expect Sentry to be updated with UNKNOWN
        expect(setUserSpy).toHaveBeenCalledWith({
          user_id: "UNKNOWN"
        });
        // AND expect the result to be null
        expect(result).toBeNull();
      });

      it("should handle Sentry errors gracefully", () => {
        // GIVEN a user
        const givenUser = getMockTabiyaUser();
        // AND Sentry.setUser will throw an error
        jest.spyOn(require("@sentry/react"), "setUser").mockImplementationOnce(() => {
          throw new Error("Sentry error");
        });
        const consoleErrorSpy = jest.spyOn(console, "error");

        // WHEN setUser is called
        const result = service.setUser(givenUser);

        // THEN expect the user to be set despite the error
        expect(service.getUser()).toEqual(givenUser);
        // AND expect the error to be logged
        expect(consoleErrorSpy).toHaveBeenCalledWith("Error setting Sentry user context", expect.any(Error));
        // AND expect the result to be the user
        expect(result).toEqual(givenUser);
      });
    });

    describe("getToken", () => {
      it("should return null when no token is set", () => {
        // GIVEN the service is newly instantiated
        service = AuthenticationStateService.getInstance();

        // WHEN getToken is called
        const actualToken = service.getToken();

        // THEN expect the token to be null
        expect(actualToken).toBeNull();
      });

      it("should return token from state when set", () => {
        // GIVEN a token is set
        const givenToken = "mock-token-123";
        service.setToken(givenToken);

        // WHEN getToken is called
        const actualToken = service.getToken();

        // THEN expect the token to be returned
        expect(actualToken).toBe(givenToken);
      });
    });

    describe("loadToken", () => {
      it("should load token from storage and return it", () => {
        // GIVEN a token in storage
        const givenToken = "mock-token-123";
        jest.spyOn(PersistentStorageService, "getToken").mockReturnValue(givenToken);

        // WHEN loadToken is called
        service.loadToken();

        // AND getToken is called
        const actualToken = service.getToken();

        // THEN expect the token from storage to be returned
        expect(actualToken).toBe(givenToken);
        // AND expect the token to be set in state
        expect(service.getToken()).toBe(givenToken);
      });

      it("should return null when no token in storage", () => {
        // GIVEN no token in storage
        jest.spyOn(PersistentStorageService, "getToken").mockReturnValue(null);

        // WHEN loadToken is called
        service.loadToken();

        // AND getToken is called
        const actualToken = service.getToken();

        // THEN expect null to be returned
        expect(actualToken).toBeNull();
        // AND expect the token in state to be null
        expect(service.getToken()).toBeNull();
      });
    });

    describe("setToken", () => {
      it("should set the token and update persistent storage", () => {
        // GIVEN a token
        const givenToken = "mock-token-123";
        const setTokenSpy = jest.spyOn(PersistentStorageService, "setToken");

        // WHEN setToken is called
        service.setToken(givenToken);

        // AND token is retried again
        const expectedToken = service.getToken();

        // THEN expect the token to be set
        expect(service.getToken()).toBe(givenToken);
        // AND expect persistent storage to be updated
        expect(setTokenSpy).toHaveBeenCalledWith(givenToken);
        // AND expect the result to be the token
        expect(expectedToken).toBe(givenToken);
      });

      it.each(
        [null, undefined, ""]
      )("should warn when setting %s token", (givenToken) => {
        // GIVEN a null token
        // WHEN setToken is called with an empty token
        // @ts-ignore
        service.setToken(givenToken);

        // THEN expect a warning to be logged
        expect(console.warn).toHaveBeenCalledWith("AuthenticationStateService: Attempted to set an empty token");
      });
    });

    describe("clearToken", () => {
      it("should clear the token from state and storage", () => {
        // GIVEN a token is set
        const givenToken = "mock-token-123";
        service.setToken(givenToken);
        // guard
        expect(service.getToken()).toBe(givenToken);
        
        const clearTokenSpy = jest.spyOn(PersistentStorageService, "clearToken");
        jest.spyOn(PersistentStorageService, "getToken").mockReturnValueOnce(null);
        const consoleDebugSpy = jest.spyOn(console, "debug");

        // WHEN clearToken is called
        service.clearToken();

        // THEN expect persistent storage to be cleared
        expect(clearTokenSpy).toHaveBeenCalled();
        // AND expect the token to be null
        expect(service.getToken()).toBeNull();
        // AND expect a debug message to be logged
        expect(consoleDebugSpy).toHaveBeenCalledWith("AuthenticationStateService: Clearing token");
      });
    });

    describe("clearUser", () => {
      it("should clear the user and token", () => {
        // GIVEN a user and token are set
        const givenUser = getMockTabiyaUser();
        const givenToken = "mock-token-123";
        service.setUser(givenUser);
        service.setToken(givenToken);
        jest.spyOn(PersistentStorageService, "getToken").mockReturnValueOnce(null);
        // guard
        expect(service.getUser()).not.toBeNull();
        expect(service.getToken()).not.toBeNull();

        // WHEN clearUser is called
        service.clearUser();

        // THEN expect the user to be null
        expect(service.getUser()).toBeNull();
        // AND expect the token to be null
        expect(service.getToken()).toBeNull();
        // AND expect persistent storage to be cleared
        expect(PersistentStorageService.clearToken).toHaveBeenCalled();
      });
    });
  });
}); 