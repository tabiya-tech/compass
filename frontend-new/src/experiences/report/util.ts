import { Experience, Skill, WorkType } from "src/experiences/experienceService/experiences.types";
import { customFetch } from "src/utils/customFetch/customFetch";

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

export const formatDate = (dateString: string | null): string => {
  // Use UTC to avoid timezone differences in snapshots/tests
  const date = dateString ? new Date(dateString) : new Date();
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const month = monthNames[date.getUTCMonth()];
  const day = String(date.getUTCDate()).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${month} ${day}, ${year}`;
};

// Utility function to group experiences by work type
export const groupExperiencesByWorkType = (experiences: Experience[]) => {
  const selfEmploymentExperiences = experiences.filter(
    (experience) => experience.work_type === WorkType.SELF_EMPLOYMENT
  );

  const salaryWorkExperiences = experiences.filter(
    (experience) => experience.work_type === WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT
  );

  const unpaidWorkExperiences = experiences.filter((experience) => experience.work_type === WorkType.UNSEEN_UNPAID);

  const traineeWorkExperiences = experiences.filter(
    (experience) => experience.work_type === WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK
  );

  const uncategorizedExperiences = experiences.filter((experience) => experience.work_type === null);

  return {
    selfEmploymentExperiences,
    salaryWorkExperiences,
    unpaidWorkExperiences,
    traineeWorkExperiences,
    uncategorizedExperiences,
  };
};

// Convert local image to base64
export const getBase64Image = async (url: string) => {
  const response = await customFetch(url, {
    expectedStatusCode: [200, 204],
    serviceName: "SkillsReportService",
    serviceFunction: "getBase64Image",
    failureMessage: `Failed to fetch image: ${url}`,
    authRequired: false,
    retryOnFailedToFetch: true,
  });

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
