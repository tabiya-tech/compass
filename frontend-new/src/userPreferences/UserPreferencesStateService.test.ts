// mock the console logs
import "src/_test_utilities/consoleMock";

import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { Language, SensitivePersonalDataRequirement, UserPreference } from "src/userPreferences/UserPreferencesService/userPreferences.types";
import { nanoid } from "nanoid";

function getMockUserPreference(): UserPreference {
  const random = Math.floor(Math.random() * 1000000);
  // create 3 random session ids
  const randomSessions = Array.from({ length: 3 }).map((_value, index) => random + index);
  return {
    user_id: nanoid(), // ensure a unique user id
    language: Language.en,
    sensitive_personal_data_requirement: SensitivePersonalDataRequirement.REQUIRED,
    has_sensitive_personal_data: true,
    accepted_tc: new Date(),
    // 3 random session ids
    sessions: randomSessions,
    sessions_with_feedback: [randomSessions[0]],
  };
}

describe("UserPreferencesStateService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  describe("UserPreferencesStateService Singleton", () => {
    test("should get a single instance successfully", () => {
      // WHEN the service is constructed
      const actualFirstInstance = UserPreferencesStateService.getInstance();

      // THEN expect the service to be constructed successfully
      expect(actualFirstInstance).toBeDefined();

      // AND WHEN the service is constructed again
      const actualSecondInstance = UserPreferencesStateService.getInstance();

      // THEN expect the second instance to be the same as the first instance
      expect(actualFirstInstance).toBe(actualSecondInstance);
    });
  });

  describe("UserPreferencesStateService", () => {
    let service: UserPreferencesStateService;

    beforeEach(() => {
      service = UserPreferencesStateService.getInstance();
      service.clearUserPreferences();
    });
    describe("getUserPreferences", () => {
      it("should return null when no user preferences are set", () => {
        // GIVEN the user preferences is newly instantiated
        service = new (UserPreferencesStateService as any)();

        // WHEN getUserPreferences is called
        const actualUserPreferences = service.getUserPreferences();

        // THEN expect the user preferences to be null
        expect(actualUserPreferences).toBeNull();
      });
      it("should get a deep clone of the preferences", () => {
        // GIVEN some user preferences that are set
        const originalPreferences: UserPreference = getMockUserPreference();
        service.setUserPreferences(originalPreferences);

        // WHEN getting the user preferences
        const actualUserPreferences = service.getUserPreferences();
        // guard
        expect(actualUserPreferences).not.toBeNull();

        // AND mutating the retrieved user preferences
        const givenMutatedUserId = `${actualUserPreferences?.user_id}_mutated`;
        // @ts-ignore actualUserPreferences is not null, it is checked above
        actualUserPreferences.user_id = givenMutatedUserId;
        // guard
        expect(actualUserPreferences?.user_id).toEqual(givenMutatedUserId);

        // THEN the stored user preferences should not be mutated
        const actualUserPreferencesSecond = service.getUserPreferences();
        expect(actualUserPreferencesSecond).not.toEqual(actualUserPreferences);
        expect(actualUserPreferencesSecond).toEqual(originalPreferences);
      });
      it("should return null when an error occurs while cloning the object", () => {
        // GIVEN some user preferences that are set
        const originalPreferences: UserPreference = getMockUserPreference();
        service.setUserPreferences(originalPreferences);

        // AND the JSON.stringify function will throw an error
        jest.spyOn(JSON, "stringify").mockImplementationOnce(() => {
          throw new Error("error");
        });

        // WHEN getting the user preferences
        const actualUserPreferences = service.getUserPreferences();

        // THEN expect the user preferences to be null
        expect(actualUserPreferences).toBeNull();

        // AND expect an error to be logged
        expect(console.error).toHaveBeenCalled();
      });
    });

    describe("setUserPreferences", () => {
      it("should set a deep clone of the preferences", () => {
        // GIVEN some user preferences
        const givenPreferences: UserPreference = getMockUserPreference();
        const givenOriginalUserId = givenPreferences.user_id;

        // WHEN setting the user preferences
        service.setUserPreferences(givenPreferences);
        // AND mutating the stored user preferences
        const givenMutatedUserId = `${givenOriginalUserId}_mutated`;
        givenPreferences.user_id = givenMutatedUserId;
        // guard
        expect(givenPreferences.user_id).toEqual(givenMutatedUserId);

        // THEN the stored user preferences should not be mutated
        const actualUserPreferences = service.getUserPreferences();
        expect(actualUserPreferences).not.toBeNull();
        expect(actualUserPreferences).not.toEqual(givenPreferences);
        expect(actualUserPreferences?.user_id).toEqual(givenOriginalUserId);
      });
      it("throws an error when the preferences cannot be cloned", () => {
        // GIVEN some user preferences
        const givenPreferences: UserPreference = getMockUserPreference();

        // AND the JSON.stringify function will throw an error
        jest.spyOn(JSON, "stringify").mockImplementationOnce(() => {
          throw new Error("error");
        });

        // WHEN setting the user preferences
        // THEN expect an error to be thrown
        expect(() => service.setUserPreferences(givenPreferences)).toThrow();
      });
    });
    describe("get/setUserPreferences", () => {
      it("should set and get user preferences correctly", () => {
        // GIVEN user preferences
        const givenPreferences: UserPreference = getMockUserPreference();

        // WHEN setUserPreferences and getUserPreferences are called
        service.setUserPreferences(givenPreferences);
        const actualUserPreferences = service.getUserPreferences();

        // THEN the given preferences to be returned
        expect(actualUserPreferences).toEqual(givenPreferences);
      });
      it("should set and get null correctly", () => {
        // WHEN setUserPreferences and getUserPreferences are called for null
        // @ts-ignore
        service.setUserPreferences(null);
        const actualUserPreferences = service.getUserPreferences();

        // THEN the given preferences to be returned
        expect(actualUserPreferences).toBeNull();
      });
    });
    describe("clearUserPreferences", () => {
      it("should return null user preferences are cleared", () => {
        // GIVEN  user preferences are set
        service = UserPreferencesStateService.getInstance();
        service.setUserPreferences(getMockUserPreference());
        // guard
        expect(service.getUserPreferences()).not.toBeNull();

        // WHEN getUserPreferences is cleared
        service.clearUserPreferences();

        // THEN expect the user preferences to be null
        const actualUserPreferences = service.getUserPreferences();
        expect(actualUserPreferences).toBeNull();
      });
    });
    describe("getActiveSessionId", () => {
      it("should return the active session id when sessions are available", () => {
        // GIVEN user preferences with sessions are set
        const givenPreferences: UserPreference = getMockUserPreference();
        service.setUserPreferences(givenPreferences);

        // WHEN getActiveSessionId is called
        const actualSessionId = service.getActiveSessionId();

        // THEN expected first session id
        expect(actualSessionId).toBe(givenPreferences.sessions[0]);
      });

      it("should return null when no sessions are available", () => {
        // GIVEN user preferences with no sessions are set
        const givenPreferences: UserPreference = getMockUserPreference();
        givenPreferences.sessions = [];
        givenPreferences.sessions_with_feedback = [];
        service.setUserPreferences(givenPreferences);

        // WHEN getActiveSessionId is called
        const actualSessionId = service.getActiveSessionId();

        // THEN expected null
        expect(actualSessionId).toBeNull();
      });
      it("should return null when no user preferences are set", () => {
        // GIVEN no user preferences are set
        service.clearUserPreferences();

        // WHEN getActiveSessionId is called
        const actualSessionId = service.getActiveSessionId();

        // THEN expected null
        expect(actualSessionId).toBeNull();
      });
    });

    describe("activeSessionHasFeedback", () => {
      it("should return true if the active session has feedback", () => {
        // GIVEN user preferences with feedback for the active session are set
        const givenPreferences: UserPreference = getMockUserPreference();
        //guard
        expect(givenPreferences.sessions_with_feedback).toContain(givenPreferences.sessions[0]);
        service.setUserPreferences(givenPreferences);

        // WHEN activeSessionHasFeedback is called
        const actualHasFeedback = service.activeSessionHasFeedback();

        // THEN expected true
        expect(actualHasFeedback).toBe(true);
      });
      it("should return false if the active session does not have feedback", () => {
        // GIVEN user preferences with no feedback for the active session are set
        const givenPreferences: UserPreference = getMockUserPreference();
        givenPreferences.sessions_with_feedback = [];
        service.setUserPreferences(givenPreferences);

        // WHEN activeSessionHasFeedback is called
        const actualHasFeedback = service.activeSessionHasFeedback();

        // THEN expected false
        expect(actualHasFeedback).toBe(false);
      });
      it("should return false if there is no active session", () => {
        // GIVEN user preferences with no sessions are set
        const givenPreferences: UserPreference = getMockUserPreference();
        givenPreferences.sessions = [];
        givenPreferences.sessions_with_feedback = [];
        service.setUserPreferences(givenPreferences);

        // WHEN activeSessionHasFeedback is called
        const actualHasFeedback = service.activeSessionHasFeedback();

        // THEN expected false
        expect(actualHasFeedback).toBe(false);
      });
    });
  });
});