import { Experience, Skill, WorkType } from "src/Experiences/ExperienceService/Experiences.types";

// Get a list of all unique skills in alphabetical order
export const getUniqueSkills = (experiences: Experience[]): Skill[] => {
  const skillOnly: Skill[] = [];
  experiences.forEach((experience) => {
    experience.top_skills.forEach((skill) => {
      if (!skillOnly.find((sk) => sk.preferredLabel === skill.preferredLabel)) {
        skillOnly.push(skill);
      }
    });
  });
  return skillOnly.sort((a, b) => a.preferredLabel.localeCompare(b.preferredLabel));
};

export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const options: Intl.DateTimeFormatOptions = { month: "long", day: "2-digit", year: "numeric" };
  return date.toLocaleDateString("en-US", options);
};

// Utility function to group experiences by work type
export const groupExperiencesByWorkType = (experiences: Experience[]) => {
  const experiencesWithTopSkills = experiences.filter(
    (experience) => experience.top_skills && experience.top_skills.length > 0
  );

  const selfEmploymentExperiences = experiencesWithTopSkills.filter(
    (experience) => experience.work_type === WorkType.SELF_EMPLOYMENT
  );

  const salaryWorkExperiences = experiencesWithTopSkills.filter(
    (experience) => experience.work_type === WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT
  );

  const unpaidWorkExperiences = experiencesWithTopSkills.filter(
    (experience) => experience.work_type === WorkType.UNSEEN_UNPAID
  );

  const traineeWorkExperiences = experiencesWithTopSkills.filter(
    (experience) => experience.work_type === WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK
  );

  return { selfEmploymentExperiences, salaryWorkExperiences, unpaidWorkExperiences, traineeWorkExperiences };
};

// Convert local image to base64
export const getBase64Image = async (url: string) => {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(blob);
  });
};

/**
 * Note: We cannot use the theme colors directly since the reports are not React components.
 * Most of the colors come from an export in the `applicationTheme.tsx` file.
 * However, the colors that we cannot export are redefined here.
 **/
export const COLORS = {
  textBlack: "#000000",
  grey700: "#605E5B",
};

// Utility function to prettify text
export const prettifyText = (text: string) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .join(" ");
