export type TabiyaUser = {
  id: string;
  name: string;
  email: string;
};

export type Token = {
  iss: string;
  exp: number;
  iat: number;
  [key: string]: any;
};

export type TokenHeader = {
  typ: string;
  kid: string;
  alg: string;
};

export enum AuthenticationServices {
  FIREBASE_ANONYMOUS = "FIREBASE_ANONYMOUS",
  FIREBASE_EMAIL = "FIREBASE_EMAIL",
  FIREBASE_SOCIAL = "FIREBASE_SOCIAL",
}

export const INVITATIONS_PARAM_NAME = "invitation_code";