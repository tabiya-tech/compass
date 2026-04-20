import { useEffect, useMemo, useState } from "react";
import { fetchSkills } from "./utils/fetchSkills";
import { fetchPersonalData } from "./utils/fetchPersonalData";
import { Skill } from "src/experiences/experienceService/experiences.types";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import authenticationStateService from "src/auth/services/AuthenticationState.service";
import CareerReadinessService from "src/careerReadiness/services/CareerReadinessService";
import CareerExplorerService from "src/careerExplorer/services/CareerExplorerService";
import type { UserSectorEngagementItem } from "src/careerExplorer/services/CareerExplorerService";
import ChatService from "src/chat/ChatService/ChatService";
import type { ModuleSummary } from "src/careerReadiness/types";
import SidebarService from "src/home/components/Sidebar/SidebarService";

export interface UserProfileData {
  name: string | null;
  email: string | null;
  termsAcceptedDate: Date | null;
  language: string | null;
  location: string | null;
  school: string | null;
  program: string | null;
  year: string | null;
  skills: Skill[];
  educationSkills: Skill[];
  programmeSkills: string[];
  modules: ModuleSummary[];
  skillsInterestsProgress: number;
  careerExplorerSectors: UserSectorEngagementItem[];
}

export interface UseUserProfileResult {
  profileData: UserProfileData;
  isLoading: boolean;
  isLoadingSecurity: boolean;
  isLoadingPreferences: boolean;
  isLoadingProfile: boolean;
  isLoadingSkills: boolean;
  isLoadingModules: boolean;
  isLoadingCareerExplorer: boolean;
  errors: {
    security: Error | null;
    preferences: Error | null;
    profile: Error | null;
    skills: Error | null;
    modules: Error | null;
    careerExplorer: Error | null;
  };
}

/**
 * Hook to fetch and manage user profile data
 * Combines user authentication data with user preferences, personal data, and skills
 * Each component has its own independent state, loading, and error handling
 */
export const useUserProfile = (): UseUserProfileResult => {
  // Individual loading states for each component
  const [isLoadingSecurity, setIsLoadingSecurity] = useState(true);
  const [isLoadingPreferences, setIsLoadingPreferences] = useState(true);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isLoadingSkills, setIsLoadingSkills] = useState(true);

  // Individual data states for each component
  const [securityData, setSecurityData] = useState<{ email: string | null }>({ email: null });
  const [preferencesData, setPreferencesData] = useState<{ termsAcceptedDate: Date | null; language: string | null }>({
    termsAcceptedDate: null,
    language: null,
  });
  const [personalData, setPersonalData] = useState<{
    name: string | null;
    location: string | null;
    school: string | null;
    program: string | null;
    year: string | null;
  }>({
    name: null,
    location: null,
    school: null,
    program: null,
    year: null,
  });
  const [isLoadingModules, setIsLoadingModules] = useState(true);
  const [isLoadingCareerExplorer, setIsLoadingCareerExplorer] = useState(true);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [educationSkills, setEducationSkills] = useState<Skill[]>([]);
  const [programmeSkills, setProgrammeSkills] = useState<string[]>([]);
  const [modules, setModules] = useState<ModuleSummary[]>([]);
  const [skillsInterestsProgress, setSkillsInterestsProgress] = useState<number>(0);
  const [careerExplorerSectors, setCareerExplorerSectors] = useState<UserSectorEngagementItem[]>([]);

  const activeSessionId = useMemo(() => UserPreferencesStateService.getInstance().getActiveSessionId(), []);

  // Individual error states for each component
  const [errors, setErrors] = useState<{
    security: Error | null;
    preferences: Error | null;
    profile: Error | null;
    skills: Error | null;
    modules: Error | null;
    careerExplorer: Error | null;
  }>({
    security: null,
    preferences: null,
    profile: null,
    skills: null,
    modules: null,
    careerExplorer: null,
  });

  // Effect 1: Fetch security data (email from authenticated user)
  useEffect(() => {
    const fetchSecurityData = async () => {
      try {
        setIsLoadingSecurity(true);
        setErrors((prev) => ({ ...prev, security: null }));

        const authenticatedUser = authenticationStateService.getInstance().getUser();
        if (!authenticatedUser) {
          console.warn("useUserProfile: no authenticated user, skipping security data fetch");
          return;
        }

        setSecurityData({ email: authenticatedUser.email });
      } catch (error) {
        console.error("Error fetching security data:", error);
        setErrors((prev) => ({ ...prev, security: error as Error }));
      } finally {
        setIsLoadingSecurity(false);
      }
    };

    fetchSecurityData();
  }, []);

  // Effect 2: Fetch user preferences (terms accepted date, language)
  useEffect(() => {
    const fetchPreferencesData = async () => {
      try {
        setIsLoadingPreferences(true);
        setErrors((prev) => ({ ...prev, preferences: null }));

        const userPreferences = UserPreferencesStateService.getInstance().getUserPreferences();
        if (!userPreferences) {
          console.warn("useUserProfile: no user preferences found, skipping preferences fetch");
          return;
        }

        setPreferencesData({
          termsAcceptedDate: userPreferences.accepted_tc || null,
          language: userPreferences.language || null,
        });
      } catch (error) {
        console.error("Error fetching preferences data:", error);
        setErrors((prev) => ({ ...prev, preferences: error as Error }));
      } finally {
        setIsLoadingPreferences(false);
      }
    };

    fetchPreferencesData();
  }, []);

  // Effect 3: Fetch personal profile data (name, location, school, program, year)
  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        setIsLoadingProfile(true);
        setErrors((prev) => ({ ...prev, profile: null }));

        const user = authenticationStateService.getInstance().getUser();
        const userId = user?.id;

        if (!userId) {
          console.warn("useUserProfile: no authenticated user ID, skipping profile data fetch");
          return;
        }

        const data = await fetchPersonalData(userId);
        setPersonalData(data);
      } catch (error: any) {
        // Handle 404 gracefully - user may not have personal data yet
        if (error?.statusCode === 404) {
          console.log("Personal data not found (404) - user may not have set up profile yet");
          setErrors((prev) => ({ ...prev, profile: null }));
        } else {
          console.error("Error fetching profile data:", error);
          setErrors((prev) => ({ ...prev, profile: error as Error }));
        }
      } finally {
        setIsLoadingProfile(false);
      }
    };

    fetchProfileData();
  }, []);

  // Effect 4: Fetch skills from experiences and programme skills
  useEffect(() => {
    const fetchSkillsData = async () => {
      try {
        setIsLoadingSkills(true);
        setErrors((prev) => ({ ...prev, skills: null }));

        const [skillsData, programmeSkillLabels] = await Promise.all([
          fetchSkills(),
          SidebarService.getInstance().getProgrammeSkills(),
        ]);

        setSkills(skillsData.workSkills);
        setProgrammeSkills(programmeSkillLabels);

        // Programme skills are education skills — merge them with experience-based education skills
        const programmeSkillObjects: Skill[] = programmeSkillLabels.map((label, i) => ({
          UUID: `programme-skill-${i}`,
          preferredLabel: label,
          altLabels: [],
          description: "",
          orderIndex: i,
        }));
        setEducationSkills([...skillsData.educationSkills, ...programmeSkillObjects]);
      } catch (error) {
        console.error("Error fetching skills:", error);
        setErrors((prev) => ({ ...prev, skills: error as Error }));
      } finally {
        setIsLoadingSkills(false);
      }
    };

    fetchSkillsData();
  }, []);

  // Effect 5: Fetch skills & interests progress from chat history
  useEffect(() => {
    if (!activeSessionId) return;

    ChatService.getInstance()
      .getChatHistory(activeSessionId)
      .then((history) => {
        setSkillsInterestsProgress(history.current_phase?.percentage ?? 0);
      })
      .catch(() => {
        setSkillsInterestsProgress(0);
      });
  }, [activeSessionId]);

  // Effect 6: Fetch career readiness module statuses from API
  useEffect(() => {
    const fetchModules = async () => {
      if (!authenticationStateService.getInstance().getUser()) {
        console.warn("useUserProfile: no authenticated user, skipping career readiness modules fetch");
        setIsLoadingModules(false);
        return;
      }
      try {
        setIsLoadingModules(true);
        setErrors((prev) => ({ ...prev, modules: null }));

        const response = await CareerReadinessService.getInstance().listModules();
        setModules(response.modules);
      } catch (error) {
        console.error("Error fetching career readiness modules:", error);
        setErrors((prev) => ({ ...prev, modules: error as Error }));
      } finally {
        setIsLoadingModules(false);
      }
    };

    fetchModules();
  }, []);

  // Effect 7: Fetch career explorer sector engagement for the user
  useEffect(() => {
    const fetchCareerExplorerData = async () => {
      if (!authenticationStateService.getInstance().getUser()) {
        console.warn("useUserProfile: no authenticated user, skipping career explorer fetch");
        setIsLoadingCareerExplorer(false);
        return;
      }
      try {
        setIsLoadingCareerExplorer(true);
        setErrors((prev) => ({ ...prev, careerExplorer: null }));

        const response = await CareerExplorerService.getInstance().getSectorEngagementForUser();
        setCareerExplorerSectors(response.data);
      } catch (error) {
        console.error("Error fetching career explorer engagement:", error);
        setErrors((prev) => ({ ...prev, careerExplorer: error as Error }));
      } finally {
        setIsLoadingCareerExplorer(false);
      }
    };

    fetchCareerExplorerData();
  }, []);

  // Combine all data into a single profile object
  const profileData: UserProfileData = {
    email: securityData.email,
    termsAcceptedDate: preferencesData.termsAcceptedDate,
    language: preferencesData.language,
    name: personalData.name,
    location: personalData.location,
    school: personalData.school,
    program: personalData.program,
    year: personalData.year,
    skills,
    educationSkills,
    programmeSkills,
    modules,
    skillsInterestsProgress,
    careerExplorerSectors,
  };

  const isLoading =
    isLoadingSecurity ||
    isLoadingPreferences ||
    isLoadingProfile ||
    isLoadingSkills ||
    isLoadingModules ||
    isLoadingCareerExplorer;

  return {
    profileData,
    isLoading,
    isLoadingSecurity,
    isLoadingPreferences,
    isLoadingProfile,
    isLoadingSkills,
    isLoadingModules,
    isLoadingCareerExplorer,
    errors,
  };
};
