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

      // WHEN the logout is attempted
      const logoutCallback = async () => await authService.handleLogout();

      // THEN expect the logut to be successful
      await expect(logoutCallback()).resolves.toBeUndefined();
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

      // THEN expect the logut to throw an error
      await expect(logoutCallback()).rejects.toThrow("auth/internal-error");
      // AND test should call the firebase signOut function
      expect(firebase.auth().signOut).toHaveBeenCalled();
    });
  });

  describe("handleLoginWithEmail", () => {
    const givenEmail = "foo@bar.baz";
    const givenPassword = "password";
    const givenUser = { email: givenEmail, userId: "123" };
    const givenTokenResponse = "foo";

    test("should return the token on successful login for a user with a verified email", async () => {
      // GIVEN the login credentials are correct
      const mockUser = {
        getIdToken: jest.fn().mockResolvedValue(givenTokenResponse),
        emailVerified: true,
      } as Partial<firebase.User>;
      jest.spyOn(firebase.auth(), "signInWithEmailAndPassword").mockResolvedValue({
        user: mockUser,
      } as firebase.auth.UserCredential);
      // AND the token is decoded without any errors
      (jwtDecode as jest.Mock).mockReturnValueOnce(givenUser);

      // WHEN the login is attempted
      const loginCallback = async () => await authService.handleLoginWithEmail(givenEmail, givenPassword);

      // AND test should return the token
      await expect(loginCallback()).resolves.toBe(givenTokenResponse);
    });

    test("should throw an error on login failure", async () => {
      // GIVEN the login credentials are incorrect
      jest.spyOn(firebase.auth(), "signInWithEmailAndPassword").mockRejectedValue({
        code: "auth/internal-error",
        message: "Internal error",
      });
      // WHEN the login is attempted
      const loginCallback = async () => await authService.handleLoginWithEmail(givenEmail, givenPassword);

      // AND test should throw an error
      await expect(loginCallback()).rejects.toThrow("Internal error");
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

      // WHEN the login is attempted
      const loginCallback = async () => await authService.handleLoginWithEmail(givenEmail, givenPassword);

      // THEN the error callback should be called with Email not verified
      await expect(loginCallback()).rejects.toThrow("Email not verified");
    });

    test("should throw an error when the firebase signIn method fails to return a user", async () => {
      // GIVEN the login credentials are incorrect
      jest.spyOn(firebase.auth(), "signInWithEmailAndPassword").mockResolvedValue({
        user: null,
      } as firebase.auth.UserCredential);

      // WHEN the login is attempted
      const loginCallback = async () => await authService.handleLoginWithEmail(givenEmail, givenPassword);
      // THEN an error should be thrown
      await expect(loginCallback()).rejects.toThrow("User not found");
    });
  });

  describe("handleRegisterWithEmail", () => {
    const givenEmail = "foo@bar.baz";
    const givenPassword = "password";
    const givenName = "foo";
    const givenUser = { email: givenEmail, userId: "123" };
    const givenTokenResponse = "foo";

    test("should return the token on successful registration", async () => {
      // GIVEN the registration credentials are correct
      const mockUser = {
        getIdToken: jest.fn().mockResolvedValue(givenTokenResponse),
        updateProfile: jest.fn(),
        sendEmailVerification: jest.fn(),
      } as Partial<firebase.User>;
      jest.spyOn(firebase.auth(), "createUserWithEmailAndPassword").mockResolvedValue({
        user: mockUser,
      } as firebase.auth.UserCredential);
      // AND the token is decoded without any errors
      (jwtDecode as jest.Mock).mockReturnValueOnce(givenUser);

      // WHEN the registration is attempted
      const registerCallback = async () => await authService.handleRegisterWithEmail(givenEmail, givenPassword, givenName);

      // AND registerWithEmail should return the token
      await expect(registerCallback()).resolves.toBe(givenTokenResponse);
    });

    test("should throw an error on registration failure", async () => {
      // GIVEN the registration credentials are incorrect
      jest.spyOn(firebase.auth(), "createUserWithEmailAndPassword").mockRejectedValue({
        code: "auth/internal-error",
        message: "Internal error",
      });

      // WHEN the registration is attempted
      const registerCallback = async () => await authService.handleRegisterWithEmail(givenEmail, givenPassword, givenName);

      // AND test should throw an error
      await expect(registerCallback()).rejects.toThrow("Internal error");
    });

    test("should throw an error when the firebase createUserWithEmailAndPassword method fails to return a user", async () => {
      // GIVEN the registration credentials are incorrect
      jest.spyOn(firebase.auth(), "createUserWithEmailAndPassword").mockResolvedValue({
        user: null,
      } as firebase.auth.UserCredential);

      // WHEN the registration is attempted
      const registerCallback = async () => await authService.handleRegisterWithEmail(givenEmail, givenPassword, givenName);
      // THEN the registration should throw an error
      await expect(registerCallback()).rejects.toThrow("User not found");
    });
  });
});
