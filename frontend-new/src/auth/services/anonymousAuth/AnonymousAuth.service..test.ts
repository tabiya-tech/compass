// mute chatty console
import "src/_test_utilities/consoleMock";
import { AnonymousAuthService } from "src/auth/services/anonymousAuth/AnonymousAuth.service";
import firebase from "firebase/compat/app";

jest.mock("jwt-decode");

jest.mock("firebase/compat/app", () => {
  return {
    initializeApp: jest.fn(),
    auth: jest.fn().mockReturnValue({
      signInWithCustomToken: jest.fn(),
      signInWithAnonymousAndPassword: jest.fn(),
      createUserWithAnonymousAndPassword: jest.fn(),
      signInAnonymously: jest.fn(),
      signOut: jest.fn(),
    }),
  };
});

jest.useFakeTimers();

describe("AuthService class tests", () => {
  let authService: AnonymousAuthService;

  beforeAll(() => {
    authService = AnonymousAuthService.getInstance();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("handleLogout", () => {
    test("should call successCallback on successful logout", async () => {
      // GIVEN the user is logged in
      const mockSignOut = jest.fn();
      jest.spyOn(firebase.auth(), "signOut").mockImplementation(mockSignOut);

      // WHEN the logout is attempted
      const logoutCallback = async () => await authService.handleLogout();

      // THEN the logout should succeed
      await expect(logoutCallback()).resolves.toBeUndefined()
      // AND test should call the firebase signOut function
      expect(firebase.auth().signOut).toHaveBeenCalled();
    });

    test("should call failureCallback on logout failure", async () => {
      // GIVEN the user is logged in
      jest.spyOn(firebase.auth(), "signOut").mockRejectedValueOnce({
        code: "auth/internal-error",
        message: "Internal error",
      });


      // WHEN the logout is attempted
      const logoutCallback = async () => await authService.handleLogout();

      // THEN expect the logout to throw an error
      await expect(logoutCallback()).rejects.toThrow("auth/internal-error")

      // AND test should call the firebase signOut function
      expect(firebase.auth().signOut).toHaveBeenCalled();
    });
  });

  describe("handleAnonymousLogin", () => {
    test("should call successCallback with user data on successful anonymous login", async () => {
      // GIVEN the user is logged in anonymously
      jest.spyOn(firebase.auth(), "signInAnonymously").mockResolvedValue({
        user: { getIdToken: jest.fn().mockResolvedValue("foo") },
      } as unknown as firebase.auth.UserCredential);

      const successCallback = jest.fn();
      const failureCallback = jest.fn();

      // WHEN the anonymous login is attempted
      await authService.handleAnonymousLogin(successCallback, failureCallback);

      // THEN test should call the firebase signInAnonymously function
      expect(firebase.auth().signInAnonymously).toHaveBeenCalled();
      // AND test should call the success callback with the user data
      expect(successCallback).toHaveBeenCalledWith("foo");
      // AND test should not call the error callback
      expect(failureCallback).not.toHaveBeenCalled();
    });

    test("should call failureCallback on anonymous login failure", async () => {
      // GIVEN the user is not able to log in anonymously
      jest.spyOn(firebase.auth(), "signInAnonymously").mockRejectedValue({
        code: "auth/internal-error",
        message: "Internal error",
      });

      const successCallback = jest.fn();
      const failureCallback = jest.fn();

      // WHEN the anonymous login is attempted
      await authService.handleAnonymousLogin(successCallback, failureCallback);

      // THEN test should call the firebase signInAnonymously function
      expect(firebase.auth().signInAnonymously).toHaveBeenCalled();
      // AND test should not call the success callback
      expect(successCallback).not.toHaveBeenCalled();
      // AND test should call the error callback
      expect(failureCallback).toHaveBeenCalledWith(expect.any(Error));
    });

    test("should throw a Failed to Fetch error when the firebase signInAnonymously method fails to return a user", async () => {
      // GIVEN the user is not able to log in anonymously
      jest.spyOn(firebase.auth(), "signInAnonymously").mockResolvedValue({
        user: null,
      } as unknown as firebase.auth.UserCredential);

      const successCallback = jest.fn();
      const failureCallback = jest.fn();

      // WHEN the anonymous login is attempted
      await authService.handleAnonymousLogin(successCallback, failureCallback);
      // THEN the error callback should be called with Failed to Fetch
      expect(failureCallback).toHaveBeenCalledWith(new Error("User not found"));
    });
  });
});
