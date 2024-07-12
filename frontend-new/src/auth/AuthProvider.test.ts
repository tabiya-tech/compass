// mute chatty console
import "src/_test_utilities/consoleMock";

import { useContext } from "react";
import { AuthContext, authContextDefaultValue } from "src/auth/AuthProvider";
import { renderHook } from "src/_test_utilities/test-utils";
import { PersistentStorageService } from "src/persistentStorageService/PersistentStorageService";
import * as useTokensHook from "src/auth/hooks/useTokens";
import { act } from "@testing-library/react";
import { mockLoggedInUser } from "src/_test_utilities/mockLoggedInUser";
import { defaultUseTokensResponse } from "src/auth/hooks/useTokens";
import { AuthService } from "./services/AuthService/AuthService";

jest.mock("src/auth/hooks/useAuthUser");
jest.mock("src/auth/hooks/useTokens");

const clear = jest.spyOn(PersistentStorageService, "clear");

function defaultSetup() {
  mockLoggedInUser({});

  (useTokensHook.useTokens as jest.Mock).mockReturnValue(defaultUseTokensResponse);
}

const renderAuthContext = () => renderHook(() => useContext(AuthContext));

describe("AuthProvider module", () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = AuthService.getInstance();
    jest.useFakeTimers(); // Use Jest's fake timers
  });

  afterEach(() => {
    jest.clearAllMocks(); // Clear all mocks after each test
    jest.useRealTimers(); // Switch back to real timers after each test
  });

  beforeAll(defaultSetup);

  describe("Login functionality", () => {
    test("should call the login url with the correct parameters", async () => {
      // GIVEN: The Auth Provider is rendered and auth context is accessed
      const { result } = renderAuthContext();

      // WHEN the login function is called
      const givenEmail = "foo@bar.baz";
      const givenPassword = "password";
      const givenSuccessCallback = jest.fn();
      const givenErrorCallback = jest.fn();

      const loginSpy = jest.spyOn(authService, "handleLogin");

      //initially isLogging in should be false.
      expect(result.current.isLoggingIn).toBe(false);

      act(() => {
        result.current?.login(givenEmail, givenPassword, givenSuccessCallback, givenErrorCallback);
      });

      // THEN the auth service handleLogin function should be called with the correct parameters
      expect(loginSpy).toHaveBeenCalledWith(givenEmail, givenPassword, expect.any(Function), expect.any(Function));

      // AND isLogging in should be false.
      expect(result.current.isLoggingIn).toBe(false);
    });
  });

  describe("Logout functionality", () => {
    test("it should clear the access token when the logout function is called", async () => {
      const clearTokens = jest.fn();

      (useTokensHook.useTokens as jest.Mock).mockReturnValue({ clearTokens });

      // GIVEN the Auth Provider is rendered and auth context is accessed
      const { result } = renderAuthContext();

      // AND the access token is set
      PersistentStorageService.setAccessToken("foo");

      // WHEN the logout function is called
      act(() => result.current?.logout());

      // THEN the access token should be cleared
      expect(PersistentStorageService.getAccessToken()).toBeNull();

      // AND the clear function should be called
      expect(clear).toHaveBeenCalled();

      // AND clear tokens should be called
      expect(clearTokens).toHaveBeenCalled();
    });
  });

  describe("Register functionality", () => {
    test("should call the register function with the correct parameters", async () => {
      // GIVEN the Auth Provider is rendered and auth context is accessed
      const { result } = renderAuthContext();

      // WHEN the register function is called
      const givenEmail = "foo@bar.baz";
      const givenPassword = "password";
      const givenName = "foo";
      const givenSuccessCallback = jest.fn();
      const givenErrorCallback = jest.fn();

      const registerSpy = jest.spyOn(authService, "handleRegister");

      // Initially isRegistering should be false.
      expect(result.current.isRegistering).toBe(false);

      act(() => {
        result.current?.register(givenEmail, givenPassword, givenName, givenSuccessCallback, givenErrorCallback);
      });

      // THEN the auth service handleRegister function should be called with the correct parameters
      expect(registerSpy).toHaveBeenCalledWith(
        givenEmail,
        givenPassword,
        givenName,
        expect.any(Function),
        expect.any(Function)
      );

      // AND isRegistering in should be false.
      expect(result.current.isRegistering).toBe(false);
    });
  });

  describe("authContextDefaultValue", () => {
    test("should return the default values", () => {
      // GIVEN: Default values for the AuthContext
      const givenAuthContextDefaultValue = authContextDefaultValue;

      // THEN: The default values should be as expected
      expect(givenAuthContextDefaultValue.user).toBeNull();
    });
  });
});
