import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ReconnectVersionContext } from "src/app/isOnlineProvider/IsOnlineProvider";
import { fetchSkills } from "./utils/fetchSkills";
import { Skill } from "src/experiences/experienceService/experiences.types";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import authenticationStateService from "src/auth/services/AuthenticationState.service";
import UserMeService from "src/userMe/UserMeService";
import type { UserSectorEngagementItem } from "src/careerExplorer/services/CareerExplorerService";
import type { ModuleSummary } from "src/careerReadiness/types";

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
  refreshModules: () => void;
}

/**
 * Hook to fetch and manage user profile data.
 *
 * Uses two consolidated backend endpoints to replace the previous 5 separate calls:
 *   - GET /users/me/profile  → personal data + programme skills
 *   - GET /users/me/progress → chat progress % + career readiness modules + sector engagement
 *
 * Skills from experiences (fetchSkills) remain separate since they aggregate
 * across multiple sessions client-side.
 */
export const useUserProfile = (): UseUserProfileResult => {
  const reconnectVersion = useContext(ReconnectVersionContext);
  // Individual loading states
  const [isLoadingSecurity, setIsLoadingSecurity] = useState(true);
  const [isLoadingPreferences, setIsLoadingPreferences] = useState(true);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isLoadingSkills, setIsLoadingSkills] = useState(true);
  // isLoadingModules and isLoadingCareerExplorer are now part of the progress fetch
  // but kept as separate flags for backwards-compatible granularity
  const [isLoadingModules, setIsLoadingModules] = useState(true);
  const [isLoadingCareerExplorer, setIsLoadingCareerExplorer] = useState(true);

  // Individual data states
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
  const [skills, setSkills] = useState<Skill[]>([]);
  const [educationSkills, setEducationSkills] = useState<Skill[]>([]);
  const [programmeSkills, setProgrammeSkills] = useState<string[]>([]);
  const [modules, setModules] = useState<ModuleSummary[]>([]);
  const [skillsInterestsProgress, setSkillsInterestsProgress] = useState<number>(0);
  const [careerExplorerSectors, setCareerExplorerSectors] = useState<UserSectorEngagementItem[]>([]);

  const activeSessionId = useMemo(() => UserPreferencesStateService.getInstance().getActiveSessionId(), []);

  // Individual error states
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

  // Effect 1: Read security data (email) from auth state — no API call
  useEffect(() => {
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
      console.error("Error reading security data:", error);
      setErrors((prev) => ({ ...prev, security: error as Error }));
    } finally {
      setIsLoadingSecurity(false);
    }
  }, []);

  // Effect 2: Read user preferences (terms date, language) from client-side cache — no API call
  useEffect(() => {
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
      console.error("Error reading preferences data:", error);
      setErrors((prev) => ({ ...prev, preferences: error as Error }));
    } finally {
      setIsLoadingPreferences(false);
    }
  }, []);

  // Effect 3+4 combined: fetch profile (personal data + programme skills) AND experiences in parallel.
  // Merging them avoids a double-fetch: previously Effect 4 had [programmeSkills] as a dep,
  // causing it to run once on mount (programmeSkills=[]) then again after Effect 3 set them.
  useEffect(() => {
    const fetchProfileAndSkills = async () => {
      const user = authenticationStateService.getInstance().getUser();
      if (!user?.id) {
        console.warn("useUserProfile: no authenticated user, skipping profile + skills fetch");
        setIsLoadingProfile(false);
        setIsLoadingSkills(false);
        return;
      }

      setIsLoadingProfile(true);
      setIsLoadingSkills(true);
      setErrors((prev) => ({ ...prev, profile: null, skills: null }));

      // Fetch both in parallel — neither depends on the other
      const [profileResult, skillsResult] = await Promise.allSettled([
        UserMeService.getInstance().getProfile(),
        fetchSkills(),
      ]);

      // Handle profile result
      if (profileResult.status === "fulfilled") {
        const profileResponse = profileResult.value;
        const data = profileResponse.personal_data;
        const firstName = data?.first_name;
        const lastName = data?.last_name;
        const name = firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName || null;

        setPersonalData({
          name,
          location: data?.province ?? null,
          school: data?.institution_name ?? null,
          program: data?.programme_name ?? null,
          year: data?.school_year ?? null,
        });
        setProgrammeSkills(profileResponse.programme_skills);

        // Also merge programme skills into education skills now that we have both
        const resolvedProgrammeSkills = profileResponse.programme_skills;
        const programmeSkillObjects: Skill[] = resolvedProgrammeSkills.map((label, i) => ({
          UUID: `programme-skill-${i}`,
          preferredLabel: label,
          altLabels: [],
          description: "",
          orderIndex: i,
        }));

        if (skillsResult.status === "fulfilled") {
          setSkills(skillsResult.value.workSkills);
          setEducationSkills([...skillsResult.value.educationSkills, ...programmeSkillObjects]);
        }
      } else {
        const error = profileResult.reason as any;
        // 404 = user hasn't set up their profile yet — not worth surfacing
        if (error?.statusCode === 404) {
          console.log("Personal data not found (404) — user may not have set up their profile yet");
        } else {
          console.error("Error fetching user profile:", error);
          setErrors((prev) => ({ ...prev, profile: error as Error }));
        }

        // Skills still usable without programme skills
        if (skillsResult.status === "fulfilled") {
          setSkills(skillsResult.value.workSkills);
          setEducationSkills(skillsResult.value.educationSkills);
        }
      }

      // Handle skills error separately if profile succeeded but skills failed
      if (profileResult.status === "fulfilled" && skillsResult.status === "rejected") {
        console.error("Error fetching skills:", skillsResult.reason);
        setErrors((prev) => ({ ...prev, skills: skillsResult.reason as Error }));
      }

      setIsLoadingProfile(false);
      setIsLoadingSkills(false);
    };

    fetchProfileAndSkills();
  }, []);

  const fetchProgress = useCallback(
    async (opts: { setLoading: boolean } = { setLoading: true }) => {
      if (!authenticationStateService.getInstance().getUser()) {
        console.warn("useUserProfile: no authenticated user, skipping progress fetch");
        if (opts.setLoading) {
          setIsLoadingModules(false);
          setIsLoadingCareerExplorer(false);
        }
        return;
      }
      if (opts.setLoading) {
        setIsLoadingModules(true);
        setIsLoadingCareerExplorer(true);
        setErrors((prev) => ({ ...prev, modules: null, careerExplorer: null }));
      }
      try {
        const progressResponse = await UserMeService.getInstance().getProgress(activeSessionId);
        setSkillsInterestsProgress(progressResponse.skills_interests_progress);
        setModules(progressResponse.career_readiness_modules);
        setCareerExplorerSectors(progressResponse.sector_engagement);
      } catch (error) {
        console.error("Error fetching user progress:", error);
        if (opts.setLoading) {
          setErrors((prev) => ({ ...prev, modules: error as Error, careerExplorer: error as Error }));
        }
      } finally {
        if (opts.setLoading) {
          setIsLoadingModules(false);
          setIsLoadingCareerExplorer(false);
        }
      }
    },
    [activeSessionId]
  );

  // Effect 5: GET /users/me/progress — chat progress % + modules + sector engagement (3 old calls → 1)
  // reconnectVersion triggers a re-fetch when the app comes back online
  useEffect(() => {
    fetchProgress({ setLoading: true });
  }, [fetchProgress, reconnectVersion]);

  const refreshModules = useCallback(() => {
    fetchProgress({ setLoading: false });
  }, [fetchProgress]);

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
    refreshModules,
  };
};
