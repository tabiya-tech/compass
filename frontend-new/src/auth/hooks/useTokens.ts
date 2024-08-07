import { useCallback } from "react";
import "firebase/compat/auth";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import { AuthMethods, FirebaseToken, TabiyaUser } from "src/auth/auth.types";
import { jwtDecode } from "jwt-decode";

/**
 * A hook to manage the tokens
 *  > this hook was added to fulfill Single Responsibility Principle, for now it is only used in authProvider
 * @returns tokens - The tokens
 */
export function useTokens() {
  /**
   * Gets the token from persistent storage and returns it
   * @returns string - The token from the persistent storage
   */
  const getToken = useCallback(() => {
    return PersistentStorageService.getToken();
  }, []);

  /**
   * Sets the token in the persistent storage and updates the user
   * @param token : string - The token to set
   * @returns void
   */
  const setToken = useCallback((token: string) => {
    PersistentStorageService.setToken(token);
  }, []);

  /**
   * Clears the token from the persistent storage
   * @returns void
   */
  const clearToken = useCallback(() => {
    PersistentStorageService.clear();
  }, []);

  /**
   * Extracts user details from the token string
   * @returns TabiyaUser
   * @param token : string - The token to extract the user from
   */
  const getUserFromToken = useCallback((token: string): TabiyaUser | null => {
    try {
      const decodedToken: FirebaseToken = jwtDecode(token);
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
    } catch (error) {
      return null;
    }
  }, []);

  return {
    setToken,
    getToken,
    clearToken,
    getUserFromToken,
  };
}
