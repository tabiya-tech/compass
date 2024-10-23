// mute chatty console
import "src/_test_utilities/consoleMock";
import FirebaseInvitationCodeAuthenticationService from "src/auth/services/FirebaseAuthenticationService/invitationCodeAuth/FirebaseInvitationCodeAuthenticationService";
import firebase from "firebase/compat/app";
import { invitationsService } from "src/invitations/InvitationsService/invitations.service";
import { InvitationStatus, InvitationType } from "src/invitations/InvitationsService/invitations.types";
import authenticationStateService from "src/auth/services/AuthenticationState.service";

jest.mock("jwt-decode");

jest.mock("firebase/compat/app", () => {
  return {
    initializeApp: jest.fn(),
    auth: jest.fn().mockReturnValue({
      signInWithCustomToken: jest.fn(),
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
  let authService: FirebaseInvitationCodeAuthenticationService;

  beforeAll(async () => {
    authService = await FirebaseInvitationCodeAuthenticationService.getInstance();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("handleAnonymousLogin", () => {
    const givenUser = { id: "123", name:"Foo Bar ", email: "email"};
    test("should return token on successful anonymous login", async () => {
      // GIVEN the user is logged in anonymously
      jest.spyOn(firebase.auth(), "signInAnonymously").mockResolvedValue({
        user: { getIdToken: jest.fn().mockResolvedValue("foo") },
      } as unknown as firebase.auth.UserCredential);

      // AND the token is decoded into a user
      jest.spyOn(authenticationStateService.getInstance(), "getUser").mockReturnValue(givenUser);

      // AND the registration code is valid
      (invitationsService.checkInvitationCodeStatus as jest.Mock).mockResolvedValueOnce({
        status: InvitationStatus.VALID,
        invitation_type: InvitationType.AUTO_REGISTER,
      });

      // WHEN the anonymous login is attempted
      const anonymousLoginCallback = async () => await authService.login("foo");

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
      // AND the registration code is valid
      (invitationsService.checkInvitationCodeStatus as jest.Mock).mockResolvedValueOnce({
        status: InvitationStatus.VALID,
        invitation_type: InvitationType.AUTO_REGISTER,
      });

      // WHEN the anonymous login is attempted
      const anonymousLoginCallback = async () => await authService.login("foo");

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

      // AND the registration code is valid
      (invitationsService.checkInvitationCodeStatus as jest.Mock).mockResolvedValueOnce({
        status: InvitationStatus.VALID,
        invitation_type: InvitationType.AUTO_REGISTER,
      });

      // WHEN the anonymous login is attempted
      const anonymousLoginCallback = async () => await authService.login("foo");

      // THEN the error callback should be called with Failed to Fetch
      await expect(anonymousLoginCallback()).rejects.toThrow("User not found");
    });

    test("should throw an error when the invitation code is not valid", async () => {
      // GIVEN the registration code is not valid
      (invitationsService.checkInvitationCodeStatus as jest.Mock).mockResolvedValueOnce({
        status: InvitationStatus.INVALID,
        invitation_type: InvitationType.AUTO_REGISTER,
      });

      // WHEN the anonymous login is attempted
      const anonymousLoginCallback = async () => await authService.login("foo");

      // THEN the error callback should be called with Invalid invitation code
      await expect(anonymousLoginCallback()).rejects.toThrow("Invalid invitation code");
    });
  });
});