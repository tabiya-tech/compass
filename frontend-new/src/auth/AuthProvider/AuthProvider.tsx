import React, { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { useTokens } from "src/auth/hooks/useTokens";
import { useAuthUser } from "src/auth/hooks/useAuthUser";
import { authService } from "src/auth/AuthService/AuthService";
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
  isLoggingInWithEmail: false,
  isRegisteringWithEmail: false,
  isLoggingInAnonymously: false,
  isLoggingOut: false,
  loginWithEmail: () => {},
  registerWithEmail: () => {},
  loginAnonymously: () => {},
  logout: () => {},
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
  const [isLoggingInWithEmail, setIsLoggingInWithEmail] = useState(false);
  const [isLoggingInAnonymously, setIsLoggingInAnonymously] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isRegisteringWithEmail, setIsRegisteringWithEmail] = useState(false);

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
   * Logs out the user by clearing tokens and user data
   */
  const logout = useCallback(
    (successCallback: () => void, errorCallback: (error: any) => void) => {
      setIsLoggingOut(true);
      // Clear the tokens and user data
      PersistentStorageService.clear();
      tokens.clearTokens();
      updateUser(null);
      authService.handleLogout(successCallback, errorCallback).then((r) => setIsLoggingOut(false));
    },
    [updateUser, tokens]
  );

  /**
   * Logs in the user with an email and password
   */
  const loginWithEmail = useCallback(
    (
      email: string,
      password: string,
      successCallback: (user: TabiyaUser) => void,
      errorCallback: (error: any) => void
    ) => {
      setIsLoggingInWithEmail(true);
      authService
        .handleLoginWithEmail(
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
            setIsLoggingInWithEmail(false);
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
          setIsLoggingInWithEmail(false);
        });
    },
    [updateUserByIDToken, tokens]
  );

  /**
   * Registers the user with an email and password
   */
  const registerWithEmail = useCallback(
    (
      email: string,
      password: string,
      name: string,
      successCallback: () => void,
      errorCallback: (error: any) => void
    ) => {
      setIsRegisteringWithEmail(true);
      authService
        .handleRegisterWithEmail(
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
          setIsRegisteringWithEmail(false);
        });
    },
    [logout]
  );

  /**
   * Logs in the user anonymously
   */
  const loginAnonymously = useCallback(
    (successCallback: (user: TabiyaUser) => void, errorCallback: (error: any) => void) => {
      setIsLoggingInAnonymously(true);
      authService
        .handleAnonymousLogin(
          (response: TFirebaseTokenResponse) => {
            updateUserByIDToken(response.access_token);
            console.log("Access token", response.access_token);
            console.log({ response });
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
            setIsLoggingInAnonymously(false);
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
          setIsLoggingInAnonymously(false);
        });
    },
    [updateUserByIDToken, tokens]
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
      loginWithEmail,
      registerWithEmail,
      loginAnonymously,
      logout,
      isLoggingInWithEmail,
      isLoggingOut,
      isRegisteringWithEmail,
      isLoggingInAnonymously,
      handlePageLoad,
    }),
    [
      logout,
      isLoggingInWithEmail,
      isLoggingOut,
      isRegisteringWithEmail,
      isLoggingInAnonymously,
      user,
      loginWithEmail,
      registerWithEmail,
      loginAnonymously,
      handlePageLoad,
    ]
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
