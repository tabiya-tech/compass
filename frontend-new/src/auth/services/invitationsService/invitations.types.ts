import { SensitivePersonalDataRequirement } from "src/userPreferences/UserPreferencesService/userPreferences.types";

export type InvitationSource = "secure_link" | "invitation" | null;

export interface Invitation {
  code: string;
  status: InvitationStatus;
  source?: InvitationSource;
  invitation_type?: InvitationType;
  sensitive_personal_data_requirement?: SensitivePersonalDataRequirement;
  // legacy alias to keep older callers safe
  invitation_code?: string;
}

export enum InvitationStatus {
  VALID = "VALID",
  USED = "USED",
  INVALID = "INVALID",
}

export enum InvitationType {
  LOGIN = "LOGIN",
  REGISTER = "REGISTER",
}
