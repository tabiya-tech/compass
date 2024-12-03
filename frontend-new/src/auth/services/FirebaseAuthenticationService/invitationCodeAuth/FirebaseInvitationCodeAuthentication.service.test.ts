// mute chatty console
import "src/_test_utilities/consoleMock";
import FirebaseInvitationCodeAuthenticationService from "src/auth/services/FirebaseAuthenticationService/invitationCodeAuth/FirebaseInvitationCodeAuthenticationService";
import firebase from "firebase/compat/app";
import { invitationsService } from "src/auth/services/invitationsService/invitations.service";
import { InvitationStatus, InvitationType } from "src/auth/services/invitationsService/invitations.types";

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
});

jest.mock("src/auth/services/invitationsService/invitations.service", () => {
  return {
    invitationsService: {
      checkInvitationCodeStatus: jest.fn(),
    },
  };
});

jest.useFakeTimers();

describe("AuthService class tests", () => {
  let authService: FirebaseInvitationCodeAuthenticationService;

  beforeAll(async () => {
    authService = FirebaseInvitationCodeAuthenticationService.getInstance();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("should construct a singleton", async () => {
    // WHEN the singleton is constructed
    const instance = FirebaseInvitationCodeAuthenticationService.getInstance();

    // THEN the instance should be defined
    expect(instance).toBeDefined();

    // AND WHEN the singleton is constructed again
    const newInstance = FirebaseInvitationCodeAuthenticationService.getInstance();

    // THEN the instance should be the same as the first instance
    expect(newInstance).toBe(instance);
  });

  describe("handleAnonymousLogin", () => {
    const givenUser = { id: "123", name: "Foo Bar ", email: "email" };
    test("should return token on successful anonymous login", async () => {
      // GIVEN the user is logged in anonymously
      const givenToken = "foo-token";
      jest.spyOn(firebase.auth(), "signInAnonymously").mockResolvedValue({
        user: { getIdToken: jest.fn().mockResolvedValue(givenToken) },
      } as unknown as firebase.auth.UserCredential);

      // AND the token is decoded into a user
      jest.spyOn(authService, "getUser").mockReturnValue(givenUser);

      // AND the registration code is valid
      (invitationsService.checkInvitationCodeStatus as jest.Mock).mockResolvedValueOnce({
        status: InvitationStatus.VALID,
        invitation_type: InvitationType.AUTO_REGISTER,
      });

      // WHEN the anonymous login is attempted with some code
      const actualToken = await authService.login("foo-code");

      // THEN test should return the token
      expect(actualToken).toEqual(givenToken);

      // THEN test should call the firebase signInAnonymously function
      expect(firebase.auth().signInAnonymously).toHaveBeenCalled();
    });

    test("should call failureCallback on anonymous login failure", async () => {
      // GIVEN the user is not able to log in anonymously
      jest.spyOn(firebase.auth(), "signInAnonymously").mockRejectedValue({
        code: "auth/internal-error",
        message: "Internal error",
      });
      // AND the invitation code is valid
      (invitationsService.checkInvitationCodeStatus as jest.Mock).mockResolvedValueOnce({
        status: InvitationStatus.VALID,
        invitation_type: InvitationType.AUTO_REGISTER,
      });

      // WHEN the anonymous login is attempted
      const anonymousLoginPromise = authService.login("foo");

      // THEN the login should throw an error
      await expect(anonymousLoginPromise).rejects.toThrow("Internal error");

      // THEN test should call the firebase signInAnonymously function
      expect(firebase.auth().signInAnonymously).toHaveBeenCalled();
    });

    test("should throw an error when the firebase signInAnonymously method fails to return a user", async () => {
      // GIVEN the user is not able to log in anonymously
      jest.spyOn(firebase.auth(), "signInAnonymously").mockResolvedValue({
        user: null,
      } as unknown as firebase.auth.UserCredential);

      // AND the invitation code is valid
      (invitationsService.checkInvitationCodeStatus as jest.Mock).mockResolvedValueOnce({
        status: InvitationStatus.VALID,
        invitation_type: InvitationType.AUTO_REGISTER,
      });

      // WHEN the anonymous login is attempted
      const anonymousLoginPromise = authService.login("foo");

      // THEN the error callback should be called with Failed to Fetch
      await expect(anonymousLoginPromise).rejects.toThrow("User not found");
    });

    test("should throw an error when the invitation code is not valid", async () => {
      const givenCode = "foo";
      // GIVEN the invitation code is not valid
      (invitationsService.checkInvitationCodeStatus as jest.Mock).mockResolvedValueOnce({
        status: InvitationStatus.INVALID,
        invitation_type: InvitationType.AUTO_REGISTER,
      });

      // WHEN the anonymous login is attempted
      const anonymousLoginPromise = authService.login(givenCode);

      // THEN the error callback should be called with Invalid invitation code
      await expect(anonymousLoginPromise).rejects.toThrow("invalid invitation code: " + givenCode);
    });
  });
});
