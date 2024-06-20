import React from "react";

export type TabiyaUser = {
  id: string;
  name: string;
  email: string;
};

export type FirebaseIDToken = {
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

export type AuthProviderProps = {
  children: React.ReactNode;
};

export type AuthContextValue = {
  user: TabiyaUser | null;
  login: (
    email: string,
    password: string,
    successCallback: (user: TabiyaUser) => void,
    errorCallback: (error: Error) => void
  ) => void;
  logout: () => void;
  register: (
    email: string,
    password: string,
    name: string,
    successCallback: (user: TabiyaUser) => void,
    errorCallback: (error: Error) => void
  ) => void;
  handlePageLoad: (successCallback: (user: TabiyaUser) => void, errorCallback: (error: Error) => void) => void;
};

/**
 * The response from the firebase when refreshing the tokens
 */
export type TFirebaseTokenResponse = {
  expires_in: number;
  id_token: string;
};

/**
 * Provider Ids for the different authentication providers
 */

export enum AuthProviderIds {
  GOOGLE = "google.com",
  PASSWORD = "password",
}
