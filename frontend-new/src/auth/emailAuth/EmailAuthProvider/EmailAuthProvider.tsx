import React, { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { useTokens } from "src/auth/hooks/useTokens";
import { useAuthUser } from "src/auth/hooks/useAuthUser";
import { emailAuthService } from "src/auth/emailAuth/EmailAuthService/EmailAuth.service";
import { EmailAuthContextValue, FirebaseIDToken, TabiyaUser, TFirebaseTokenResponse } from "src/auth/auth.types";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import { Backdrop } from "src/theme/Backdrop/Backdrop";
import { jwtDecode } from "jwt-decode";

export type EmailAuthProviderProps = {
  children: React.ReactNode;
};

// Default values for AuthContext
export const emailAuthContextDefaultValue: EmailAuthContextValue = {
  user: null,
  isLoggingInWithEmail: false,
  isRegisteringWithEmail: false,
  isLoggingOut: false,
  loginWithEmail: () => {},
  registerWithEmail: () => {},
  logout: () => {},
  handlePageLoad: () => {},
};

/**
 * AuthContext that provides the user, login, logout, and hasRole functions
 */
export const EmailAuthContext = createContext<EmailAuthContextValue>(emailAuthContextDefaultValue);

/**
 * EmailAuthProvider component that provides the EmailAuthContext to the application
 * @param children - the child components that will have access to AuthContext
 * @constructor
 */
export const EmailAuthProvider: React.FC<EmailAuthProviderProps> = ({ children }) => {
  const { user, updateUser, updateUserByIDToken } = useAuthUser();
  const tokens = useTokens({ updateUserByIDToken });

  // State to track if the user is logging in/registering
  const [isLoggingInWithEmail, setIsLoggingInWithEmail] = useState(false);
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
      emailAuthService.handleLogout(successCallback, errorCallback).then((r) => setIsLoggingOut(false));
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
      emailAuthService
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
      emailAuthService
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
      logout,
      isLoggingInWithEmail,
      isLoggingOut,
      isRegisteringWithEmail,
      handlePageLoad,
    }),
    [
      logout,
      isLoggingInWithEmail,
      isLoggingOut,
      isRegisteringWithEmail,
      user,
      loginWithEmail,
      registerWithEmail,
      handlePageLoad,
    ]
  );

  return (
    <EmailAuthContext.Provider value={value}>
      {tokens.isAuthenticating ? (
        <Backdrop isShown={tokens.isAuthenticating} message={"Authenticating, wait a moment..."} />
      ) : (
        children
      )}
    </EmailAuthContext.Provider>
  );
};

export * from "src/auth/auth.types";
