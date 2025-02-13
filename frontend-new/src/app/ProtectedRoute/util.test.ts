import { canAccessPIIPage, canAccessChatPage } from "src/app/ProtectedRoute/util";
import {
  Language,
  SensitivePersonalDataRequirement,
} from "src/userPreferences/UserPreferencesService/userPreferences.types";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";

describe("protected route util", () => {
  describe("canAccessPIIPage", () => {
    test("should return false if user has sensitive personal data", () => {
      // GIVEN a user with sensitive personal data
      jest.spyOn(UserPreferencesStateService.getInstance(), "getUserPreferences").mockReturnValue({
        user_id: "given user id",
        language: Language.en,
        accepted_tc: new Date(),
        has_sensitive_personal_data: true,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.REQUIRED,
        sessions: [],
        sessions_with_feedback: [],
      });

      // WHEN checking if the user can access the PII page
      const userPreferences = UserPreferencesStateService.getInstance().getUserPreferences();

      // THEN the result should be false
      expect(canAccessPIIPage(userPreferences!)).toBe(false);
    });

    test("should return false if the user is not required to provide sensitive personal data", () => {
      // GIVEN a user that is not required to provide sensitive personal data
      jest.spyOn(UserPreferencesStateService.getInstance(), "getUserPreferences").mockReturnValue({
        user_id: "given user id",
        language: Language.en,
        accepted_tc: new Date(),
        has_sensitive_personal_data: false,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_AVAILABLE,
        sessions: [],
        sessions_with_feedback: [],
      });

      // WHEN checking if the user can access the PII page
      const userPreferences = UserPreferencesStateService.getInstance().getUserPreferences();

      // THEN the result should be false
      expect(canAccessPIIPage(userPreferences!)).toBe(false);
    });

    test("should return true if sensitive personal data is required but user does not have it", () => {
      // GIVEN a user that is required to provide sensitive personal data but does not have it
      jest.spyOn(UserPreferencesStateService.getInstance(), "getUserPreferences").mockReturnValue({
        user_id: "given user id",
        language: Language.en,
        accepted_tc: new Date(),
        has_sensitive_personal_data: false,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.REQUIRED,
        sessions: [],
        sessions_with_feedback: [],
      });

      // WHEN checking if the user can access the PII page
      const userPreferences = UserPreferencesStateService.getInstance().getUserPreferences();

      // THEN the result should be true
      expect(canAccessPIIPage(userPreferences!)).toBe(true);
    });
  });

  describe("canAccessChatPage", () => {
    test("should return false if sensitive personal data is required and user does not have it", () => {
      // GIVEN a user that is required to provide sensitive personal data but does not have it
      jest.spyOn(UserPreferencesStateService.getInstance(), "getUserPreferences").mockReturnValue({
        user_id: "given user id",
        language: Language.en,
        accepted_tc: new Date(),
        has_sensitive_personal_data: false,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.REQUIRED,
        sessions: [],
        sessions_with_feedback: [],
      });

      // WHEN checking if the user can access the chat page
      const userPreferences = UserPreferencesStateService.getInstance().getUserPreferences();

      // THEN the result should be false
      expect(canAccessChatPage(userPreferences!)).toBe(false);
    });

    test("should return true if sensitive personal data is required and user has it", () => {
      // GIVEN a user that is required to provide sensitive personal data and has it
      jest.spyOn(UserPreferencesStateService.getInstance(), "getUserPreferences").mockReturnValue({
        user_id: "given user id",
        language: Language.en,
        accepted_tc: new Date(),
        has_sensitive_personal_data: true,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.REQUIRED,
        sessions: [],
        sessions_with_feedback: [],
      });

      // WHEN checking if the user can access the chat page
      const userPreferences = UserPreferencesStateService.getInstance().getUserPreferences();

      // THEN the result should be true
      expect(canAccessChatPage(userPreferences!)).toBe(true);
    });

    test("should return true if sensitive personal data is not required", () => {
      // GIVEN a user that is not required to provide sensitive personal data
      jest.spyOn(UserPreferencesStateService.getInstance(), "getUserPreferences").mockReturnValue({
        user_id: "given user id",
        language: Language.en,
        accepted_tc: new Date(),
        has_sensitive_personal_data: false,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_AVAILABLE,
        sessions: [],
        sessions_with_feedback: [],
      });

      // WHEN checking if the user can access the chat page
      const userPreferences = UserPreferencesStateService.getInstance().getUserPreferences();

      // THEN the result should be true
      expect(canAccessChatPage(userPreferences!)).toBe(true);
    });
  });
});
