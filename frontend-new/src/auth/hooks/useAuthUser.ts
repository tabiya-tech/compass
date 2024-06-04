import { useState } from "react";
import { jwtDecode } from "jwt-decode";
import { TabiyaUser } from "src/auth/auth.types";

/**
 * A hook to manage the user state
 * this hook was added to fullfill Single Responsability Principle, for now it is only used in authProvider
 * @returns TabiyaUser | null - The user
 */
export function useAuthUser() {
  const [user, setUser] = useState<TabiyaUser | null>(null);

  /**
   * Updates the user by the access token
   * @returns void
   * @param accessToken
   */
  const updateUserByAccessToken = (accessToken: string): void => {
    try {
      const decodedIdentityToken = jwtDecode<TabiyaUser>(accessToken);

      setUser({
        name: decodedIdentityToken["name"],
        email: decodedIdentityToken["email"],
      });
    } catch (error) {
      console.error("Invalid token");
    }
  };

  return {
    user,
    setUser,
    updateUserByAccessToken,
  };
}
