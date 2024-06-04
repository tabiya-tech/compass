import { useCallback, useEffect, useState } from "react";
import { AuthPersistentStorage } from "src/auth/services/AuthPersistentStorage";
import { AuthService } from "src/auth/services/AuthService";
import { TFirebaseTokenResponse } from "src/auth/auth.types";

type TUseTokensParams = {
  updateUserByIDToken: (accessToken: string) => void;
};

/**
 * A hook to manage the tokens
 *  >  this hook was added to fullfill Single Responsability Principle, for now it is only used in authProvider
 * @returns tokens - The tokens
 */

export function useTokens({ updateUserByIDToken }: TUseTokensParams) {
  const [refreshToken, setRefreshToken] = useState("");

  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const _setIDToken = useCallback(
    (token: string) => {
      updateUserByIDToken(token);
      AuthPersistentStorage.setIDToken(token);
    },
    [updateUserByIDToken]
  );

  const handleRefreshToken = useCallback(async () => {
    if (isAuthenticated || isAuthenticating) return;

    const authService = AuthService.getInstance();
    const _refreshToken = AuthPersistentStorage.getRefreshToken();

    let timer: NodeJS.Timer | undefined;

    if (_refreshToken) {
      setIsAuthenticating(true);
      if (refreshToken !== _refreshToken) {
        setRefreshToken(_refreshToken);
      }

      timer = await authService.initiateRefreshTokens(
        _refreshToken,
        (data: TFirebaseTokenResponse) => {
          const { id_token } = data;

          _setIDToken(id_token);
          setIsAuthenticating(false);

          setIsAuthenticated(true);
        },
        () => {
          setIsAuthenticating(false);
          setIsAuthenticated(false);
          AuthPersistentStorage.clear();
        }
      );
    }

    return timer;
  }, [refreshToken, _setIDToken, isAuthenticated, isAuthenticating]);

  useEffect(() => {
    let timer: Promise<NodeJS.Timer | undefined> | undefined;

    if (!isAuthenticated) {
      timer = handleRefreshToken();
    }

    return () => {
      if (timer) {
        timer.then((t) => {
          if (t) clearInterval(t);
        });
      }
    };
  }, [handleRefreshToken, isAuthenticated]);

  const _setRefreshToken = (refreshToken: string) => {
    AuthPersistentStorage.setRefreshToken(refreshToken);
    setRefreshToken(refreshToken);
  };

  const clearTokens = () => {
    AuthPersistentStorage.clear();
    setRefreshToken("");
  };

  return {
    isAuthenticating,
    isAuthenticated,
    setIsAuthenticated,
    setIDToken: _setIDToken,
    refreshToken,
    setRefreshToken: _setRefreshToken,
    clearTokens,
  };
}

export const defaultUseTokensResponse: ReturnType<typeof useTokens> = {
  isAuthenticating: false,
  isAuthenticated: false,
  setIsAuthenticated: () => {},
  setIDToken: () => {},
  refreshToken: "",
  setRefreshToken: () => {},
  clearTokens: () => {},
};
