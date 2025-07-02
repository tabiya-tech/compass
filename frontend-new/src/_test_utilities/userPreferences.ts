import {
  Language,
  SensitivePersonalDataRequirement,
  UserPreference,
} from "src/userPreferences/UserPreferencesService/userPreferences.types";
import { getRandomString } from "./specialCharacters";

export function getTestUserPreferences(): UserPreference {
  return {
    user_id: "1",
    language: Language.en,
    accepted_tc: new Date(),
    sessions: [1234],
    client_id: getRandomString(10),
    user_feedback_answered_questions: {},
    has_sensitive_personal_data: false,
    sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
    experiments: {},
  }
}
