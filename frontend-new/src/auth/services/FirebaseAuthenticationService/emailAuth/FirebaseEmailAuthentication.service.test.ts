// mute chatty console
import "src/_test_utilities/consoleMock";
import FirebaseEmailAuthenticationService from "src/auth/services/FirebaseAuthenticationService/emailAuth/FirebaseEmailAuthentication.service";
import firebase from "firebase/compat/app";
import { invitationsService } from "src/invitations/InvitationsService/invitations.service";
import { InvitationStatus, InvitationType } from "src/invitations/InvitationsService/invitations.types";
import authStateService from "src/auth/services/AuthenticationState.service";

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
    }),
  };
});

jest.mock("src/userPreferences/UserPreferencesService/userPreferences.service", () => {
  return {
    userPreferencesService: {
      getUserPreferences: jest.fn(),
      createUserPreferences: jest.fn(),
    },
  };
})

jest.mock("src/invitations/InvitationsService/invitations.service", () => {
  return {
    invitationsService: {
      checkInvitationCodeStatus: jest.fn(),
    },
  };
})

jest.useFakeTimers();

describe("AuthService class tests", () => {
  let authService: FirebaseEmailAuthenticationService;

  beforeAll(async () => {
    authService = await FirebaseEmailAuthenticationService.getInstance();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("login", () => {
    const givenEmail = "foo@bar.baz";
    const givenPassword = "password";
    const givenUser = { id: "123", name:"Foo Bar ", email: givenEmail };
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

      jest.spyOn(authStateService.getInstance(), "getUser").mockReturnValue(givenUser);

      // WHEN the login is attempted
      const loginCallback = async () => await authService.login(givenEmail, givenPassword);

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
      const loginCallback = async () => await authService.login(givenEmail, givenPassword);

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

      // AND the logout method logs the user out
      jest.spyOn(authService, "logout").mockImplementation(async () => {});

      // WHEN the login is attempted
      const loginCallback = async () => await authService.login(givenEmail, givenPassword);

      // THEN the error callback should be called with Email not verified
      await expect(loginCallback()).rejects.toThrow("Email not verified");
    });

    test("should throw an error when the firebase signIn method fails to return a user", async () => {
      // GIVEN the login credentials are incorrect
      jest.spyOn(firebase.auth(), "signInWithEmailAndPassword").mockResolvedValue({
        user: null,
      } as firebase.auth.UserCredential);

      // WHEN the login is attempted
      const loginCallback = async () => await authService.login(givenEmail, givenPassword);
      // THEN an error should be thrown
      await expect(loginCallback()).rejects.toThrow("User not found");
    });
  });

  describe("register", () => {
    const givenEmail = "foo@bar.baz";
    const givenPassword = "password";
    const givenName = "foo";
    const givenUser = { id: "123", name: "Foo", email: givenEmail };
    const givenTokenResponse = "foo";
    const givenRegistrationToken = "foo-bar";

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
      jest.spyOn(authStateService.getInstance(), "getUser").mockReturnValue(givenUser);

      // AND the registration code is valid
      (invitationsService.checkInvitationCodeStatus as jest.Mock).mockResolvedValueOnce({
        status: InvitationStatus.VALID,
        invitation_type: InvitationType.REGISTER,
      });

      // WHEN the registration is attempted
      const registerCallback = async () => await authService.register(givenEmail, givenPassword, givenName, givenRegistrationToken);

      // AND registerWithEmail should return the token
      await expect(registerCallback()).resolves.toBe(givenTokenResponse);
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
      const registerCallback = async () => await authService.register(givenEmail, givenPassword, givenName, givenRegistrationToken);

      // AND test should throw an error
      await expect(registerCallback()).rejects.toThrow("Internal error");
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
      const registerCallback = async () => await authService.register(givenEmail, givenPassword, givenName, givenRegistrationToken);
      // THEN the registration should throw an error
      await expect(registerCallback()).rejects.toThrow("User not found");
    });

    test("should throw an error when the registration code is not valid", async () => {
      // GIVEN the registration code is not valid
      (invitationsService.checkInvitationCodeStatus as jest.Mock).mockResolvedValueOnce({
        status: InvitationStatus.VALID,
        invitation_type: InvitationType.AUTO_REGISTER,
      });

      // WHEN the registration is attempted
      const registerCallback = async () => await authService.register(givenEmail, givenPassword, givenName, givenRegistrationToken);
      // THEN the registration should throw an error
      await expect(registerCallback()).rejects.toThrow("Invalid invitation code");
    });
  });
});
