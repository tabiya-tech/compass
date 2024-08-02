import { useCallback, useEffect, useState } from "react";
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";

type TUseTokensParams = {
  updateUserByToken: (token: string) => void;
};

/**
 * A hook to manage the tokens
 *  > this hook was added to fulfill Single Responsibility Principle, for now it is only used in authProvider
 * @returns tokens - The tokens
 */
export function useTokens({ updateUserByToken }: TUseTokensParams) {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const _setToken = useCallback(
    (token: string) => {
      updateUserByToken(token);
      PersistentStorageService.setToken(token);
    },
    [updateUserByToken]
  );

  useEffect(() => {
    const unsubscribe = firebase.auth().onAuthStateChanged(async (user) => {
      if (user) {
        const token = await user.getIdToken(true);
        _setToken(token);
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
        PersistentStorageService.clear();
      }
      setIsAuthenticating(false);
    });

    return () => unsubscribe();
  }, [_setToken]);

  const clearTokens = () => {
    PersistentStorageService.clear();
    setIsAuthenticated(false);
  };

  return {
    isAuthenticating,
    isAuthenticated,
    setIsAuthenticated,
    setToken: _setToken,
    clearTokens,
  };
}

export const defaultUseTokensResponse: ReturnType<typeof useTokens> = {
  isAuthenticating: false,
  isAuthenticated: false,
  setIsAuthenticated: () => {},
  setToken: () => {},
  clearTokens: () => {},
};
