export type TabiyaUser = {
  id: string;
  name: string;
  email: string;
};

export type Token = {
  iss: string;
  exp: number;
  iat: number;
};

export enum AuthenticationServices {
  FIREBASE_ANONYMOUS = "FIREBASE_ANONYMOUS",
  FIREBASE_EMAIL = "FIREBASE_EMAIL",
  FIREBASE_SOCIAL = "FIREBASE_SOCIAL",
}
