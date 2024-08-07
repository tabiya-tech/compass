import React, { createContext, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { userPreferencesService } from "src/userPreferences/UserPreferencesService/userPreferences.service";
import {
  UpdateUserPreferencesSpec,
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
  updateUserPreferences: () => {},
  updateUserPreferencesOnClient: (userPreferences: UserPreference | null) => {},
  getUserPreferences: () => {},
};

export const UserPreferencesContext = createContext<UserPreferencesContextValue>(userPreferencesContextDefaultValue);

export const UserPreferencesProvider: React.FC<UserPreferencesProviderProps> = ({ children }) => {
  const [userPreferences, setUserPreferences] = useState<UserPreference | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
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

  /**
   * Create user preferences
   */
  const updateUserPreferences = useCallback(
    async (
      preferences: UpdateUserPreferencesSpec,
      successCallback: (prefs: UserPreference) => void,
      errorCallback: (error: any) => void
    ) => {
      setIsLoading(true);
      try {
        const newPreferences = await userPreferencesService.updateUserPreferences(preferences);
        setUserPreferences(newPreferences);
        successCallback(newPreferences);
      } catch (error) {
        console.error(error);
        errorCallback(error);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Get user preferences
   */
  const getUserPreferences = useCallback(
    async (userId: string, successCallback: (prefs: UserPreference) => void, errorCallback: (error: any) => void) => {
      setIsLoading(true);
      try {
        const preferences = await userPreferencesService.getUserPreferences(userId);
        setUserPreferences(preferences);
        successCallback(preferences);
      } catch (error) {
        console.error(error);
        errorCallback(error);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const updateUserPreferencesOnClient = useCallback(
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
      updateUserPreferencesOnClient,
      updateUserPreferences,
      getUserPreferences,
    }),
    [userPreferences, isLoading, updateUserPreferencesOnClient, getUserPreferences, updateUserPreferences]
  );

  return (
    <UserPreferencesContext.Provider value={value}>
      {isLoading ? <Backdrop isShown={isLoading} message={"Authenticating, wait a moment..."} /> : children}
    </UserPreferencesContext.Provider>
  );
};
