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
      };

      // WHEN The personal info is set
      PersistentStorageService.setPersonalInfo(givenPersonalInfo);

      // THEN The personal info should be stored
      const personalInfo = PersistentStorageService.getPersonalInfo();
      expect(personalInfo).toEqual(givenPersonalInfo);
    });
  });

  describe("overall feedback tests", () => {
    test("return correct previously set feedback", () => {
      // GIVEN The overall feedback is stored in the session storage
      const givenFeedback = [
        {
          question_id: "foo",
          simplified_answer: {
            rating_numeric: 5,
          },
        },
      ];
      PersistentStorageService.setOverallFeedback(givenFeedback);

      // WHEN The overall feedback is retrieved
      const feedback = PersistentStorageService.getOverallFeedback();

      // THEN The overall feedback should be returned
      expect(feedback).toEqual(givenFeedback);
    });

    test("return empty array if overall feedback is not set", () => {
      // GIVEN The overall feedback is not stored in the session storage
      // Nothing set

      // WHEN The feedback is retrieved
      const feedback = PersistentStorageService.getOverallFeedback();

      // THEN An empty array should be returned
      expect(feedback).toEqual([]);
    });

    test("clear overall feedback", () => {
      // GIVEN The overall feedback is stored in the session storage
      const givenFeedback = [
        {
          question_id: "foo",
          simplified_answer: {
            rating_numeric: 5,
          },
        },
      ];
      PersistentStorageService.setOverallFeedback(givenFeedback);

      // WHEN The overall feedback is cleared
      PersistentStorageService.clearOverallFeedback();

      // THEN The overall feedback should be cleared (empty array)
      const feedback = PersistentStorageService.getOverallFeedback();
      expect(feedback).toEqual([]);
    });
  });

  describe("account conversion tests", () => {
    test("return correct previously set account conversion", () => {
      // GIVEN The account conversion is stored in the session storage
      const givenAccountConversion = true;
      PersistentStorageService.setAccountConverted(givenAccountConversion);

      // WHEN The account conversion is retrieved
      const accountConversion = PersistentStorageService.getAccountConverted();

      // THEN The account conversion should be returned
      expect(accountConversion).toEqual(givenAccountConversion);
    });

    test("return false if account conversion is not set", () => {
      // GIVEN The account conversion is not stored in the session storage
      // Nothing set

      // WHEN The account conversion is retrieved
      const accountConversion = PersistentStorageService.getAccountConverted();

      // THEN false should be returned
      expect(accountConversion).toBe(false);
    });

    test("clear account conversion", () => {
      // GIVEN The account conversion is stored in the session storage
      const givenAccountConversion = true;
      PersistentStorageService.setAccountConverted(givenAccountConversion);

      // WHEN The account conversion is cleared
      PersistentStorageService.clearAccountConverted();

      // THEN The account conversion should be cleared (default false)
      const accountConversion = PersistentStorageService.getAccountConverted();
      expect(accountConversion).toBe(false);
    });

    test.each([true, false])("set account conversion to %s", (givenAccountConversion) => {
      // GIVEN The account conversion is not stored in the session storage
      // Nothing set

      // WHEN The account conversion is set
      PersistentStorageService.setAccountConverted(givenAccountConversion);

      // THEN The account conversion should be stored
      const accountConversion = PersistentStorageService.getAccountConverted();
      expect(accountConversion).toEqual(givenAccountConversion);
    });
  });

  describe("feedback notification tests", () => {
    test("return correct previously set feedback notification", () => {
      // GIVEN the userId with feedback notification is stored in the local storage
      const userId = "user-1234";
      PersistentStorageService.setSeenFeedbackNotification(userId);

      // WHEN The userId with feedback notification is retrieved
      const feedbackNotification = PersistentStorageService.hasSeenFeedbackNotification(userId);

      // THEN true should be returned
      expect(feedbackNotification).toEqual(true);
    });

    test("return false if feedback notification is not set", () => {
      // GIVEN there no userId with feedback notification is stored in the local storage
      // Nothing set

      // WHEN The feedback notification is retrieved
      const userId = "user-1234";
      const feedbackNotification = PersistentStorageService.hasSeenFeedbackNotification(userId);

      // THEN false should be returned
      expect(feedbackNotification).toBe(false);
    });

    test("clear feedback notification", () => {
      // GIVEN a userId with feedback notification is stored in the local storage
      const userId = "user-1234";
      PersistentStorageService.setSeenFeedbackNotification(userId);

      // WHEN a userId with feedback notification is cleared
      PersistentStorageService.clearSeenFeedbackNotification(userId);

      // THEN expect that userId with feedback notification is cleared
      expect(PersistentStorageService.hasSeenFeedbackNotification(userId)).toBe(false);
    });

    test("clear one feedback notification keeps others", () => {
      // GIVEN multiple userIds with feedback notification are stored in the local storage
      const userId1 = "user-1234";
      const userId2 = "user-5678";
      PersistentStorageService.setSeenFeedbackNotification(userId1);
      PersistentStorageService.setSeenFeedbackNotification(userId2);

      // WHEN one userId with feedback notification is cleared
      PersistentStorageService.clearSeenFeedbackNotification(userId1);

      // THEN only that one should be cleared
      expect(PersistentStorageService.hasSeenFeedbackNotification(userId1)).toBe(false);
      expect(PersistentStorageService.hasSeenFeedbackNotification(userId2)).toBe(true);
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
