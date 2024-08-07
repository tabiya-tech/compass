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

/**
 * The context value for the email authentication context
 */
export type EmailAuthContextValue = {
  user: TabiyaUser | null;
  isLoggingInWithEmail: boolean;
  isRegisteringWithEmail: boolean;
  isLoggingOut: boolean;
  loginWithEmail: (
    email: string,
    password: string,
    successCallback: (user: TabiyaUser) => void,
    errorCallback: (error: Error) => void
  ) => void;
  registerWithEmail: (
    invitation_code: string,
    email: string,
    password: string,
    name: string,
    successCallback: () => void,
    errorCallback: (error: Error) => void
  ) => void;
  logout: (successCallback: () => void, errorCallback: (error: any) => void) => void;
  handlePageLoad: (successCallback: (user: TabiyaUser) => void, errorCallback: (error: Error) => void) => void;
};

/**
 * The context value for the anonymous authentication context
 */
export type AnonymousAuthContextValue = {
  user: TabiyaUser | null;
  isLoggingInAnonymously: boolean;
  isLoggingOut: boolean;
  loginAnonymously: (successCallback: (user: TabiyaUser) => void, errorCallback: (error: Error) => void) => void;
  logout: (successCallback: () => void, errorCallback: (error: any) => void) => void;
  handlePageLoad: (successCallback: (user: TabiyaUser) => void, errorCallback: (error: Error) => void) => void;
};

/**
 * The response from the firebase when refreshing the tokens
 */
export type TFirebaseTokenResponse = {
  user_id: string;
  expires_in: number;
  access_token: string;
};

/**
 * Provider Ids for the different authentication providers
 */

export enum AuthProviderIds {
  GOOGLE = "google.com",
  PASSWORD = "password",
}
