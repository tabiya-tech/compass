import { useCallback, useEffect, useState } from "react";
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import { PersistentStorageService } from "src/persistentStorageService/PersistentStorageService";

type TUseTokensParams = {
  updateUserByIDToken: (idToken: string) => void;
};

/**
 * A hook to manage the tokens
 *  > this hook was added to fulfill Single Responsibility Principle, for now it is only used in authProvider
 * @returns tokens - The tokens
 */
export function useTokens({ updateUserByIDToken }: TUseTokensParams) {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const _setIDToken = useCallback(
    (token: string) => {
      updateUserByIDToken(token);
      PersistentStorageService.setIDToken(token);
    },
    [updateUserByIDToken]
  );

  useEffect(() => {
    if (PersistentStorageService.getIDToken() == null) return;
    setIsAuthenticating(true);

    const unsubscribe = firebase.auth().onAuthStateChanged(async (user) => {
      if (user) {
        const idToken = await user.getIdToken(true);
        _setIDToken(idToken);
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
        PersistentStorageService.clear();
      }
      setIsAuthenticating(false);
    });

    return () => unsubscribe();
  }, [_setIDToken]);

  const clearTokens = () => {
    PersistentStorageService.clear();
    setIsAuthenticated(false);
  };

  return {
    isAuthenticating,
    isAuthenticated,
    setIsAuthenticated,
    setIDToken: _setIDToken,
    clearTokens,
  };
}

export const defaultUseTokensResponse: ReturnType<typeof useTokens> = {
  isAuthenticating: false,
  isAuthenticated: false,
  setIsAuthenticated: () => {},
  setIDToken: () => {},
  clearTokens: () => {},
};
