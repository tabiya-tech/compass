import React, { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { useTokens } from "src/auth/hooks/useTokens";
import { AuthContextValue, TabiyaUser } from "src/auth/auth.types";
import { Backdrop } from "src/theme/Backdrop/Backdrop";
import firebase from "firebase/compat/app";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import { logoutService } from "src/auth/services/logout/logout.service";
import { auth } from "src/auth/firebaseConfig";

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

const REFRESH_TOKEN_EXPIRATION_PERCENTAGE = 0.1;

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
  // a state to track if the checks for the user on page load have been completed
  const [pageLoadComplete, setPageLoadComplete] = useState(false);

  const FIREBASE_DB_NAME = "firebaseLocalStorageDb";

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
          setToken(token);
          setUser(_user);
          return _user;
        }
        return null;
      } catch (error) {
        console.error("Invalid token", error);
        return null;
      }
    },
    [setUser, setToken, getUserFromToken]
  );

  const deleteFirebaseDB = useCallback(async () => {
    try {
      indexedDB.deleteDatabase(FIREBASE_DB_NAME)
    } catch (error) {
      console.error("Failed to delete user from Firebase DB", error);
    }
  }, []);

  /**
   * Clears the user from the state and the persistent storage
   * @returns void
   **/
  const clearUser = useCallback(() => {
    setIsAuthenticationInProgress(true);
    clearToken();
    setUser(null);
    deleteFirebaseDB();
    setIsAuthenticationInProgress(false);
  }, [clearToken, deleteFirebaseDB]);

  /**
   * Handles page load to check and set the user if an token exists in the persistent storage
   */
  const handlePageLoad = useCallback(async () => {
    setIsAuthenticationInProgress(true);
    // First check if the user is supposed to be logged out
    // If so, clear the user and logged out flag
    if (PersistentStorageService.getLoggedOutFlag()) {
      await logoutService.handleLogout(clearUser, console.error);
      setPageLoadComplete(true);
      return;
    }
    // Get the token from the storage
    const token = getToken();
    if (token) {
      // If token exists, update the user state
      updateUserByToken(token);
      setIsAuthenticationInProgress(false);
      setPageLoadComplete(true);
    } else {
      setIsAuthenticationInProgress(false);
      clearUser();
      setPageLoadComplete(true);
    }
  }, [updateUserByToken, getToken, clearUser]);

  /**
   * Monitors the token expiration and refreshes it before expiration
   * @returns void
   */
  const monitorTokenExpiration = useCallback((refreshTimeout: NodeJS.Timeout) => {
    const currentUser = auth.currentUser;
    if (auth.currentUser !== null) {
      auth.currentUser?.getIdTokenResult().then((idTokenResult) => {
        const expirationTime = new Date(idTokenResult.expirationTime).getTime();
        const currentTime = new Date().getTime();
        const timeToExpiration = expirationTime - currentTime;

        // Set a timeout to refresh the token when it has a certain percentage of its time left
        refreshTimeout = setTimeout(async () => {
          try {
            const newToken = await currentUser?.getIdToken(true);
            updateUserByToken(newToken!);
            monitorTokenExpiration(refreshTimeout); // Reset the timer after refreshing
          } catch (error) {
            console.error("Failed to refresh token:", error);
            // If the token refresh fails, log the user out
            try {
              await logoutService.handleLogout(clearUser, console.error);
            } finally {
              clearUser();
            }
          }
        }, timeToExpiration - timeToExpiration * REFRESH_TOKEN_EXPIRATION_PERCENTAGE);
      });
    }
  }, [updateUserByToken, clearUser]);

  /**
   * Checks if the user is authenticated by hooking into the Firebase auth state change
   * and sets the token in the persistent storage if an authenticated user is found
   * @returns void
   */
  useEffect(() => {
    if(!pageLoadComplete) return;
    // Timer reference for managing token refresh
    let refreshTimeout: NodeJS.Timeout;

    setIsAuthenticationInProgress(true);
    const unsubscribe = firebase.auth().onAuthStateChanged(async (user) => {
      if (user) {
        const token = await user.getIdToken(true);
        updateUserByToken(token)
        setIsAuthenticated(true);
        monitorTokenExpiration(refreshTimeout); // Start monitoring the token expiration
      } else {
        setIsAuthenticated(false);
        clearToken();
      }
      setIsAuthenticationInProgress(false);
    });

    // Cleanup function to unsubscribe from Firebase auth listener and clear any timeout
    return () => {
      unsubscribe();
      clearTimeout(refreshTimeout); // Clear timeout on unmount
    };
  }, [pageLoadComplete, setToken, clearToken, monitorTokenExpiration, updateUserByToken]);

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
