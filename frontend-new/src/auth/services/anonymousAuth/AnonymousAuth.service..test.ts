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
    test("should call firebase signOut on successful logout", async () => {
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

    test("should throw on logout failure", async () => {
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
    test("should return token on successful anonymous login", async () => {
      // GIVEN the user is logged in anonymously
      jest.spyOn(firebase.auth(), "signInAnonymously").mockResolvedValue({
        user: { getIdToken: jest.fn().mockResolvedValue("foo") },
      } as unknown as firebase.auth.UserCredential);

      // WHEN the anonymous login is attempted
      const anonymousLoginCallback = async () => await authService.handleAnonymousLogin();

      // THEN test should return the token
      await expect(anonymousLoginCallback()).resolves.toBe("foo");

      // THEN test should call the firebase signInAnonymously function
      expect(firebase.auth().signInAnonymously).toHaveBeenCalled();
    });

    test("should call failureCallback on anonymous login failure", async () => {
      // GIVEN the user is not able to log in anonymously
      jest.spyOn(firebase.auth(), "signInAnonymously").mockRejectedValue({
        code: "auth/internal-error",
        message: "Internal error",
      });

      // WHEN the anonymous login is attempted
      const anonymousLoginCallback = async () => await authService.handleAnonymousLogin();

      // THEN the login should throw an error
      await expect(anonymousLoginCallback()).rejects.toThrow("Internal error");

      // THEN test should call the firebase signInAnonymously function
      expect(firebase.auth().signInAnonymously).toHaveBeenCalled();
    });

    test("should throw an error when the firebase signInAnonymously method fails to return a user", async () => {
      // GIVEN the user is not able to log in anonymously
      jest.spyOn(firebase.auth(), "signInAnonymously").mockResolvedValue({
        user: null,
      } as unknown as firebase.auth.UserCredential);

      // WHEN the anonymous login is attempted
      const anonymousLoginCallback = async () => await authService.handleAnonymousLogin();

      // THEN the error callback should be called with Failed to Fetch
      await expect(anonymousLoginCallback()).rejects.toThrow("User not found");
    });
  });
});
