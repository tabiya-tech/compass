import React, { createContext, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import UserPreferencesService from "src/userPreferences/UserPreferencesService/userPreferences.service";
import {
  UserPreference,
  UserPreferencesContextValue,
} from "src/userPreferences/UserPreferencesService/userPreferences.types";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import { Backdrop } from "src/theme/Backdrop/Backdrop";
import isEmptyObject from "../../utils/isEmptyObject/isEmptyObject";

export type UserPreferencesProviderProps = {
  children: ReactNode;
};

export const userPreferencesContextDefaultValue: UserPreferencesContextValue = {
  userPreferences: null,
  isLoading: false,
  createUserPreferences: () => {},
  getUserPreferences: () => {},
  updateUserPreferences: () => {},
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
  const createUserPreferences = useCallback(
    async (
      preferences: UserPreference,
      successCallback: (prefs: UserPreference) => void,
      errorCallback: (error: any) => void
    ) => {
      const userPreferencesService = UserPreferencesService.getInstance();
      setIsLoading(true);
      try {
        const newPreferences = await userPreferencesService.createUserPreferences(preferences);
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
      const userPreferencesService = UserPreferencesService.getInstance();
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
      updateUserPreferences,
      isLoading,
      createUserPreferences,
      getUserPreferences,
    }),
    [userPreferences, isLoading, createUserPreferences, getUserPreferences, updateUserPreferences]
  );

  return (
    <UserPreferencesContext.Provider value={value}>
      {isLoading ? <Backdrop isShown={isLoading} message={"Authenticating, wait a moment..."} /> : children}
    </UserPreferencesContext.Provider>
  );
};
