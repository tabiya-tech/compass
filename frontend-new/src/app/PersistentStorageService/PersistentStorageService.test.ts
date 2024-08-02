import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import { Language, UserPreference } from "src/userPreferences/UserPreferencesService/userPreferences.types";
import { Invitation, InvitationStatus, InvitationType } from "src/invitations/InvitationsService/invitations.types";

describe("AuthPersistentStorage class tests", () => {
  beforeEach(() => {
    PersistentStorageService.clear();
  });

  afterAll(() => {
    PersistentStorageService.clear();
  });

  describe("token tests", () => {
    test("return correct previously set token", () => {
      // GIVEN The token is stored in the session storage
      const givenToken = "foo";
      PersistentStorageService.setToken(givenToken);

      // WHEN The token is retrieved
      const Token = PersistentStorageService.getToken();

      // THEN The token should be returned
      expect(Token).toEqual(givenToken);
    });

    test("return null if token is not set", () => {
      // GIVEN The token is not stored in the session storage
      // Nothing set

      // WHEN The token is retrieved
      const Token = PersistentStorageService.getToken();

      // THEN null should be returned
      expect(Token).toBeNull();
    });

    test("clear token", () => {
      // GIVEN The token is stored in the session storage
      const givenToken = "foo";
      PersistentStorageService.setToken(givenToken);

      // WHEN The token is cleared
      PersistentStorageService.clearToken();

      // THEN The token should be cleared (null)
      const Token = PersistentStorageService.getToken();
      expect(Token).toBeNull();
    });

    test("set token", () => {
      // GIVEN The token is not stored in the session storage
      const givenToken = "foo";

      // WHEN The token is set
      PersistentStorageService.setToken(givenToken);

      // THEN The token should be stored
      const Token = PersistentStorageService.getToken();
      expect(Token).toEqual(givenToken);
    });
  });

  describe("user preferences tests", () => {
    test("return correct previously set user preferences", () => {
      // GIVEN The user preferences are stored in the session storage
      const givenUserPreferences: UserPreference = {
        user_id: "foo",
        language: Language.en,
        accepted_tc: new Date(),
        sessions: [1, 2, 3],
      };
      PersistentStorageService.setUserPreferences(givenUserPreferences);

      // WHEN The user preferences are retrieved
      const userPreferences = PersistentStorageService.getUserPreferences();

      // THEN The user preferences should be returned
      expect(userPreferences).toEqual(givenUserPreferences);
    });

    test("return null if user preferences are not set", () => {
      // GIVEN The user preferences are not stored in the session storage
      // Nothing set

      // WHEN The user preferences are retrieved
      const userPreferences = PersistentStorageService.getUserPreferences();

      // THEN null should be returned
      expect(userPreferences).toBeNull();
    });

    test("clear user preferences", () => {
      // GIVEN The user preferences are stored in the session storage
      const givenUserPreferences: UserPreference = {
        user_id: "foo",
        language: Language.en,
        accepted_tc: new Date(),
        sessions: [1, 2, 3],
      };
      PersistentStorageService.setUserPreferences(givenUserPreferences);

      // WHEN The user preferences are cleared
      PersistentStorageService.clearUserPreferences();

      // THEN The user preferences should be cleared (null)
      const userPreferences = PersistentStorageService.getUserPreferences();
      expect(userPreferences).toBeNull();
    });

    test("set user preferences", () => {
      // GIVEN The user preferences are not stored in the session storage
      const givenUserPreferences: UserPreference = {
        user_id: "foo",
        language: Language.en,
        accepted_tc: new Date(),
        sessions: [1, 2, 3],
      };

      // WHEN The user preferences are set
      PersistentStorageService.setUserPreferences(givenUserPreferences);

      // THEN The user preferences should be stored
      const userPreferences = PersistentStorageService.getUserPreferences();
      expect(userPreferences).toEqual(givenUserPreferences);
    });
  });

  describe("invitation tests", () => {
    test("return correct previously set invitation", () => {
      // GIVEN The invitation is stored in the session storage
      const givenInvitation: Invitation = {
        invitation_code: "foo",
        invitation_type: InvitationType.REGISTER,
        status: InvitationStatus.VALID,
      };
      PersistentStorageService.setInvitation(givenInvitation);

      // WHEN The invitation is retrieved
      const invitation = PersistentStorageService.getInvitation();

      // THEN The invitation should be returned
      expect(invitation).toEqual(givenInvitation);
    });

    test("return null if invitation is not set", () => {
      // GIVEN The invitation is not stored in the session storage
      // Nothing set

      // WHEN The invitation is retrieved
      const invitation = PersistentStorageService.getInvitation();

      // THEN null should be returned
      expect(invitation).toBeNull();
    });

    test("clear invitation", () => {
      // GIVEN The invitation is stored in the session storage
      const givenInvitation: Invitation = {
        invitation_code: "foo",
        invitation_type: InvitationType.REGISTER,
        status: InvitationStatus.VALID,
      };
      PersistentStorageService.setInvitation(givenInvitation);

      // WHEN The invitation is cleared
      PersistentStorageService.clearInvitation();

      // THEN The invitation should be cleared (null)
      const invitation = PersistentStorageService.getInvitation();
      expect(invitation).toBeNull();
    });

    test("set invitation", () => {
      // GIVEN The invitation is not stored in the session storage
      const givenInvitation: Invitation = {
        invitation_code: "foo",
        invitation_type: InvitationType.REGISTER,
        status: InvitationStatus.VALID,
      };

      // WHEN The invitation is set
      PersistentStorageService.setInvitation(givenInvitation);

      // THEN The invitation should be stored
      const invitation = PersistentStorageService.getInvitation();
      expect(invitation).toEqual(givenInvitation);
    });
  });

  test("clear all tokens", () => {
    // GIVEN The token is stored in the session storage
    const givenID = "foo";
    PersistentStorageService.setToken(givenID);

    // WHEN The token is cleared
    PersistentStorageService.clear();

    // THEN The token should be cleared (null)
    const Token = PersistentStorageService.getToken();
    expect(Token).toBeNull();

    // AND The user preferences should be cleared (null)
    const userPreferences = PersistentStorageService.getUserPreferences();
    expect(userPreferences).toBeNull();
  });
});
