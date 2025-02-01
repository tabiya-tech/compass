// mute chatty console
import "src/_test_utilities/consoleMock";
import FirebaseInvitationCodeAuthenticationService
  from "src/auth/services/FirebaseAuthenticationService/invitationCodeAuth/FirebaseInvitationCodeAuthenticationService";
import firebase from "firebase/compat/app";
import { invitationsService } from "src/auth/services/invitationsService/invitations.service";
import { Invitation, InvitationStatus, InvitationType } from "src/auth/services/invitationsService/invitations.types";
import UserPreferencesService from "src/userPreferences/UserPreferencesService/userPreferences.service";
import { Language, SensitivePersonalDataRequirement, UserPreference } from "src/userPreferences/UserPreferencesService/userPreferences.types";
import { resetAllMethodMocks } from "src/_test_utilities/resetAllMethodMocks";
import AuthenticationStateService from "src/auth/services/AuthenticationState.service";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";

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

jest.mock("src/auth/services/invitationsService/invitations.service", () => {
  return {
    invitationsService: {
      checkInvitationCodeStatus: jest.fn(),
    },
  };
});

describe("AuthService class tests", () => {
  const authService = FirebaseInvitationCodeAuthenticationService.getInstance();

  beforeEach(async () => {
    jest.clearAllMocks();
    AuthenticationStateService.getInstance().setUser(null);
    UserPreferencesStateService.getInstance().clearUserPreferences();
    // Reset all method mocks on the singletons that may have been mocked
    // As a good practice, we should the mock*Once() methods to avoid side effects between tests
    // As a precaution, we reset all method mocks to ensure that no side effects are carried over between tests
    resetAllMethodMocks(UserPreferencesService.getInstance());
    resetAllMethodMocks(invitationsService);
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

    // AND expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  describe("handleAnonymousLogin", () => {
    const givenUser = { id: "123", name: "Foo Bar ", email: "email" };
    test("should return token on successful anonymous login", async () => {
      // GIVEN an invitation code
      const givenInvitationCode = "foo-code";
      // AND the user is logged in anonymously
      const givenToken = "foo-token";
      jest.spyOn(firebase.auth(), "signInAnonymously").mockResolvedValue({
        user: { getIdToken: jest.fn().mockResolvedValue(givenToken) },
      } as unknown as firebase.auth.UserCredential);

      // AND the user preferences can be created\
      const givenReturnedPreferences = { foo: "bar" } as unknown as UserPreference;
      jest.spyOn(UserPreferencesService.getInstance(), "createUserPreferences").mockResolvedValueOnce(givenReturnedPreferences);
      jest.spyOn(UserPreferencesService.getInstance(), "getUserPreferences").mockResolvedValueOnce(givenReturnedPreferences);


      // AND the token is decoded into a user
      jest.spyOn(authService, "getUser").mockReturnValue(givenUser);

      // AND the registration code is valid
      const givenInvitation: Invitation = {
        status: InvitationStatus.VALID,
        invitation_type: InvitationType.AUTO_REGISTER,
        invitation_code: givenInvitationCode,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
      };
      (invitationsService.checkInvitationCodeStatus as jest.Mock).mockResolvedValueOnce(givenInvitation);

      // WHEN the anonymous login is attempted with some code
      const actualToken = await authService.login(givenInvitationCode);

      // THEN test should return the token
      expect(actualToken).toEqual(givenToken);

      // THEN test should call the firebase signInAnonymously function
      expect(firebase.auth().signInAnonymously).toHaveBeenCalled();

      // AND the user preferences should be created
      expect(UserPreferencesService.getInstance().createUserPreferences).toHaveBeenCalledWith({
        user_id: givenUser.id,
        invitation_code: givenInvitationCode,
        language: Language.en,
      });

      //  AND the user preferences should be set in the user preferences state
      expect(UserPreferencesStateService.getInstance().getUserPreferences()).toEqual(givenReturnedPreferences);

      // AND expect no errors or warning to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
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
