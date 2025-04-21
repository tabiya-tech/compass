import { isAcceptedTCValid, isSensitiveDataValid } from "src/app/ProtectedRoute/util";
import {
  Language,
  SensitivePersonalDataRequirement,
} from "src/userPreferences/UserPreferencesService/userPreferences.types";

describe("protected route util", () => {
  describe("isSensitiveDataValid", () => {
    test("should return false if sensitive data is required but user does not have it", () => {
      // GIVEN a user required to provide sensitive personal data but does not have it
      const userPreferences = {
        user_id: "given user id",
        language: Language.en,
        accepted_tc: new Date(),
        has_sensitive_personal_data: false,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.REQUIRED,
        sessions: [],
        user_feedback_answered_questions: {},
        experiments: {},
      };

      // WHEN checking if sensitive data is valid
      const result = isSensitiveDataValid(userPreferences);

      // THEN the result should be false
      expect(result).toBe(false);
    });

    test("should return true if sensitive data is required and user has it", () => {
      // GIVEN a user required to provide sensitive personal data and has it
      const userPreferences = {
        user_id: "given user id",
        language: Language.en,
        accepted_tc: new Date(),
        has_sensitive_personal_data: true,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.REQUIRED,
        sessions: [],
        user_feedback_answered_questions: {},
        experiments: {},
      };

      // WHEN checking if sensitive data is valid
      const result = isSensitiveDataValid(userPreferences);

      // THEN the result should be true
      expect(result).toBe(true);
    });

    test("should return true if sensitive data is not required", () => {
      // GIVEN a user not required to provide sensitive personal data
      const userPreferences = {
        user_id: "given user id",
        language: Language.en,
        accepted_tc: new Date(),
        has_sensitive_personal_data: false,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_AVAILABLE,
        sessions: [],
        user_feedback_answered_questions: {},
        experiments: {},
      };

      // WHEN checking if sensitive data is valid
      const result = isSensitiveDataValid(userPreferences);

      // THEN the result should be true
      expect(result).toBe(true);
    });
  });

  describe("isAcceptedTCValid", () => {
    test("should return false if accepted_tc is not provided", () => {
      // GIVEN a user without accepted_tc
      const userPreferences = {
        user_id: "given user id",
        language: Language.en,
        accepted_tc: undefined,
        has_sensitive_personal_data: false,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_AVAILABLE,
        sessions: [],
        user_feedback_answered_questions: {},
        experiments: {},
      };

      // WHEN checking if accepted_tc is valid
      const result = isAcceptedTCValid(userPreferences);

      // THEN the result should be false
      expect(result).toBe(false);
    });

    test("should return false if accepted_tc is invalid", () => {
      // GIVEN a user with an invalid accepted_tc
      const userPreferences = {
        user_id: "given user id",
        language: Language.en,
        accepted_tc: "invalid date",
        has_sensitive_personal_data: false,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_AVAILABLE,
        sessions: [],
        user_feedback_answered_questions: {},
      };

      // WHEN checking if accepted_tc is valid
      //@ts-ignore
      const result = isAcceptedTCValid(userPreferences);

      // THEN the result should be false
      expect(result).toBe(false);
    });

    test("should return true if accepted_tc is valid", () => {
      // GIVEN a user with a valid accepted_tc
      const userPreferences = {
        user_id: "given user id",
        language: Language.en,
        accepted_tc: new Date(),
        has_sensitive_personal_data: false,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_AVAILABLE,
        sessions: [],
        user_feedback_answered_questions: {},
        experiments: {},
      };

      // WHEN checking if accepted_tc is valid
      const result = isAcceptedTCValid(userPreferences);

      // THEN the result should be true
      expect(result).toBe(true);
    });
  });
});
