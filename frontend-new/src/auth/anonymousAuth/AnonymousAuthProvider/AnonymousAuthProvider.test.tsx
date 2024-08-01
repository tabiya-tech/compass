// mute chatty console
import "src/_test_utilities/consoleMock";

import { useContext } from "react";
import {
  AnonymousAuthContext,
  anonymousAuthContextDefaultValue,
} from "src/auth/anonymousAuth/AnonymousAuthProvider/AnonymousAuthProvider";
import { renderHook, act, waitFor } from "src/_test_utilities/test-utils";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import * as useTokensHook from "src/auth/hooks/useTokens";
import { mockLoggedInUser } from "src/_test_utilities/mockLoggedInUser";
import { defaultUseTokensResponse } from "src/auth/hooks/useTokens";
import { AnonymousAuthService } from "src/auth/anonymousAuth/AnonymousAuthService/AnonymousAuth.service";

jest.mock("src/auth/hooks/useAuthUser");
jest.mock("src/auth/hooks/useTokens");

const clear = jest.spyOn(PersistentStorageService, "clear");

function defaultSetup() {
  mockLoggedInUser({});

  (useTokensHook.useTokens as jest.Mock).mockReturnValue(defaultUseTokensResponse);
}

const renderAnonymousAuthContext = () => renderHook(() => useContext(AnonymousAuthContext));

describe("AnonymousAuthProvider module", () => {
  let authService: AnonymousAuthService;

  beforeEach(() => {
    authService = AnonymousAuthService.getInstance();
    jest.useFakeTimers(); // Use Jest's fake timers
  });

  afterEach(() => {
    jest.clearAllMocks(); // Clear all mocks after each test
    jest.useRealTimers(); // Switch back to real timers after each test
  });

  beforeAll(defaultSetup);

  describe("Logout functionality", () => {
    test("it should clear the access token, session ids and call the success callback when the logout function is called", async () => {
      const clearTokens = jest.fn();

      (useTokensHook.useTokens as jest.Mock).mockReturnValue({ clearTokens });

      // GIVEN the Auth Provider is rendered and auth context is accessed
      const { result } = renderAnonymousAuthContext();
      // AND some callback functions
      const givenSuccessCallback = jest.fn();
      const givenErrorCallback = jest.fn();

      // AND the access token is set
      PersistentStorageService.setToken("foo");
      const logoutSpy = jest.spyOn(authService, "handleLogout");

      // WHEN the logout function is called
      act(() => result.current?.logout(givenSuccessCallback, givenErrorCallback));

      // THEN the access token should be cleared
      expect(PersistentStorageService.getToken()).toBeNull();
      // AND the session ids should be cleared
      expect(PersistentStorageService.getUserPreferences()).toBeNull();

      // AND the clear function should be called
      expect(clear).toHaveBeenCalled();

      // AND the success callback should be called
      expect(logoutSpy).toHaveBeenCalledWith(givenSuccessCallback, givenErrorCallback);

      // AND clear tokens should be called
      expect(clearTokens).toHaveBeenCalled();
    });
  });

  describe("Anonymously login functionality", () => {
    test("should call the login anonymously function", async () => {
      // GIVEN the Auth Provider is rendered and auth context is accessed
      const { result } = renderAnonymousAuthContext();

      // AND some callback functions
      const givenSuccessCallback = jest.fn();
      const givenErrorCallback = jest.fn();

      // WHEN the login anonymously function is called
      const loginSpy = jest.spyOn(authService, "handleAnonymousLogin");

      //initially isLogging in should be false.
      expect(result.current.isLoggingInAnonymously).toBe(false);

      act(() => {
        result.current?.loginAnonymously(givenSuccessCallback, givenErrorCallback);
      });

      // THEN the auth service handleLogin function should be called with the correct parameters
      expect(loginSpy).toHaveBeenCalledWith(expect.any(Function), expect.any(Function));

      // AND isLogging in should be false.
      expect(result.current.isLoggingInAnonymously).toBe(false);
    });

    test("should call the failure callback when the service login anonymously fails", async () => {
      // GIVEN the Auth Provider is rendered and auth context is accessed
      const { result } = renderAnonymousAuthContext();

      // AND some callback functions
      const givenSuccessCallback = jest.fn();
      const givenErrorCallback = jest.fn();

      // WHEN the login anonymously function is called

      const loginSpy = jest.spyOn(authService, "handleAnonymousLogin");
      const loginError = new Error("Login anonymously failed");
      //@ts-ignore
      loginSpy.mockImplementationOnce((_successCallback, errorCallback) => {
        return Promise.resolve().then(() => errorCallback(loginError));
      });

      //initially isLogging in should be false.
      expect(result.current.isLoggingInAnonymously).toBe(false);

      act(() => {
        result.current?.loginAnonymously(givenSuccessCallback, givenErrorCallback);
      });

      // THEN the auth service handleLogin function should be called with the correct parameters
      expect(loginSpy).toHaveBeenCalledWith(expect.any(Function), expect.any(Function));

      // AND isLogging in should be false.
      await waitFor(() => {
        expect(result.current.isLoggingInAnonymously).toBe(false);
      });

      // AND the error callback should be called
      expect(givenErrorCallback).toHaveBeenCalledWith(loginError);
    });
  });

  describe("authContextDefaultValue", () => {
    test("should return the default values", () => {
      // GIVEN: Default values for the AuthContext
      const givenAuthContextDefaultValue = anonymousAuthContextDefaultValue;

      // THEN: The default values should be as expected
      expect(givenAuthContextDefaultValue.user).toBeNull();
    });
  });
});
