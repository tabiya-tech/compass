import { SensitivePersonalDataRequirement } from "src/userPreferences/UserPreferencesService/userPreferences.types";

export interface Invitation {
  invitation_code: string;
  status: InvitationStatus;
  invitation_type: InvitationType;
  sensitive_personal_data_requirement: SensitivePersonalDataRequirement;
}

export enum InvitationStatus {
  VALID = "VALID",
  INVALID = "INVALID",
}

export enum InvitationType {
  LOGIN = "LOGIN",
  REGISTER = "REGISTER",
}
