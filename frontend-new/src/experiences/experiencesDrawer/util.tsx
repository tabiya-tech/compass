import React from "react";
import {
  COMPANY_MAX_LENGTH,
  Experience,
  EXPERIENCE_TITLE_MAX_LENGTH,
  LOCATION_MAX_LENGTH,
  Skill,
  SUMMARY_MAX_LENGTH,
  TIMELINE_MAX_LENGTH,
  WorkType,
} from "src/experiences/experienceService/experiences.types";
import { ReportContent } from "src/experiences/report/reportContent";
import type { SvgIconProps } from "@mui/material/SvgIcon";
import StoreIcon from "@mui/icons-material/Store";
import WorkIcon from "@mui/icons-material/Work";
import VolunteerActivismIcon from "@mui/icons-material/VolunteerActivism";
import SchoolIcon from "@mui/icons-material/School";
import QuizIcon from "@mui/icons-material/Quiz";
import i18n from "src/i18n/i18n";

export const WORK_TYPE_DESCRIPTIONS = {
  get SELF_EMPLOYMENT() {
    return i18n.t("experiences_work_type_description_self_employment");
  },
  get FORMAL_SECTOR_WAGED_EMPLOYMENT() {
    return i18n.t("experiences_work_type_description_formal_sector_waged_employment");
  },
  get FORMAL_SECTOR_UNPAID_TRAINEE_WORK() {
    return i18n.t("experiences_work_type_description_formal_sector_unpaid_trainee_work");
  },
  get UNSEEN_UNPAID() {
    return i18n.t("experiences_work_type_description_unseen_unpaid");
  },
  get UNCATEGORIZED() {
    return i18n.t("experiences_work_type_description_uncategorized");
  },
} as const;

export const getWorkTypeTitle = (workType: WorkType | null) => {
  switch (workType) {
    case WorkType.SELF_EMPLOYMENT:
      return ReportContent.SELF_EMPLOYMENT_TITLE;
    case WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT:
      return ReportContent.SALARY_WORK_TITLE;
    case WorkType.UNSEEN_UNPAID:
      return ReportContent.UNPAID_WORK_TITLE;
    case WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK:
      return ReportContent.TRAINEE_WORK_TITLE;
    default:
      return ReportContent.UNCATEGORIZED_TITLE;
  }
};

export const getWorkTypeDescription = (workType: WorkType | null) => {
  switch (workType) {
    case WorkType.SELF_EMPLOYMENT:
      return WORK_TYPE_DESCRIPTIONS.SELF_EMPLOYMENT;
    case WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT:
      return WORK_TYPE_DESCRIPTIONS.FORMAL_SECTOR_WAGED_EMPLOYMENT;
    case WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK:
      return WORK_TYPE_DESCRIPTIONS.FORMAL_SECTOR_UNPAID_TRAINEE_WORK;
    case WorkType.UNSEEN_UNPAID:
      return WORK_TYPE_DESCRIPTIONS.UNSEEN_UNPAID;
    default:
      return WORK_TYPE_DESCRIPTIONS.UNCATEGORIZED;
  }
};

export const getWorkTypeIcon = (workType: WorkType | null, iconProps?: SvgIconProps): JSX.Element => {
  switch (workType) {
    case WorkType.SELF_EMPLOYMENT:
      return <StoreIcon {...iconProps} />;
    case WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT:
      return <WorkIcon {...iconProps} />;
    case WorkType.UNSEEN_UNPAID:
      return <VolunteerActivismIcon {...iconProps} />;
    case WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK:
      return <SchoolIcon {...iconProps} />;
    default:
      return <QuizIcon {...iconProps} />;
  }
};

/**
 * Sorts skills by their orderIndex in ascending order (starting from 0 upwards).
 * @param skills Array of skills to sort
 * @returns New array of skills sorted by orderIndex
 */
export const sortSkillsByOrderIndex = <T extends Skill>(skills: T[]): T[] => {
  return [...skills].sort((a, b) => a.orderIndex - b.orderIndex);
};

/**
 * Checks for field errors in an Experience object
 * @param experience Experience object to check
 * @returns Object with field names as keys and error messages as values
 */
export const checkInitialFieldErrors = (experience: Experience) => {
  const errors: { [key: string]: string } = {};
  if (experience.experience_title && experience.experience_title.length > EXPERIENCE_TITLE_MAX_LENGTH) {
    errors.experience_title = `Maximum ${EXPERIENCE_TITLE_MAX_LENGTH} characters allowed.`;
  }
  if (experience.company && experience.company.length > COMPANY_MAX_LENGTH) {
    errors.company = `Maximum ${COMPANY_MAX_LENGTH} characters allowed.`;
  }
  if (experience.location && experience.location.length > LOCATION_MAX_LENGTH) {
    errors.location = `Maximum ${LOCATION_MAX_LENGTH} characters allowed.`;
  }
  if (experience.summary && experience.summary.length > SUMMARY_MAX_LENGTH) {
    errors.summary = `Maximum ${SUMMARY_MAX_LENGTH} characters allowed.`;
  }
  if (experience.timeline.start && experience.timeline.start.length > TIMELINE_MAX_LENGTH) {
    errors.timeline_start = `Maximum ${TIMELINE_MAX_LENGTH} characters allowed.`;
  }
  if (experience.timeline.end && experience.timeline.end.length > TIMELINE_MAX_LENGTH) {
    errors.timeline_end = `Maximum ${TIMELINE_MAX_LENGTH} characters allowed.`;
  }
  return errors;
};

/**
 * Gets a diff between original and current Experience objects
 * @param original Original Experience object
 * @param current Current Experience object
 * @returns Partial Experience containing only changed fields, or null if no changes
 */
export const getExperienceDiff = (original: Experience, current: Experience): Partial<Experience> | null => {
  const diff: Partial<Experience> = {};
  let hasChanges = false;

  // Compare basic fields
  if (original.experience_title !== current.experience_title) {
    diff.experience_title = current.experience_title;
    hasChanges = true;
  }

  if (original.company !== current.company) {
    diff.company = current.company;
    hasChanges = true;
  }

  if (original.location !== current.location) {
    diff.location = current.location;
    hasChanges = true;
  }

  if (original.summary !== current.summary) {
    diff.summary = current.summary;
    hasChanges = true;
  }

  if (original.work_type !== current.work_type) {
    diff.work_type = current.work_type;
    hasChanges = true;
  }

  if (original.timeline.start !== current.timeline.start || original.timeline.end !== current.timeline.end) {
    diff.timeline = current.timeline;
    hasChanges = true;
  }

  // Compare skills
  const originalSkills = original.top_skills || [];
  const currentSkills = current.top_skills || [];

  const originalSkillsMap = new Map(originalSkills.map((skill) => [skill.UUID, skill]));
  let skillsChanged = false;

  if (originalSkills.length !== currentSkills.length) {
    skillsChanged = true;
  }

  currentSkills.forEach((skill) => {
    const originalSkill = originalSkillsMap.get(skill.UUID);
    if (!originalSkill || originalSkill.preferredLabel !== skill.preferredLabel) {
      skillsChanged = true;
    }
  });

  if (skillsChanged) {
    diff.top_skills = currentSkills;
    hasChanges = true;
  }

  return hasChanges ? diff : null;
};
