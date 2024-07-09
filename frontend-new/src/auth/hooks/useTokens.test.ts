import "src/_test_utilities/consoleMock";
import { useTokens } from "src/auth/hooks/useTokens";
import { renderHook, act, waitFor } from "@testing-library/react";
import { PersistentStorageService } from "src/persistentStorageService/PersistentStorageService";
import firebase from "firebase/compat/app";

import "src/_test_utilities/firebaseMock";

const TOKEN_VALUE = "foo";

const updateUserByIDToken = jest.fn();
const params = { updateUserByIDToken };

jest.mock("src/persistentStorageService/PersistentStorageService", () => {
  return {
    __esModule: true,
    PersistentStorageService: {
      getAccessToken: jest.fn(),
      clearAccessToken: jest.fn(),
      setAccessToken: jest.fn(),
      clear: jest.fn(),
    },
  };
});

describe("useTokens hook tests", () => {
  beforeEach(() => {
    // Mock Firebase's currentUser.getIdToken
    (firebase.auth().currentUser?.getIdToken as jest.Mock).mockResolvedValueOnce(TOKEN_VALUE);

    // Mock Firebase's onIdTokenChanged
    (firebase.auth().onAuthStateChanged as jest.Mock).mockImplementation((callback) => {
      callback({
        getIdToken: jest.fn().mockResolvedValueOnce(TOKEN_VALUE),
      });
      return jest.fn(); // Return a function to simulate the unsubscribe function
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("It should call the AuthPersistentStorage.clear", () => {
    // GIVEN: The hook is used in a component
    const { result } = renderHook(() => useTokens(params));

    // WHEN clear all tokens is called
    act(() => {
      result.current.clearTokens();
    });

    // THEN the storage should be cleared
    expect(PersistentStorageService.clear).toHaveBeenCalled();
  });

  describe("Refreshing of tokens", () => {
    beforeEach(() => {
      PersistentStorageService.clear();
      jest.clearAllMocks();
    });

    test("It should call getIdToken on the current user and set the new Id token", async () => {
      // GIVEN the useTokens hook is used in a component
      const { result } = renderHook(() => useTokens(params));

      // Mock Firebase's currentUser.getIdToken
      (firebase.auth().currentUser?.getIdToken as jest.Mock).mockResolvedValueOnce(TOKEN_VALUE);

      // Mock Firebase's onIdTokenChanged
      (firebase.auth().onAuthStateChanged as jest.Mock).mockImplementation((callback) => {
        callback({
          getIdToken: jest.fn().mockResolvedValueOnce(TOKEN_VALUE),
        });
        return jest.fn(); // Return a function to simulate the unsubscribe function
      });

      // THEN the token should be fetched and set
      await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

      // THE updated user by ID token should be called
      expect(updateUserByIDToken).toHaveBeenCalledWith(TOKEN_VALUE);

      // AND the refreshing should stop
      expect(result.current.isAuthenticating).toBe(false);
    });

    test("It should call the unsubscribe callback when component is unmounted", async () => {
      // GIVEN the hook is used in a component
      const unsubscribe = jest.fn();
      (firebase.auth().onAuthStateChanged as jest.Mock).mockReturnValue(unsubscribe);

      const { unmount } = renderHook(() => useTokens(params));

      // WHEN the component is unmounted
      unmount();

      // THEN the unsubscribe function should be called
      expect(unsubscribe).toHaveBeenCalled();
    });

    test("It should handle token change correctly", async () => {
      // GIVEN the useTokens hook is used in a component
      const { result } = renderHook(() => useTokens(params));

      // Mock Firebase's onIdTokenChanged
      const idTokenChangedCallback = (callback: (user: any) => void) => {
        callback({
          getIdToken: jest.fn().mockResolvedValueOnce(TOKEN_VALUE),
        });
        return jest.fn();
      };
      (firebase.auth().onAuthStateChanged as jest.Mock).mockImplementation(idTokenChangedCallback);

      // THEN the token should be fetched and set
      await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

      // THE updated user by ID token should be called
      expect(updateUserByIDToken).toHaveBeenCalledWith(TOKEN_VALUE);

      // AND the refreshing should stop
      expect(result.current.isAuthenticating).toBe(false);
    });
  });

  test("It should not refresh the token if already authenticated", async () => {
    // GIVEN the useTokens hook is used in a component and is already authenticated
    const { result } = renderHook(() => useTokens(params));

    // Set the authenticated state to true
    result.current.setIsAuthenticated(true);

    // Reset the call count for getIdToken mock
    (firebase.auth().currentUser?.getIdToken as jest.Mock).mockClear();

    // WHEN the tokens refreshing process is triggered
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

    // THEN the token should not be refreshed
    expect(firebase.auth().currentUser?.getIdToken).not.toHaveBeenCalled();
  });

  test("onIdTokenChanged should clear storage and set isAuthenticated to false when there is no user", async () => {
    // Mock Firebase's onIdTokenChanged to call the callback with no user
    (firebase.auth().onAuthStateChanged as jest.Mock).mockImplementation((callback) => {
      callback(null); // No user
      return jest.fn(); // Return a function to simulate the unsubscribe function
    });

    // GIVEN the useTokens hook is used in a component
    const { result } = renderHook(() => useTokens(params));

    // WHEN the onIdTokenChanged is triggered
    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(false);
    });

    // THEN the storage should be cleared
    expect(PersistentStorageService.clear).toHaveBeenCalled();
    // AND the user should not be authenticated
    expect(result.current.isAuthenticated).toBe(false);
  });
});
