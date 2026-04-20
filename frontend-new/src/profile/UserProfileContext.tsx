import React, { createContext, useContext, useMemo } from "react";
import { useUserProfile } from "./hooks/useUserProfile";
import type { UseUserProfileResult } from "./hooks/useUserProfile";

const defaultUserProfileContext: UseUserProfileResult = {
  profileData: {
    name: null,
    email: null,
    termsAcceptedDate: null,
    language: null,
    location: null,
    school: null,
    program: null,
    year: null,
    skills: [],
    educationSkills: [],
    programmeSkills: [],
    modules: [],
    skillsInterestsProgress: 0,
    careerExplorerSectors: [],
  },
  isLoading: false,
  isLoadingSecurity: false,
  isLoadingPreferences: false,
  isLoadingProfile: false,
  isLoadingSkills: false,
  isLoadingModules: false,
  isLoadingCareerExplorer: false,
  errors: {
    security: null,
    preferences: null,
    profile: null,
    skills: null,
    modules: null,
    careerExplorer: null,
  },
};

export const UserProfileContext = createContext<UseUserProfileResult>(defaultUserProfileContext);

export const UserProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const profile = useUserProfile();

  const value = useMemo(() => profile, [profile]);

  return <UserProfileContext.Provider value={value}>{children}</UserProfileContext.Provider>;
};

export const useUserProfileContext = (): UseUserProfileResult => {
  return useContext(UserProfileContext);
};
