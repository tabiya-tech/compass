import React, { createContext, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  UserPreference,
  UserPreferencesContextValue,
} from "src/userPreferences/UserPreferencesService/userPreferences.types";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import { Backdrop } from "src/theme/Backdrop/Backdrop";
import isEmptyObject from "src/utils/isEmptyObject/isEmptyObject";

export type UserPreferencesProviderProps = {
  children: ReactNode;
};

export const userPreferencesContextDefaultValue: UserPreferencesContextValue = {
  userPreferences: null,
  isLoading: false,
  updateUserPreferences: (userPreferences: UserPreference | null) => {},
};

export const UserPreferencesContext = createContext<UserPreferencesContextValue>(userPreferencesContextDefaultValue);

export const UserPreferencesProvider: React.FC<UserPreferencesProviderProps> = ({ children }) => {
  const [userPreferences, setUserPreferences] = useState<UserPreference | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    setIsLoading(true)
    const storedPreferences = PersistentStorageService.getUserPreferences();
    if (storedPreferences) {
      setUserPreferences(storedPreferences);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (userPreferences && !isEmptyObject(userPreferences)) {
      PersistentStorageService.setUserPreferences(userPreferences);
    } else {
      PersistentStorageService.clearUserPreferences();
    }
  }, [userPreferences, setUserPreferences]);

  const updateUserPreferences = useCallback(
    async (preferences: UserPreference | null) => {
      setIsLoading(true);
      setUserPreferences(preferences);
      setIsLoading(false);
    },
    [setUserPreferences]
  );

  const value = useMemo(
    () => ({
      userPreferences,
      isLoading,
      updateUserPreferences,
    }),
    [userPreferences, isLoading, updateUserPreferences]
  );

  return (
    <UserPreferencesContext.Provider value={value}>
      {isLoading ? <Backdrop isShown={isLoading} message={"Authenticating, wait a moment..."} /> : children}
    </UserPreferencesContext.Provider>
  );
};
