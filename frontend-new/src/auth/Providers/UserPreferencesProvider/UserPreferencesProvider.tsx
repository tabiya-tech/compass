import React, { createContext, useCallback, useMemo, useState, ReactNode, useEffect } from "react";
import UserPreferencesService from "src/auth/services/UserPreferences/userPreferences.service";
import { UserPreferencesContextValue, UserPreference } from "src/auth/services/UserPreferences/userPreferences.types";
import { PersistentStorageService } from "src/persistentStorageService/PersistentStorageService";

export type UserPreferencesProviderProps = {
  children: ReactNode;
};

export const userPreferencesContextDefaultValue: UserPreferencesContextValue = {
  userPreferences: null,
  isLoading: false,
  createUserPreferences: () => {},
  getUserPreferences: () => {},
};

export const UserPreferencesContext = createContext<UserPreferencesContextValue>(userPreferencesContextDefaultValue);

export const UserPreferencesProvider: React.FC<UserPreferencesProviderProps> = ({ children }) => {
  const [userPreferences, setUserPreferences] = useState<UserPreference | null>(() => {
    return PersistentStorageService.getUserPreferences();
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (userPreferences) {
      PersistentStorageService.setUserPreferences(userPreferences);
    } else {
      PersistentStorageService.clearUserPreferences();
    }
  }, [userPreferences]);

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

  const value = useMemo(
    () => ({
      userPreferences: userPreferences,
      isLoading,
      createUserPreferences: createUserPreferences,
      getUserPreferences,
    }),
    [userPreferences, isLoading, createUserPreferences, getUserPreferences]
  );

  //TODO: use backdrop for loading
  return (
    <UserPreferencesContext.Provider value={value}>
      {isLoading ? <div>Loading...</div> : children}
    </UserPreferencesContext.Provider>
  );
};
