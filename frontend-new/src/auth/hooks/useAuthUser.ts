import { useCallback, useState } from "react";
import { jwtDecode } from "jwt-decode";
import { TabiyaUser } from "src/auth/auth.types";

enum AuthMethods {
  GOOGLE = "google",
  PASSWORD = "password",
}

/**
 * A hook to manage the user state
 * this hook was added to fulfill Single Responsibility Principle, for now it is only used in authProvider
 * @returns TabiyaUser | null - The user
 */
export function useAuthUser() {
  const [user, setUser] = useState<TabiyaUser | null>(null);

  /**
   * Updates the user by the access token
   * @returns void
   * @param accessToken
   */
  const updateUserByIDToken = useCallback(
    (idToken: string): void => {
      try {
        const decodedToken = jwtDecode<any>(idToken);
        const user = getUserFromToken(decodedToken);
        setUser(user);
      } catch (error) {
        console.error("Invalid token", error);
      }
    },
    [setUser]
  );

  /**
   * Update user directly
   * @returns void
   * @param user : TabiyaUser
   */
  const updateUser = useCallback(
    (user: TabiyaUser | null) => {
      setUser(user);
    },
    [setUser]
  );

  /**
   * Extracts user details from the token
   * @returns TabiyaUser
   * @param decodedToken : any
   */
  const getUserFromToken = (decodedToken: any): TabiyaUser => {
    const GOOGLE_ISSUER = "accounts.google.com";
    if (decodedToken.iss === GOOGLE_ISSUER) {
      // Google OAuth Token
      return {
        id: decodedToken.sub,
        name: decodedToken.name || decodedToken.email, // Google tokens might not have a name field
        email: decodedToken.email,
      };
    } else if (decodedToken.firebase?.sign_in_provider) {
      // Firebase Token
      const signInProvider = decodedToken.firebase.sign_in_provider;
      if (signInProvider === AuthMethods.PASSWORD) {
        // Firebase Password Auth Token
        return {
          id: decodedToken.user_id,
          name: decodedToken.name,
          email: decodedToken.email,
        };
      } else {
        // Other Firebase Auth Providers (e.g., Facebook, Twitter, etc.)
        return {
          id: decodedToken.user_id,
          name: decodedToken.name || decodedToken.email, // Use email if name is not available
          email: decodedToken.email,
        };
      }
    } else {
      throw new Error("Unknown token issuer");
    }
  };

  return {
    user,
    updateUser,
    updateUserByIDToken,
  };
}
