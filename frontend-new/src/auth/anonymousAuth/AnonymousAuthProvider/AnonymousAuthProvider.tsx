import React, { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { useTokens } from "src/auth/hooks/useTokens";
import { useAuthUser } from "src/auth/hooks/useAuthUser";
import { FirebaseToken, TabiyaUser, TFirebaseTokenResponse, AnonymousAuthContextValue } from "src/auth/auth.types";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import { Backdrop } from "src/theme/Backdrop/Backdrop";
import { jwtDecode } from "jwt-decode";
import { anonymousAuthService } from "../AnonymousAuthService/AnonymousAuth.service";

// Default values for AuthContext
export const anonymousAuthContextDefaultValue: AnonymousAuthContextValue = {
  user: null,
  isLoggingInAnonymously: false,
  isLoggingOut: false,
  loginAnonymously: () => {},
  logout: () => {},
  handlePageLoad: () => {},
};

/**
 * AuthContext that provides the user, login, logout, and hasRole functions
 */
export const AnonymousAuthContext = createContext<AnonymousAuthContextValue>(anonymousAuthContextDefaultValue);

/**
 * The props for the AnonymousAuthProvider component
 */
export type AuthProviderProps = {
  children: React.ReactNode;
};
/**
 * EmailAuthProvider component that provides the EmailAuthContext to the application
 * @param children - the child components that will have access to AuthContext
 * @constructor
 */
export const AnonymousAuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const { user, updateUser, updateUserByToken } = useAuthUser();
  const tokens = useTokens({ updateUserByToken });

  // State to track if the user is logging in/registering
  const [isLoggingInAnonymously, setIsLoggingInAnonymously] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  /**
   * Handles page load to check and set the user if an access token exists
   */
  const handlePageLoad = useCallback(
    (successCallback: (user: TabiyaUser) => void, errorCallback: (error: any) => void) => {
      const token = PersistentStorageService.getToken();
      if (token) {
        // If an access token exists, update the user state
        updateUserByToken(token);
        const decodedUser: FirebaseToken = jwtDecode(token);
        const newUser: TabiyaUser = {
          id: decodedUser.user_id,
          name: decodedUser.name,
          email: decodedUser.email,
        };
        // Call the success callback with the new user
        successCallback(newUser);
      } else {
        errorCallback("No access token");
      }
    },
    [updateUserByToken]
  );

  /**
   * Logs out the user by clearing tokens and user data
   */
  const logout = useCallback(
    (successCallback: () => void, errorCallback: (error: any) => void) => {
      setIsLoggingOut(true);
      // Clear the tokens and user data
      PersistentStorageService.clear();
      tokens.clearTokens();
      updateUser(null);
      anonymousAuthService.handleLogout(successCallback, errorCallback).then((r) => setIsLoggingOut(false));
    },
    [updateUser, tokens]
  );

  /**
   * Logs in the user anonymously
   */
  const loginAnonymously = useCallback(
    (successCallback: (user: TabiyaUser) => void, errorCallback: (error: any) => void) => {
      setIsLoggingInAnonymously(true);
      anonymousAuthService
        .handleAnonymousLogin(
          (response: TFirebaseTokenResponse) => {
            updateUserByToken(response.access_token);
            PersistentStorageService.setToken(response.access_token);
            // Update the user state
            updateUserByToken(response.access_token);

            const decodedUser: FirebaseToken = jwtDecode(response.access_token);
            const newUser: TabiyaUser = {
              id: decodedUser.user_id,
              name: decodedUser.name,
              email: decodedUser.email,
            };
            // Call the success callback with the new user
            successCallback(newUser);
          },
          (error) => {
            console.error(error);
            setIsLoggingInAnonymously(false);
            errorCallback(error);
          }
        )
        .then((data: TFirebaseTokenResponse | undefined) => {
          if (!data) return;
          // Set the access token in the tokens context once the login is complete
          tokens.setToken(data.access_token);
        })
        .finally(() => {
          // Once the login is complete, set the isLoggingIn state to false
          setIsLoggingInAnonymously(false);
        });
    },
    [updateUserByToken, tokens]
  );

  /**
   * Load the user on page load
   */

  useEffect(() => {
    handlePageLoad(
      (user: TabiyaUser) => {
        updateUser(user);
      },
      (error: any) => {
        // do nothing
      }
    );
  }, [handlePageLoad, updateUser]);

  // Memoize the context value to optimize performance
  const value = useMemo(
    () => ({
      user,
      loginAnonymously,
      logout,
      isLoggingOut,
      isLoggingInAnonymously,
      handlePageLoad,
    }),
    [logout, isLoggingOut, isLoggingInAnonymously, user, loginAnonymously, handlePageLoad]
  );

  return (
    <AnonymousAuthContext.Provider value={value}>
      {tokens.isAuthenticating ? (
        <Backdrop isShown={tokens.isAuthenticating} message={"Authenticating, wait a moment..."} />
      ) : (
        children
      )}
    </AnonymousAuthContext.Provider>
  );
};

export * from "src/auth/auth.types";
