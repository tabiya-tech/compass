// mute chatty console
import "src/_test_utilities/consoleMock";
import { AnonymousAuthService } from "src/auth/anonymousAuth/AnonymousAuthService/AnonymousAuth.service";
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

      const successCallback = jest.fn();
      const errorCallback = jest.fn();

      // WHEN the logout is attempted
      await authService.handleLogout(successCallback, errorCallback);

      // THEN test should call the firebase signOut function
      expect(firebase.auth().signOut).toHaveBeenCalled();
      // AND test should call the success callback
      expect(successCallback).toHaveBeenCalled();
      // AND test should not call the error callback
      expect(errorCallback).not.toHaveBeenCalled();
    });

    test("should call errorCallback on logout failure", async () => {
      // GIVEN the user is logged in
      jest.spyOn(firebase.auth(), "signOut").mockRejectedValueOnce(new Error("Logout failed"));

      const successCallback = jest.fn();
      const errorCallback = jest.fn();

      // WHEN the logout is attempted
      await authService.handleLogout(successCallback, errorCallback);

      // THEN test should call the firebase signOut function
      expect(firebase.auth().signOut).toHaveBeenCalled();
      // AND test should not call the success callback
      expect(successCallback).not.toHaveBeenCalled();
      // AND test should call the error callback
      expect(errorCallback).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe("handleAnonymousLogin", () => {
    test("should call successCallback with user data on successful anonymous login", async () => {
      // GIVEN the user is logged in anonymously
      jest.spyOn(firebase.auth(), "signInAnonymously").mockResolvedValue({
        user: { getIdToken: jest.fn().mockResolvedValue("foo") },
      } as unknown as firebase.auth.UserCredential);

      const successCallback = jest.fn();
      const errorCallback = jest.fn();

      // WHEN the anonymous login is attempted
      await authService.handleAnonymousLogin(successCallback, errorCallback);

      // THEN test should call the firebase signInAnonymously function
      expect(firebase.auth().signInAnonymously).toHaveBeenCalled();
      // AND test should call the success callback with the user data
      expect(successCallback).toHaveBeenCalledWith({ access_token: "foo", expires_in: 3600 });
      // AND test should not call the error callback
      expect(errorCallback).not.toHaveBeenCalled();
    });

    test("should call errorCallback on anonymous login failure", async () => {
      // GIVEN the user is not able to log in anonymously
      jest.spyOn(firebase.auth(), "signInAnonymously").mockRejectedValue(new Error("Anonymous login failed"));

      const successCallback = jest.fn();
      const errorCallback = jest.fn();

      // WHEN the anonymous login is attempted
      await authService.handleAnonymousLogin(successCallback, errorCallback);

      // THEN test should call the firebase signInAnonymously function
      expect(firebase.auth().signInAnonymously).toHaveBeenCalled();
      // AND test should not call the success callback
      expect(successCallback).not.toHaveBeenCalled();
      // AND test should call the error callback
      expect(errorCallback).toHaveBeenCalledWith(expect.any(Error));
    });

    test("should throw a Failed to Fetch error when the firebase signInAnonymously method fails to return a user", async () => {
      // GIVEN the user is not able to log in anonymously
      jest.spyOn(firebase.auth(), "signInAnonymously").mockResolvedValue({
        user: null,
      } as unknown as firebase.auth.UserCredential);

      const successCallback = jest.fn();
      const errorCallback = jest.fn();

      // WHEN the anonymous login is attempted
      await authService.handleAnonymousLogin(successCallback, errorCallback);
      // THEN the error callback should be called with Failed to Fetch
      expect(errorCallback).toHaveBeenCalledWith(new Error("There is no user record corresponding to this email."));
    });
  });
});
