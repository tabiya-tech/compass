import React, { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { useTokens } from "src/auth/hooks/useTokens";
import { AuthContextValue, TabiyaUser } from "src/auth/auth.types";
import { Backdrop } from "src/theme/Backdrop/Backdrop";
import firebase from "firebase/compat/app";

export type AuthProviderProps = {
  children: React.ReactNode;
};

// Default values for AuthContext
export const authContextDefaultValue: AuthContextValue = {
  user: null,
  updateUserByToken: () => null,
  clearUser: () => {},
  isAuthenticationInProgress: false,
  isAuthenticated: false,
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
  const [user, setUser] = useState<TabiyaUser | null>(null);
  // State to track if authentication is in progress, i.e user is being set, cleared, or checked
  const [isAuthenticationInProgress, setIsAuthenticationInProgress] = useState(false);
  // State to track if there is an authenticated user in the application state
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  /**
   * Sets and unsets the token from persistent storage based on the state of the application
   */
  const { setToken, getToken, clearToken, getUserFromToken } = useTokens();

  /**
   * Utility for updating the user given a token
   * @returns void
   * @param token : string - The token to update the user with
   */
  const updateUserByToken = useCallback(
    (token: string): TabiyaUser | null => {
      try {
        const _user = getUserFromToken(token);
        if (_user) {
          setUser(_user);
          return _user;
        }
        return null;
      } catch (error) {
        console.error("Invalid token", error);
        return null;
      }
    },
    [setUser, getUserFromToken]
  );

  /**
   * Clears the user from the state and the persistent storage
   * @returns void
   **/
  const clearUser = useCallback(() => {
    setIsAuthenticationInProgress(true);
    clearToken();
    setUser(null);
    setIsAuthenticationInProgress(false);
  }, [clearToken]);

  /**
   * Handles page load to check and set the user if an token exists in the persistent storage
   */
  const handlePageLoad = useCallback(() => {
    setIsAuthenticationInProgress(true);
    const token = getToken();
    if (token) {
      // If token exists, update the user state
      updateUserByToken(token);
      setIsAuthenticationInProgress(false);
    } else {
      setIsAuthenticationInProgress(false);
    }
  }, [updateUserByToken, getToken]);

  /**
   * Checks if the user is authenticated, by hooking into the firebase auth state change
   * and sets the token in the persistent storage if an authenticated user is found
   * @returns void
   */
  useEffect(() => {
    setIsAuthenticationInProgress(true);
    const unsubscribe = firebase.auth().onAuthStateChanged(async (user) => {
      if (user) {
        const token = await user.getIdToken(true);
        setToken(token);
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
        clearToken();
      }
      setIsAuthenticationInProgress(false);
    });

    return () => unsubscribe();
  }, [setToken, clearToken]);

  /**
   * Load the user on page load
   */
  useEffect(() => {
    handlePageLoad();
  }, [handlePageLoad]);

  // Memoize the context value to optimize performance
  const value = useMemo(
    () => ({
      user,
      updateUserByToken,
      clearUser,
      isAuthenticationInProgress,
      isAuthenticated,
    }),
    [user, updateUserByToken, clearUser, isAuthenticationInProgress, isAuthenticated]
  );

  return (
    <AuthContext.Provider value={value}>
      {isAuthenticationInProgress ? (
        <Backdrop isShown={isAuthenticationInProgress} message={"Authenticating, wait a moment..."} />
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};

export * from "src/auth/auth.types";
