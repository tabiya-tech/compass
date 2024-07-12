import React, { createContext, useCallback, useMemo, useState } from "react";
import { useTokens } from "src/auth/hooks/useTokens";
import { useAuthUser } from "src/auth/hooks/useAuthUser";
import { AuthService } from "src/auth/services/AuthService/AuthService";
import {
  AuthContextValue,
  AuthProviderProps,
  FirebaseIDToken,
  TabiyaUser,
  TFirebaseTokenResponse,
} from "src/auth/auth.types";
import { PersistentStorageService } from "src/persistentStorageService/PersistentStorageService";
import { Backdrop } from "src/theme/Backdrop/Backdrop";
import { jwtDecode } from "jwt-decode";

// Default values for AuthContext
export const authContextDefaultValue: AuthContextValue = {
  user: null,
  isLoggingIn: false,
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
  const [isRegistering, setIsRegistering] = useState(false);

  /**
   * Handles page load to check and set the user if an access token exists
   */
  const handlePageLoad = useCallback(
    (successCallback: (user: TabiyaUser) => void, errorCallback: (error: any) => void) => {
      const accessToken = PersistentStorageService.getIDToken();
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
            // Update the user state
            updateUserByIDToken(response.id_token);
            const decodedUser: FirebaseIDToken = jwtDecode(response.id_token);
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
          // Set the ID token in the tokens context once the login is complete
          tokens.setIDToken(data.id_token);
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
  const logout = useCallback(() => {
    // Clear the tokens and user data
    PersistentStorageService.clear();
    tokens.clearTokens();
    updateUser(null);
  }, [updateUser, tokens]);

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
      authService.handleRegister(
        email,
        password,
        name,
        () => {
          // since the registration will log the user out and prompt them to verify their email,
          // we don't need to update the user state
          setIsRegistering(false);
          successCallback();
        },
        (error) => {
          console.error(error);
          setIsRegistering(false);
          errorCallback(error);
        }
      ).finally(() => {
        // we don't need to update the user state or tokens
        setIsRegistering(false);
      });
    },
    []
  );

  // Memoize the context value to optimize performance
  const value = useMemo(
    () => ({
      user,
      login,
      logout,
      register,
      isLoggingIn,
      isRegistering,
      handlePageLoad,
    }),
    [logout, isLoggingIn, isRegistering, user, login, register, handlePageLoad]
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
