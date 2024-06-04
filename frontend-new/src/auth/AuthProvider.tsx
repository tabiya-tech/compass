import React, { createContext, useCallback, useMemo } from "react";
import { useTokens } from "src/auth/hooks/useTokens";
import { useAuthUser } from "src/auth/hooks/useAuthUser";
import { AuthService } from "src/auth/services/AuthService";
import { AuthContextValue, AuthProviderProps, TabiyaUser, TFirebaseTokenResponse } from "src/auth/auth.types";
import { AuthPersistentStorage } from "src/auth/services/AuthPersistentStorage";
import { Backdrop } from "src/theme/Backdrop/Backdrop";

export const authContextDefaultValue: AuthContextValue = {
  user: null,
  login: () => {},
  logout: () => {},
  register: () => {},
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
  const { user, setUser, updateUserByAccessToken } = useAuthUser();
  const tokens = useTokens({ updateUserByIDToken: updateUserByAccessToken });

  /**
   * Logs in the user with an email and password
   */
  const login = useCallback(
    (
      email: string,
      password: string,
      sucessCallback: (user: TabiyaUser) => void,
      errorCallback: (error: any) => void
    ) => {
      const authService = AuthService.getInstance();
      authService.handleLogin(
        email,
        password,
        (user) => {
          setUser(user);
          sucessCallback(user);
        },
        (error) => {
          console.error(error);
          errorCallback(error);
        }
      );
    },
    [setUser]
  );

  /**
   * clears the refresh token and open the logout url
   * @returns void
   */
  const logout = useCallback(() => {
    AuthPersistentStorage.clear();
    tokens.clearTokens();
    setUser(null);
  }, [setUser, tokens]);

  /**
   * Registers the user with an email and password
   */
  const register = useCallback(
    (
      email: string,
      password: string,
      successCallback: (user: TabiyaUser) => void,
      errorCallback: (error: any) => void
    ) => {
      const authService = AuthService.getInstance();
      authService
        .handleRegister(
          email,
          password,
          (user) => {
            setUser(user);
            successCallback(user);
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
    [setUser, tokens]
  );

  const value = useMemo(() => ({ user, login, logout, register }), [logout, user, login, register]);

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
