export type TabiyaUser = {
  id: string;
  name: string;
  email: string;
};

export type FirebaseToken = {
  name: string;
  iss: string;
  aud: string;
  auth_time: number;
  user_id: string;
  sub: string;
  iat: number;
  exp: number;
  email: string;
  email_verified: boolean;
  firebase: {
    identities: {
      email: string[];
    };
    sign_in_provider: string;
  };
};

export enum AuthenticationServices {
  FIREBASE_ANONYMOUS = "FIREBASE_ANONYMOUS",
  FIREBASE_EMAIL = "FIREBASE_EMAIL",
  FIREBASE_SOCIAL = "FIREBASE_SOCIAL",
}