import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import { SensitivePersonalDataRequirement } from "src/userPreferences/UserPreferencesService/userPreferences.types";
import { Invitation, InvitationStatus, InvitationType } from "src/auth/services/invitationsService/invitations.types";
import { StoredPersonalInfo } from "src/sensitiveData/types";

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

  describe("invitation tests", () => {
    test("return correct previously set invitation", () => {
      // GIVEN The invitation is stored in the session storage
      const givenInvitation: Invitation = {
        invitation_code: "foo",
        invitation_type: InvitationType.REGISTER,
        status: InvitationStatus.VALID,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
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
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
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
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
      };

      // WHEN The invitation is set
      PersistentStorageService.setInvitation(givenInvitation);

      // THEN The invitation should be stored
      const invitation = PersistentStorageService.getInvitation();
      expect(invitation).toEqual(givenInvitation);
    });
  });

  describe("login method tests", () => {
    test("return correct previously set login method", () => {
      // GIVEN The login method is stored in the session storage
      const givenLoginMethod = "foo";
      PersistentStorageService.setLoginMethod(givenLoginMethod);

      // WHEN The login method is retrieved
      const loginMethod = PersistentStorageService.getLoginMethod();

      // THEN The login method should be returned
      expect(loginMethod).toEqual(givenLoginMethod);
    });

    test("return null if login method is not set", () => {
      // GIVEN The login method is not stored in the session storage
      // Nothing set

      // WHEN The login method is retrieved
      const loginMethod = PersistentStorageService.getLoginMethod();

      // THEN null should be returned
      expect(loginMethod).toBeNull();
    });

    test("clear login method", () => {
      // GIVEN The login method is stored in the session storage
      const givenLoginMethod = "foo";
      PersistentStorageService.setLoginMethod(givenLoginMethod);

      // WHEN The login method is cleared
      PersistentStorageService.clearLoginMethod();

      // THEN The login method should be cleared (null)
      const loginMethod = PersistentStorageService.getLoginMethod();
      expect(loginMethod).toBeNull();
    });

    test("set login method", () => {
      // GIVEN The login method is not stored in the session storage
      const givenLoginMethod = "foo";

      // WHEN The login method is set
      PersistentStorageService.setLoginMethod(givenLoginMethod);

      // THEN The login method should be stored
      const loginMethod = PersistentStorageService.getLoginMethod();
      expect(loginMethod).toEqual(givenLoginMethod);
    });
  });

  describe("personal info tests", () => {
    test("return correct previously set personal info", () => {
      // GIVEN The personal info is stored in the session storage
      const givenPersonalInfo: StoredPersonalInfo = {
        fullName: "foo",
        contactEmail: "foo@bar.baz",
        phoneNumber: "1234567890",
        address: "123 Main St",
      };
      PersistentStorageService.setPersonalInfo(givenPersonalInfo);

      // WHEN The personal info is retrieved
      const personalInfo = PersistentStorageService.getPersonalInfo();

      // THEN The personal info should be returned
      expect(personalInfo).toEqual(givenPersonalInfo);
    });

    test("return null if personal info is not set", () => {
      // GIVEN The personal info is not stored in the session storage
      // Nothing set

      // WHEN The personal info is retrieved
      const personalInfo = PersistentStorageService.getPersonalInfo();

      // THEN null should be returned
      expect(personalInfo).toBeNull();
    });

    test("clear personal info", () => {
      // GIVEN The personal info is stored in the session storage
      const givenPersonalInfo: StoredPersonalInfo = {
        fullName: "foo",
        contactEmail: "foo@bar.baz",
        phoneNumber: "1234567890",
        address: "123 Main St",
      };
      PersistentStorageService.setPersonalInfo(givenPersonalInfo);

      // WHEN The personal info is cleared
      PersistentStorageService.clearPersonalInfo();

      // THEN The personal info should be cleared (null)
      const personalInfo = PersistentStorageService.getPersonalInfo();
      expect(personalInfo).toBeNull();
    });

    test("set personal info", () => {
      // GIVEN The personal info is not stored in the session storage
      const givenPersonalInfo: StoredPersonalInfo = {
        fullName: "foo",
        contactEmail: "foo@bar.baz",
        phoneNumber: "1234567890",
        address: "123 Main St",
      };

      // WHEN The personal info is set
      PersistentStorageService.setPersonalInfo(givenPersonalInfo);

      // THEN The personal info should be stored
      const personalInfo = PersistentStorageService.getPersonalInfo();
      expect(personalInfo).toEqual(givenPersonalInfo);
    });
  });

  describe("getItem tests", () => {
    test("should return correct item from localStorage", () => {
      // GIVEN an item is stored in localStorage
      const key = "testKey";
      const value = "testValue";
      localStorage.setItem(key, value);

      const retrievedValue = PersistentStorageService.getItem(localStorage, key);

      // THEN the correct value should be returned
      expect(retrievedValue).toEqual(value);
    });

    test("should set item in localStorage", () => {
      // GIVEN a key and value
      const key = "testKey";
      const value = "testValue";

      // WHEN the item is set using setItem
      PersistentStorageService.setItem(localStorage, key, value);

      // THEN the item should be stored in localStorage
      expect(localStorage.getItem(key)).toEqual(value);
    });

    test("should remove item from localStorage", () => {
      // GIVEN an item is stored in localStorage
      const key = "testKey";
      const value = "testValue";
      localStorage.setItem(key, value);

      // WHEN the item is removed using removeItem
      PersistentStorageService.removeItem(localStorage, key);

      // THEN the item should be removed from localStorage
      expect(localStorage.getItem(key)).toBeNull();
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
  });
});
