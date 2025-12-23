import {
  SensitivePersonalDataRequirement,
  UserPreference,
} from "src/userPreferences/UserPreferencesService/userPreferences.types";
import { isValid } from "date-fns";

export function isSensitiveDataValid(userPreferences: UserPreference): boolean {
  const isSensitiveDataExpected =
    userPreferences.sensitive_personal_data_requirement !== SensitivePersonalDataRequirement.NOT_AVAILABLE;
  const hasSensitiveData = userPreferences.has_sensitive_personal_data;

  return !isSensitiveDataExpected || hasSensitiveData;
}

export function isAcceptedTCValid(userPreferences: UserPreference): boolean {
  if (!userPreferences?.accepted_tc) {
    return false;
  }

  const acceptedTCDate = new Date(userPreferences.accepted_tc);
  return isValid(acceptedTCDate);
}
