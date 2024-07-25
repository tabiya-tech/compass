import React, { createContext, useCallback, useMemo, useState } from "react";
import { useTokens } from "src/auth/hooks/useTokens";
import { useAuthUser } from "src/auth/hooks/useAuthUser";
import { AuthService } from "src/auth/AuthService/AuthService";
import {
  AuthContextValue,
  AuthProviderProps,
  FirebaseIDToken,
  TabiyaUser,
  TFirebaseTokenResponse,
} from "src/auth/auth.types";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import { Backdrop } from "src/theme/Backdrop/Backdrop";
import { jwtDecode } from "jwt-decode";

// Default values for AuthContext
export const authContextDefaultValue: AuthContextValue = {
  user: null,
  isLoggingIn: false,
  isLoggingOut: false,
  isRegistering: false,
  login: () => {},
  logout: () => {},
  register: () => {},
  handlePageLoad: () => {},
};

/**
 * AuthContext that provides the user, login, logout, and hasRole functions
 */
export const AuthContext = createContext<AuthContextValue>(authContextDefaultValue);

/**
 * AuthProvider component that provides the AuthContext to the application
 * @param children - the child components that will have access to AuthContext
 * @constructor
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const { user, updateUser, updateUserByIDToken } = useAuthUser();
  const tokens = useTokens({ updateUserByIDToken });

  // State to track if the user is logging in/registering
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  /**
   * Handles page load to check and set the user if an access token exists
   */
  const handlePageLoad = useCallback(
    (successCallback: (user: TabiyaUser) => void, errorCallback: (error: any) => void) => {
      const accessToken = PersistentStorageService.getAccessToken();
      if (accessToken) {
        // If an access token exists, update the user state
        updateUserByIDToken(accessToken);
        const decodedUser: FirebaseIDToken = jwtDecode(accessToken);
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
    [updateUserByIDToken]
  );

  /**
   * Logs in the user with an email and password
   */
  const login = useCallback(
    (
      email: string,
      password: string,
      successCallback: (user: TabiyaUser) => void,
      errorCallback: (error: any) => void
    ) => {
      const authService = AuthService.getInstance();
      setIsLoggingIn(true);
      authService
        .handleLogin(
          email,
          password,
          (response: TFirebaseTokenResponse) => {
            updateUserByIDToken(response.access_token);
            PersistentStorageService.setAccessToken(response.access_token);
            // Update the user state
            updateUserByIDToken(response.access_token);

            const decodedUser: FirebaseIDToken = jwtDecode(response.access_token);
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
            setIsLoggingIn(false);
            errorCallback(error);
          }
        )
        .then((data: TFirebaseTokenResponse | undefined) => {
          if (!data) return;
          // Set the access token in the tokens context once the login is complete
          tokens.setAccessToken(data.access_token);
        })
        .finally(() => {
          // Once the login is complete, set the isLoggingIn state to false
          setIsLoggingIn(false);
        });
    },
    [updateUserByIDToken, tokens]
  );

  /**
   * Logs out the user by clearing tokens and user data
   */
  const logout = useCallback(
    (successCallback: () => void, errorCallback: (error: any) => void) => {
      setIsLoggingOut(true);
      const authService = AuthService.getInstance();
      // Clear the tokens and user data
      PersistentStorageService.clear();
      tokens.clearTokens();
      updateUser(null);
      authService.handleLogout(successCallback, errorCallback).then((r) => setIsLoggingOut(false));
    },
    [updateUser, tokens]
  );

  /**
   * Registers the user with an email and password
   */
  const register = useCallback(
    (
      email: string,
      password: string,
      name: string,
      successCallback: () => void,
      errorCallback: (error: any) => void
    ) => {
      const authService = AuthService.getInstance();
      setIsRegistering(true);
      authService
        .handleRegister(
          email,
          password,
          name,
          () => {
            // since the registration will log the user out and prompt them to verify their email,
            // we don't need to update the user state
            logout(() => {}, errorCallback);
            successCallback();
          },
          (error) => {
            console.error(error);
            errorCallback(error);
          }
        )
        .finally(() => {
          // we don't need to update the user state or tokens
          setIsRegistering(false);
        });
    },
    [logout]
  );

  // Memoize the context value to optimize performance
  const value = useMemo(
    () => ({
      user,
      login,
      logout,
      register,
      isLoggingIn,
      isLoggingOut,
      isRegistering,
      handlePageLoad,
    }),
    [logout, isLoggingIn, isLoggingOut, isRegistering, user, login, register, handlePageLoad]
  );

  return (
    <AuthContext.Provider value={value}>
      {tokens.isAuthenticating ? (
        <Backdrop isShown={tokens.isAuthenticating} message={"Authenticating, wait a moment..."} />
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};

export * from "src/auth/auth.types";
