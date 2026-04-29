import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { UserPreference } from "src/userPreferences/UserPreferencesService/userPreferences.types";
import ExperienceService from "src/experiences/experienceService/experienceService";
import { Experience, Skill } from "src/experiences/experienceService/experiences.types";

export interface FetchSkillsResult {
  workSkills: Skill[];
  educationSkills: Skill[];
  totalExperiences: number;
  exploredExperiences: number;
}

const aggregateTopSkills = (experiences: Experience[]): Skill[] => {
  const skillsMap = new Map<string, Skill>();

  experiences.forEach((experience) => {
    experience.top_skills.forEach((skill) => {
      if (!skillsMap.has(skill.UUID)) {
        skillsMap.set(skill.UUID, skill);
      }
    });
  });

  return Array.from(skillsMap.values());
};

export async function fetchSkills(): Promise<FetchSkillsResult> {
  const userPreferences: UserPreference | null = UserPreferencesStateService.getInstance().getUserPreferences();
  const sessions = userPreferences?.sessions || [];

  if (sessions.length === 0) {
    return { workSkills: [], educationSkills: [], totalExperiences: 0, exploredExperiences: 0 };
  }

  // Fetch experiences for all sessions in parallel
  const experiencesArrays = await Promise.all(
    sessions.map(async (sessionId) => {
      try {
        return await ExperienceService.getInstance().getExperiences(sessionId);
      } catch (error) {
        console.error(`Failed to fetch experiences for session ${sessionId}:`, error);
        return [];
      }
    })
  );

  // Flatten all experiences into a single array
  const allExperiences = experiencesArrays.flat();
  const totalExperiences = allExperiences.length;
  const exploredExperiences = allExperiences.filter((exp) => exp.top_skills.length > 0).length;

  return {
    // Work & Other Skills should only show top skills.
    workSkills: aggregateTopSkills(allExperiences),
    educationSkills: [],
    totalExperiences,
    exploredExperiences,
  };
}
