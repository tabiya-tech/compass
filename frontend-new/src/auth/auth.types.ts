import React from "react";

export type TabiyaUser = {
  name: string;
  email: string;
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
    successCallback: (user: TabiyaUser) => void,
    errorCallback: (error: Error) => void
  ) => void;
};

/**
 * The response from the firebase when refreshing the tokens
 */
export type TFirebaseTokenResponse = {
  expires_in: number;
  id_token: string;
};
