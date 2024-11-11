export interface Invitation {
  invitation_code: string;
  status: InvitationStatus;
  invitation_type: InvitationType;
}

export enum InvitationStatus {
  VALID = "VALID",
  INVALID = "INVALID",
}

export enum InvitationType {
  AUTO_REGISTER = "AUTO_REGISTER",
  REGISTER = "REGISTER",
}
