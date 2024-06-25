import React, { createContext, useCallback, useMemo } from "react";
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

export const authContextDefaultValue: AuthContextValue = {
  user: null,
  login: () => {},
  logout: () => {},
  register: () => {},
  handlePageLoad: () => {},
};

/**
 * AuthContext that provides the user, login, logout and hasRole functions
 */
export const AuthContext = createContext<AuthContextValue>(authContextDefaultValue);

/**
 * AuthProvider component that provides the AuthContext to the application
 * @param children
 * @constructor
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const { user, updateUser, updateUserByIDToken } = useAuthUser();
  const tokens = useTokens({ updateUserByIDToken: updateUserByIDToken });

  const handlePageLoad = useCallback(
    (successCallback: (user: TabiyaUser) => void, errorCallback: (error: any) => void) => {
      const accessToken = PersistentStorageService.getIDToken();
      if (accessToken) {
        updateUserByIDToken(accessToken);
        const decodedUser: FirebaseIDToken = jwtDecode(accessToken);
        const newUser: TabiyaUser = {
          id: decodedUser.user_id,
          name: decodedUser.name,
          email: decodedUser.email,
        };
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
      authService
        .handleLogin(
          email,
          password,
          (response: TFirebaseTokenResponse) => {
            updateUserByIDToken(response.id_token);
            const decodedUser: FirebaseIDToken = jwtDecode(response.id_token);
            const newUser: TabiyaUser = {
              id: decodedUser.user_id,
              name: decodedUser.name,
              email: decodedUser.email,
            };
            successCallback(newUser);
          },
          (error) => {
            console.error(error);
            errorCallback(error);
          }
        )
        .then((data: TFirebaseTokenResponse | undefined) => {
          if (!data) return;
          tokens.setIDToken(data.id_token);
        });
    },
    [updateUserByIDToken, tokens]
  );

  /**
   * clears the refresh token and open the logout url
   * @returns void
   */
  const logout = useCallback(() => {
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
      successCallback: (user: TabiyaUser) => void,
      errorCallback: (error: any) => void
    ) => {
      const authService = AuthService.getInstance();
      authService.handleRegister(
        email,
        password,
        name,
        (response: TFirebaseTokenResponse) => {
          updateUserByIDToken(response.id_token);
          const decodedUser: FirebaseIDToken = jwtDecode(response.id_token);
          const newUser: TabiyaUser = {
            id: decodedUser.user_id,
            name: decodedUser.name,
            email: decodedUser.email,
          };
          successCallback(newUser);
        },
        (error) => {
          console.error(error);
          errorCallback(error);
        }
      );
    },
    [updateUserByIDToken]
  );

  const value = useMemo(
    () => ({ user, login, logout, register, handlePageLoad }),
    [logout, user, login, register, handlePageLoad]
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
