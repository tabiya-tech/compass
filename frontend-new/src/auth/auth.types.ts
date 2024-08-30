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
 * The context value for the authentication context
 */
export type AuthContextValue = {
  user: TabiyaUser | null;
  updateUserByToken: (token: string) => TabiyaUser | null;
  clearUser: () => void;
};

export enum AuthServices {
  EMAIL = "EMAIL",
  SOCIAL = "SOCIAL",
  ANONYMOUS = "ANONYMOUS",
}

export enum AuthMethods {
  GOOGLE = "google",
  PASSWORD = "password",
}

/**
 * Provider Ids for the different authentication providers
 */

export enum AuthProviderIds {
  GOOGLE = "google.com",
  PASSWORD = "password",
}

/**
 * An interface for all authentication services.
 * When adding a new authentication service, implement this interface.
 */
export interface AuthService {
  /**
   * Handle Logout: Method to handle user logout.
   * @returns {Promise<void>}
   */
  handleLogout(): Promise<void>;
}
