// mute chatty console
import "src/_test_utilities/consoleMock";
import FirebaseEmailAuthenticationService from "src/auth/services/FirebaseAuthenticationService/emailAuth/FirebaseEmailAuthentication.service";
import firebase from "firebase/compat/app";
import { invitationsService } from "src/auth/services/invitationsService/invitations.service";
import { InvitationStatus, InvitationType } from "src/auth/services/invitationsService/invitations.types";
import { UserPreference } from "src/userPreferences/UserPreferencesService/userPreferences.types";
import UserPreferencesService from "src/userPreferences/UserPreferencesService/userPreferences.service";
import AuthenticationStateService from "src/auth/services/AuthenticationState.service";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { resetAllMethodMocks } from "src/_test_utilities/resetAllMethodMocks";
import { FirebaseError } from "src/error/FirebaseError/firebaseError";
import { FirebaseErrorCodes } from "src/error/FirebaseError/firebaseError.constants";
import StdFirebaseAuthenticationService from "src/auth/services/FirebaseAuthenticationService/StdFirebaseAuthenticationService";
import { AuthChannelMessage } from "src/auth/services/authBroadcastChannel/authBroadcastChannel";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";

jest.mock("firebase/compat/app", () => {
  return {
    initializeApp: jest.fn(),
    auth: jest.fn().mockReturnValue({
      signInWithCustomToken: jest.fn(),
      signInWithEmailAndPassword: jest.fn(),
      createUserWithEmailAndPassword: jest.fn(),
      signInAnonymously: jest.fn(),
      signOut: jest.fn(),
      onAuthStateChanged: jest.fn(),
      sendPasswordResetEmail: jest.fn(),
      get currentUser() {
        return jest.fn();
      },
    }),
  };
});

jest.mock("src/auth/services/invitationsService/invitations.service", () => {
  return {
    invitationsService: {
      checkInvitationCodeStatus: jest.fn(),
    },
  };
});

// mock authBroadcastChannel
const mockBroadcast = jest.fn();
jest.mock("src/auth/services/authBroadcastChannel/authBroadcastChannel.ts", () => {
  return {
    AuthChannelMessage: { LOGOUT_USER: "LOGOUT_USER", LOGIN_USER: "LOGIN_USER" },
    AuthBroadcastChannel: {
      getInstance: jest.fn(() => ({
        registerListener: jest.fn(),
        broadcast: mockBroadcast,
        closeChannel: jest.fn(),
      })),
    },
  };
});

describe("AuthService class tests", () => {
  const authService: FirebaseEmailAuthenticationService = FirebaseEmailAuthenticationService.getInstance();

  beforeEach(() => {
    jest.clearAllMocks();
    AuthenticationStateService.getInstance().setUser(null);
    UserPreferencesStateService.getInstance().clearUserPreferences();
    // Reset all method mocks on the singletons that may have been mocked
    // As a good practice, we should the mock*Once() methods to avoid side effects between tests
    // As a precaution, we reset all method mocks to ensure that no side effects are carried over between tests
    resetAllMethodMocks(UserPreferencesService.getInstance());
    resetAllMethodMocks(invitationsService);
    resetAllMethodMocks(StdFirebaseAuthenticationService.getInstance());
  });

  test("should construct a singleton", async () => {
    // WHEN the singleton is constructed
    const instance = FirebaseEmailAuthenticationService.getInstance();

    // THEN the instance should be defined
    expect(instance).toBeDefined();

    // AND WHEN the singleton is constructed again
    const newInstance = FirebaseEmailAuthenticationService.getInstance();

    // THEN the instance should be the same as the first instance
    expect(newInstance).toBe(instance);

    // AND expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  describe("login", () => {
    const givenEmail = "foo@bar.baz";
    const givenPassword = "password";
    const givenUser = { id: "123", name: "Foo Bar ", email: givenEmail };
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

      jest.spyOn(authService, "getUser").mockReturnValue(givenUser);

      // AND the user has some preferences
      const givenUserPreferences: UserPreference = {
        user_id: "foo-id",
        sessions: [],
      } as unknown as UserPreference;
      jest
        .spyOn(UserPreferencesService.getInstance(), "getUserPreferences")
        .mockResolvedValueOnce(givenUserPreferences);

      // WHEN the login is attempted
      const actualToken = await authService.login(givenEmail, givenPassword);

      // AND test should return the token
      expect(actualToken).toEqual(givenTokenResponse);

      // AND the Authentication State should be set
      expect(AuthenticationStateService.getInstance().getUser()).toEqual(givenUser);

      // AND the UserPreference State should be set
      expect(UserPreferencesStateService.getInstance().getUserPreferences()).toEqual(givenUserPreferences);

      // AND a login message should be broadcasted to other tabs
      expect(mockBroadcast).toHaveBeenCalledWith(AuthChannelMessage.LOGIN_USER);

      // AND expect no errors or warning to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should throw an error on login failure", async () => {
      // GIVEN the login credentials are incorrect
      jest.spyOn(firebase.auth(), "signInWithEmailAndPassword").mockRejectedValue({
        code: "auth/internal-error",
        message: "Internal error",
      });
      // WHEN the login is attempted
      const emailLoginPromise = authService.login(givenEmail, givenPassword);

      // AND test should throw an error
      await expect(emailLoginPromise).rejects.toThrow("Internal error");
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

      // AND the logout method logs the user out
      jest.spyOn(StdFirebaseAuthenticationService.getInstance(), "logout");

      // WHEN the login is attempted
      const emailLoginPromise = authService.login(givenEmail, givenPassword);

      // THEN the error callback should be called with Email not verified
      await expect(emailLoginPromise).rejects.toThrow(
        new FirebaseError("EmailAuthService", "login", FirebaseErrorCodes.EMAIL_NOT_VERIFIED, "Email not verified")
      );

      // AND the user should be logged out
      expect(StdFirebaseAuthenticationService.getInstance().logout).toHaveBeenCalled();

      // AND expect no errors or warning to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should throw an error when the firebase signIn method fails to return a user", async () => {
      // GIVEN the login credentials are incorrect
      jest.spyOn(firebase.auth(), "signInWithEmailAndPassword").mockResolvedValue({
        user: null,
      } as firebase.auth.UserCredential);

      // WHEN the login is attempted
      const emailLoginPromise = authService.login(givenEmail, givenPassword);

      // THEN an error should be thrown
      await expect(emailLoginPromise).rejects.toThrow("User not found");

      // AND expect no errors or warning to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should throw an error when the signInWithEmailAndPassword method fails", async () => {
      // GIVEN the signInWithEmailAndPassword method fails
      jest.spyOn(firebase.auth(), "signInWithEmailAndPassword").mockRejectedValue({
        code: "auth/internal-error",
        message: "Internal error",
      });

      // WHEN the login is attempted
      const emailLoginPromise = authService.login(givenEmail, givenPassword);

      // THEN an error should be thrown
      await expect(emailLoginPromise).rejects.toThrow(
        new FirebaseError(
          "EmailAuthService",
          "signInWithEmailAndPassword",
          FirebaseErrorCodes.INTERNAL_ERROR,
          "Internal error"
        )
      );

      // AND expect no errors or warning to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should throw an error is the user's email is not verified when the logout method fails", async () => {
      // GIVEN the logout method fails
      jest.spyOn(StdFirebaseAuthenticationService.getInstance(), "logout").mockRejectedValue({
        code: "auth/internal-error",
        message: "Internal error",
      });

      // AND the signInWithEmailAndPassword method returns a user with an unverified email
      const mockUser = {
        getIdToken: jest.fn().mockResolvedValue(givenTokenResponse),
        emailVerified: false,
      } as Partial<firebase.User>;

      jest.spyOn(firebase.auth(), "signInWithEmailAndPassword").mockResolvedValueOnce({
        user: mockUser,
      } as firebase.auth.UserCredential);

      // WHEN the login is attempted
      const emailLoginPromise = authService.login(givenEmail, givenPassword);

      // THEN an error should be thrown
      await expect(emailLoginPromise).rejects.toThrow(
        new FirebaseError("EmailAuthService", "logout", FirebaseErrorCodes.INTERNAL_ERROR, "Internal error")
      );

      // AND no errors or warnings should be logged
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });
  });

  describe("logout", () => {
    test("should successfully logout a user", async () => {
      // GIVEN the user is logged in with email auth
      PersistentStorageService.setLoginMethod("FIREBASE_EMAIL");

      // AND the logout method resolves
      jest.spyOn(StdFirebaseAuthenticationService.getInstance(), "logout").mockResolvedValueOnce();

      // WHEN logging out the user
      await authService.logout();

      // THEN the StdFirebaseAuthenticationService logout method should be called
      expect(StdFirebaseAuthenticationService.getInstance().logout).toHaveBeenCalled();

      // AND the Authentication State should be cleared
      expect(AuthenticationStateService.getInstance().getUser()).toBeNull();

      // AND the UserPreference State should be cleared
      expect(UserPreferencesStateService.getInstance().getUserPreferences()).toBeNull();

      // AND a logout message should be broadcasted to other tabs
      expect(mockBroadcast).toHaveBeenCalledWith(AuthChannelMessage.LOGOUT_USER);

      // AND no errors or warnings should be logged
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should throw an error if the logout method fails", async () => {
      // GIVEN the user is logged in with email auth
      PersistentStorageService.setLoginMethod("FIREBASE_EMAIL");

      // AND logout method rejects with an error
      jest
        .spyOn(StdFirebaseAuthenticationService.getInstance(), "logout")
        .mockRejectedValueOnce(new Error("Logout failed"));

      // WHEN logging out the user
      const logoutPromise = authService.logout();

      // THEN the logout promise should be rejected with the error
      await expect(logoutPromise).rejects.toThrow("Logout failed");

      // AND the StdFirebaseAuthenticationService logout method should be called
      expect(StdFirebaseAuthenticationService.getInstance().logout).toHaveBeenCalled();

      // AND no errors or warnings should be logged
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });
  });

  describe("register", () => {
    const givenEmail = "foo@bar.baz";
    const givenPassword = "password";
    const givenUserName = "foo";
    const givenUser = { id: "123", name: "Foo", email: givenEmail };
    const givenTokenResponse = "foo";
    const givenRegistrationCode = "foo-bar";

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

      // AND the token is decoded into a user
      jest.spyOn(authService, "getUser").mockReturnValue(givenUser);

      // AND the registration code is valid
      (invitationsService.checkInvitationCodeStatus as jest.Mock).mockResolvedValueOnce({
        status: InvitationStatus.VALID,
        invitation_type: InvitationType.REGISTER,
      });
      // AND the user preferences can be created
      const givenUserPreferences: UserPreference = {
        user_id: "foo-id",
        sessions: [],
      } as unknown as UserPreference;
      jest
        .spyOn(UserPreferencesService.getInstance(), "createUserPreferences")
        .mockResolvedValueOnce(givenUserPreferences);

      // WHEN the registration is attempted
      const actualToken = await authService.register(givenEmail, givenPassword, givenUserName, givenRegistrationCode);

      // AND registerWithEmail should return the token
      expect(actualToken).toEqual(givenTokenResponse);

      // AND expect no errors or warning to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should throw an error on registration failure", async () => {
      // GIVEN the registration credentials are incorrect
      jest.spyOn(firebase.auth(), "createUserWithEmailAndPassword").mockRejectedValue({
        code: "auth/internal-error",
        message: "Internal error",
      });
      // AND the registration code is valid
      (invitationsService.checkInvitationCodeStatus as jest.Mock).mockResolvedValueOnce({
        status: InvitationStatus.VALID,
        invitation_type: InvitationType.REGISTER,
      });

      // WHEN the registration is attempted
      const registerCallback = async () =>
        await authService.register(givenEmail, givenPassword, givenUserName, givenRegistrationCode);

      // AND test should throw an error
      await expect(registerCallback()).rejects.toThrow("Internal error");

      // AND expect no errors or warning to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should throw an error when the firebase createUserWithEmailAndPassword method fails to return a user", async () => {
      // GIVEN the registration credentials are incorrect
      jest.spyOn(firebase.auth(), "createUserWithEmailAndPassword").mockResolvedValue({
        user: null,
      } as firebase.auth.UserCredential);
      // AND the registration code is valid
      (invitationsService.checkInvitationCodeStatus as jest.Mock).mockResolvedValueOnce({
        status: InvitationStatus.VALID,
        invitation_type: InvitationType.REGISTER,
      });

      // WHEN the registration is attempted
      const emailLoginPromise = authService.register(givenEmail, givenPassword, givenUserName, givenRegistrationCode);

      // THEN the registration should throw an error
      await expect(emailLoginPromise).rejects.toThrow("User not found");

      // AND expect no errors or warning to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should throw an error when the registration code is not valid", async () => {
      // GIVEN the registration code is not valid
      (invitationsService.checkInvitationCodeStatus as jest.Mock).mockResolvedValueOnce({
        status: InvitationStatus.VALID,
        invitation_type: InvitationType.LOGIN,
      });

      // WHEN the registration is attempted
      const emailLoginPromise = authService.register(givenEmail, givenPassword, givenUserName, givenRegistrationCode);

      // THEN the registration should throw an error
      await expect(emailLoginPromise).rejects.toThrow(
        "the invitation code is not for registration: " + givenRegistrationCode
      );

      // AND expect no errors or warning to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });
  });

  describe("linkAnonymousAccount", () => {
    const givenEmail = "foo@bar.baz";
    const givenPassword = "password";
    const givenUserName = "foo";
    const givenTokenResponse = "foo";

    test("should successfully link anonymous account with email credentials", async () => {
      // GIVEN there is an anonymous user logged in
      const mockUserAfterLinking = {
        updateProfile: jest.fn().mockResolvedValue(undefined),
        sendEmailVerification: jest.fn().mockResolvedValue(undefined),
        getIdToken: jest.fn().mockResolvedValue(givenTokenResponse),
      };

      const mockAnonymousUser = {
        isAnonymous: true,
        linkWithCredential: jest.fn().mockResolvedValue({
          user: mockUserAfterLinking,
        }),
        sendEmailVerification: jest.fn(),
      };

      // AND the user is currently logged in
      jest.spyOn(firebase.auth(), "currentUser", "get").mockReturnValue(mockAnonymousUser as any);

      // WHEN linking the anonymous account
      const actualToken = await authService.linkAnonymousAccount(givenEmail, givenPassword, givenUserName);

      // THEN the token should be returned
      expect(actualToken).toEqual(givenTokenResponse);

      // AND the user profile should be updated
      expect(mockAnonymousUser.linkWithCredential).toHaveBeenCalled();
      expect(mockUserAfterLinking.updateProfile).toHaveBeenCalledWith({
        displayName: givenUserName,
      });

      // AND email verification should be sent
      expect(mockUserAfterLinking.sendEmailVerification).toHaveBeenCalled();

      // AND expect no errors or warning to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should throw an error when no user is logged in", async () => {
      // GIVEN no user is logged in
      jest.spyOn(firebase.auth(), "currentUser", "get").mockReturnValue(null);

      // WHEN linking the anonymous account
      const linkPromise = authService.linkAnonymousAccount(givenEmail, givenPassword, givenUserName);

      // THEN an error should be thrown
      await expect(linkPromise).rejects.toThrow("No anonymous user is currently logged in");

      // AND expect no errors or warning to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should throw an error when current user is not anonymous", async () => {
      // GIVEN a non-anonymous user is logged in
      const mockNonAnonymousUser = {
        isAnonymous: false,
      };
      jest.spyOn(firebase.auth(), "currentUser", "get").mockReturnValue(mockNonAnonymousUser as any);

      // WHEN linking the anonymous account
      const linkPromise = authService.linkAnonymousAccount(givenEmail, givenPassword, givenUserName);

      // THEN an error should be thrown
      await expect(linkPromise).rejects.toThrow("Current user is not an anonymous user");
      // AND expect no errors or warning to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should throw an error when linking fails", async () => {
      // GIVEN there is an anonymous user logged in
      const mockAnonymousUser = {
        isAnonymous: true,
        linkWithCredential: jest.fn().mockRejectedValue({
          code: "auth/internal-error",
          message: "Internal error",
        }),
      };
      jest.spyOn(firebase.auth(), "currentUser", "get").mockReturnValue(mockAnonymousUser as any);

      // WHEN linking the anonymous account
      const linkPromise = authService.linkAnonymousAccount(givenEmail, givenPassword, givenUserName);

      // THEN an error should be thrown
      await expect(linkPromise).rejects.toThrow("Internal error");
      // AND expect no errors or warning to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should throw an error when linking returns no user", async () => {
      // GIVEN there is an anonymous user logged in
      const mockAnonymousUser = {
        isAnonymous: true,
        linkWithCredential: jest.fn().mockResolvedValue({
          user: null,
        }),
      };
      jest.spyOn(firebase.auth(), "currentUser", "get").mockReturnValue(mockAnonymousUser as any);

      // WHEN linking the anonymous account
      const linkPromise = authService.linkAnonymousAccount(givenEmail, givenPassword, givenUserName);

      // THEN an error should be thrown
      await expect(linkPromise).rejects.toThrow("User not found after linking");
      // AND expect no errors or warning to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });
  });

  describe("resendVerificationEmail", () => {
    test("should successfully resend verification email", async () => {
      // GIVEN a user with an email and password
      const givenEmail = "foo@bar.baz";
      const givenPassword = "password";
      const mockUser = {
        sendEmailVerification: jest.fn(),
        emailVerified: false,
      };
      // AND the user can log in, but is not verified
      jest.spyOn(firebase.auth(), "signInWithEmailAndPassword").mockResolvedValueOnce({
        user: mockUser,
      } as unknown as firebase.auth.UserCredential);

      // WHEN resending the verification email
      await authService.resendVerificationEmail(givenEmail, givenPassword);

      // THEN the user should be logged in with the given email and password
      expect(firebase.auth().signInWithEmailAndPassword).toHaveBeenCalledWith(givenEmail, givenPassword);

      // AND the verification email should be sent
      expect(mockUser.sendEmailVerification).toHaveBeenCalled();

      // AND no errors or warnings should be logged
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should throw an error when the user is already verified", async () => {
      // GIVEN a user with an email and password
      const givenEmail = "foo@bar.baz";
      const givenPassword = "password";

      const mockUser = {
        sendEmailVerification: jest.fn(),
        emailVerified: true,
      };
      // AND the user can log in, and is verified
      jest.spyOn(firebase.auth(), "signInWithEmailAndPassword").mockResolvedValueOnce({
        user: mockUser,
      } as unknown as firebase.auth.UserCredential);

      // WHEN resending the verification email
      const resendPromise = authService.resendVerificationEmail(givenEmail, givenPassword);

      // THEN the error callback should be called with Email already verified
      await expect(resendPromise).rejects.toThrow(
        new FirebaseError(
          "EmailAuthService",
          "resendVerificationEmail",
          FirebaseErrorCodes.EMAIL_ALREADY_VERIFIED,
          "Email already verified"
        )
      );

      // AND no errors or warnings should be logged
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should throw an error when the user is not found in the credentials", async () => {
      // GIVEN a user with an email and password
      const givenEmail = "foo@bar.baz";
      const givenPassword = "password";

      // AND the firebase signInWithEmailAndPassword method fails to return a user
      jest.spyOn(firebase.auth(), "signInWithEmailAndPassword").mockResolvedValueOnce({
        user: null,
      } as unknown as firebase.auth.UserCredential);

      // WHEN resending the verification email
      const resendPromise = authService.resendVerificationEmail(givenEmail, givenPassword);

      // THEN the error callback should be called with User not found
      await expect(resendPromise).rejects.toThrow(
        new FirebaseError(
          "EmailAuthService",
          "signInWithEmailAndPassword",
          FirebaseErrorCodes.USER_NOT_FOUND,
          "User not found"
        )
      );

      // AND no errors or warnings should be logged
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should throw an error if the firebase signInWithEmailAndPassword method fails", async () => {
      // GIVEN a user with an email and password
      const givenEmail = "foo@bar.baz";
      const givenPassword = "password";

      // AND the firebase signInWithEmailAndPassword method fails
      jest.spyOn(firebase.auth(), "signInWithEmailAndPassword").mockRejectedValueOnce({
        code: "auth/internal-error",
        message: "Internal error",
      });

      // WHEN resending the verification email
      const resendPromise = authService.resendVerificationEmail(givenEmail, givenPassword);

      // THEN the error callback should be called with Internal error
      await expect(resendPromise).rejects.toThrow(
        new FirebaseError(
          "EmailAuthService",
          "signInWithEmailAndPassword",
          FirebaseErrorCodes.INTERNAL_ERROR,
          "Internal error"
        )
      );

      // AND no errors or warnings should be logged
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });
  });

  describe("resetPassword", () => {
    test("should send password reset email successfully", async () => {
      // GIVEN a user email and the Firebase method resolves
      const givenEmail = "foo@bar.baz";
      jest.spyOn(firebase.auth(), "sendPasswordResetEmail").mockResolvedValueOnce();

      // WHEN resetting the password
      await authService.resetPassword(givenEmail);

      // THEN it should call Firebase's method with correct email
      expect(firebase.auth().sendPasswordResetEmail).toHaveBeenCalledWith(givenEmail);

      // AND no errors or warnings should be logged
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should throw a FirebaseError if sendPasswordResetEmail fails", async () => {
      // GIVEN a user email and Firebase rejects with a known error
      const givenEmail = "foo@bar.baz";
      const firebaseError = {
        code: "auth/invalid-email",
        message: "Invalid email format",
      };
      jest.spyOn(firebase.auth(), "sendPasswordResetEmail").mockRejectedValueOnce(firebaseError);

      // WHEN resetting the password
      const resetPromise = authService.resetPassword(givenEmail);

      // THEN it should throw a FirebaseError
      await expect(resetPromise).rejects.toThrow(
        new FirebaseError("EmailAuthService", "resetPassword", FirebaseErrorCodes.INVALID_EMAIL, "Invalid email format")
      );

      // AND no errors or warnings should be logged
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should throw a generic FirebaseError if an unknown error occurs", async () => {
      // GIVEN a user email and Firebase throws a generic error
      const givenEmail = "foo@bar.baz";
      const unknownError = new Error("Something unexpected");
      jest.spyOn(firebase.auth(), "sendPasswordResetEmail").mockRejectedValueOnce(unknownError);

      // WHEN resetting the password
      const resetPromise = authService.resetPassword(givenEmail);

      // THEN it should throw a FirebaseError with INTERNAL_ERROR
      await expect(resetPromise).rejects.toThrow(
        new FirebaseError(
          "EmailAuthService",
          "resetPassword",
          FirebaseErrorCodes.INTERNAL_ERROR,
          "An unknown error occurred"
        )
      );

      // AND no errors or warnings should be logged
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });
  });

  describe("isProviderSessionValid", () => {
    it.each([true, false])(
      "should always return '%s' stdFirebaseAuthService.isAuthSessionValid returns '%s'",
      async (expected) => {
        // GIVEN the expected result from StdFirebaseAuthenticationService.isAuthSessionValid
        const expectedResult = expected;
        jest
          .spyOn(StdFirebaseAuthenticationService.getInstance(), "isAuthSessionValid")
          .mockResolvedValue(expectedResult);

        // WHEN we query if the provider session is valid
        const actualResult = await authService.isProviderSessionValid();

        // THEN it should return the expected result
        expect(actualResult).toBe(expectedResult);
        expect(StdFirebaseAuthenticationService.getInstance().isAuthSessionValid).toHaveBeenCalled();

        // AND no errors or warnings should be logged
        expect(console.error).not.toHaveBeenCalled();
        expect(console.warn).not.toHaveBeenCalled();
      }
    );
  });
});
