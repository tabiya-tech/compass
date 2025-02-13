import {
  SensitivePersonalDataRequirement,
  UserPreference,
} from "src/userPreferences/UserPreferencesService/userPreferences.types";

export function canAccessPIIPage(userPreferences: UserPreference): boolean {
  if (userPreferences.has_sensitive_personal_data) {
    return false;
  }

  return userPreferences.sensitive_personal_data_requirement !== SensitivePersonalDataRequirement.NOT_AVAILABLE;
}

export function canAccessChatPage(userPreferences: UserPreference): boolean {
  const isSensitiveDataRequired =
    userPreferences.sensitive_personal_data_requirement === SensitivePersonalDataRequirement.REQUIRED;
  const hasNoSensitiveData = !userPreferences.has_sensitive_personal_data;

  return !(isSensitiveDataRequired && hasNoSensitiveData);
}
