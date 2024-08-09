// mute chatty console
import "src/_test_utilities/consoleMock";
import { EmailAuthService } from "src/auth/services/emailAuth/EmailAuth.service";
import { jwtDecode } from "jwt-decode";
import firebase from "firebase/compat/app";

jest.mock("jwt-decode");

jest.mock("firebase/compat/app", () => {
  return {
    initializeApp: jest.fn(),
    auth: jest.fn().mockReturnValue({
      signInWithCustomToken: jest.fn(),
      signInWithEmailAndPassword: jest.fn(),
      createUserWithEmailAndPassword: jest.fn(),
      signInAnonymously: jest.fn(),
      signOut: jest.fn(),
    }),
  };
});

jest.useFakeTimers();

describe("AuthService class tests", () => {
  let authService: EmailAuthService;

  beforeAll(() => {
    authService = EmailAuthService.getInstance();
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
      const failureCallback = jest.fn();

      // WHEN the logout is attempted
      await authService.handleLogout(successCallback, failureCallback);

      // THEN test should call the firebase signOut function
      expect(firebase.auth().signOut).toHaveBeenCalled();
      // AND test should call the success callback
      expect(successCallback).toHaveBeenCalled();
      // AND test should not call the error callback
      expect(failureCallback).not.toHaveBeenCalled();
    });

    test("should call failureCallback on logout failure", async () => {
      // GIVEN the user is logged in
      jest.spyOn(firebase.auth(), "signOut").mockRejectedValueOnce({
        code: "auth/internal-error",
        message: "Internal error",
      });

      const successCallback = jest.fn();
      const failureCallback = jest.fn();

      // WHEN the logout is attempted
      await authService.handleLogout(successCallback, failureCallback);

      // THEN test should call the firebase signOut function
      expect(firebase.auth().signOut).toHaveBeenCalled();
      // AND test should not call the success callback
      expect(successCallback).not.toHaveBeenCalled();
      // AND test should call the error callback
      expect(failureCallback).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe("handleLoginWithEmail", () => {
    const givenEmail = "foo@bar.baz";
    const givenPassword = "password";
    const givenUser = { email: givenEmail, userId: "123" };
    const givenTokenResponse = "foo";

    test("should call successCallback with user data on successful login for a user with a verified email", async () => {
      // GIVEN the login credentials are correct
      const mockUser = {
        getIdToken: jest.fn().mockResolvedValue(givenTokenResponse),
        emailVerified: true,
      } as Partial<firebase.User>;
      jest.spyOn(firebase.auth(), "signInWithEmailAndPassword").mockResolvedValue({
        user: mockUser,
      } as firebase.auth.UserCredential);

      const successCallback = jest.fn();
      const failureCallback = jest.fn();
      // AND the token is decoded without any errors
      (jwtDecode as jest.Mock).mockReturnValueOnce(givenUser);

      // WHEN the login is attempted
      await authService.handleLoginWithEmail(givenEmail, givenPassword, successCallback, failureCallback);

      // THEN test should call the firebase login function with the given email and password
      expect(firebase.auth().signInWithEmailAndPassword).toHaveBeenCalledWith(givenEmail, givenPassword);
      // AND test should call the success callback with the user data
      expect(successCallback).toHaveBeenCalledWith(givenTokenResponse);
      // AND test should not call the error callback
      expect(failureCallback).not.toHaveBeenCalled();
    });

    test("should call failureCallback on login failure", async () => {
      // GIVEN the login credentials are incorrect
      jest.spyOn(firebase.auth(), "signInWithEmailAndPassword").mockRejectedValue({
        code: "auth/internal-error",
        message: "Internal error",
      });
      const successCallback = jest.fn();
      const failureCallback = jest.fn();

      // WHEN the login is attempted
      await authService.handleLoginWithEmail(givenEmail, givenPassword, successCallback, failureCallback);

      // THEN test should call the firebase login function with the given email and password
      expect(firebase.auth().signInWithEmailAndPassword).toHaveBeenCalledWith(givenEmail, givenPassword);
      // AND test should not call the success callback
      expect(successCallback).not.toHaveBeenCalled();
      // AND test should call the error callback
      expect(failureCallback).toHaveBeenCalledWith(expect.any(Error));
    });

    test("should throw an error when the email is not verified", async () => {
      // GIVEN the login credentials are correct but the email is not verified
      const mockUser = {
        getIdToken: jest.fn().mockResolvedValue(givenTokenResponse),
        emailVerified: false,
      } as Partial<firebase.User>;
      jest.spyOn(firebase.auth(), "signInWithEmailAndPassword").mockResolvedValue({
        user: mockUser,
      } as firebase.auth.UserCredential);

      const successCallback = jest.fn();
      const failureCallback = jest.fn();

      // WHEN the login is attempted
      await authService.handleLoginWithEmail(givenEmail, givenPassword, successCallback, failureCallback);

      // THEN the error callback should be called with Email not verified
      await expect(failureCallback).toHaveBeenCalledWith(new Error("Email not verified"));

      // AND the success callback should not be called
      await expect(successCallback).not.toHaveBeenCalled();
    });

    test("should throw a Failed to Fetch error when the firebase signIn method fails to return a user", async () => {
      // GIVEN the login credentials are incorrect
      jest.spyOn(firebase.auth(), "signInWithEmailAndPassword").mockResolvedValue({
        user: null,
      } as firebase.auth.UserCredential);

      const successCallback = jest.fn();
      const failureCallback = jest.fn();

      // WHEN the login is attempted
      await authService.handleLoginWithEmail(givenEmail, givenPassword, successCallback, failureCallback);
      // THEN the error callback should be called with Failed to Fetch
      await expect(failureCallback).toHaveBeenCalledWith(new Error("User not found"));
    });
  });

  describe("handleRegisterWithEmail", () => {
    const givenEmail = "foo@bar.baz";
    const givenPassword = "password";
    const givenName = "foo";
    const givenUser = { email: givenEmail, userId: "123" };
    const givenTokenResponse = "foo";

    test("should call successCallback with user data on successful registration", async () => {
      // GIVEN the registration credentials are correct
      const mockUser = {
        getIdToken: jest.fn().mockResolvedValue(givenTokenResponse),
        updateProfile: jest.fn(),
        sendEmailVerification: jest.fn(),
      } as Partial<firebase.User>;
      jest.spyOn(firebase.auth(), "createUserWithEmailAndPassword").mockResolvedValue({
        user: mockUser,
      } as firebase.auth.UserCredential);

      const successCallback = jest.fn();
      const failureCallback = jest.fn();
      // AND the token is decoded without any errors
      (jwtDecode as jest.Mock).mockReturnValueOnce(givenUser);

      // WHEN the registration is attempted
      await authService.handleRegisterWithEmail(givenEmail, givenPassword, givenName, successCallback, failureCallback);

      // THEN test should call the firebase registration function with the given email and password
      expect(firebase.auth().createUserWithEmailAndPassword).toHaveBeenCalledWith(givenEmail, givenPassword);
      // AND test should call the success callback with the user data
      expect(successCallback).toHaveBeenCalled();
      // AND test should not call the error callback
      expect(failureCallback).not.toHaveBeenCalled();
    });

    test("should call failureCallback on registration failure", async () => {
      // GIVEN the registration credentials are incorrect
      jest.spyOn(firebase.auth(), "createUserWithEmailAndPassword").mockRejectedValue({
        code: "auth/internal-error",
        message: "Internal error",
      });
      const successCallback = jest.fn();
      const failureCallback = jest.fn();

      // WHEN the registration is attempted
      await authService.handleRegisterWithEmail(givenEmail, givenPassword, givenName, successCallback, failureCallback);

      // THEN test should call the firebase registration function with the given email and password
      expect(firebase.auth().createUserWithEmailAndPassword).toHaveBeenCalledWith(givenEmail, givenPassword);
      // AND test should not call the success callback
      expect(successCallback).not.toHaveBeenCalled();
      // AND test should call the error callback
      expect(failureCallback).toHaveBeenCalledWith(expect.any(Error));
    });

    test("should throw a Failed to Fetch error when the firebase createUserWithEmailAndPassword method fails to return a user", async () => {
      // GIVEN the registration credentials are incorrect
      jest.spyOn(firebase.auth(), "createUserWithEmailAndPassword").mockResolvedValue({
        user: null,
      } as firebase.auth.UserCredential);

      const successCallback = jest.fn();
      const failureCallback = jest.fn();

      // WHEN the registration is attempted
      await authService.handleRegisterWithEmail(givenEmail, givenPassword, givenName, successCallback, failureCallback);
      // THEN the error callback should be called with Failed to Fetch
      expect(failureCallback).toHaveBeenCalledWith(new Error("User not found"));
    });
  });
});
