export enum WorkType {
  SELF_EMPLOYMENT = "SELF_EMPLOYMENT",
  FORMAL_SECTOR_WAGED_EMPLOYMENT = "FORMAL_SECTOR_WAGED_EMPLOYMENT",
  FORMAL_SECTOR_UNPAID_TRAINEE_WORK = "FORMAL_SECTOR_UNPAID_TRAINEE_WORK",
  UNSEEN_UNPAID = "UNSEEN_UNPAID",
}

export interface Skill {
  UUID: string;
  preferredLabel: string;
  description: string;
  altLabels: string[];
}

export interface Timeline {
  start: string;
  end: string;
}

export enum DiveInPhase {
  NOT_STARTED = "NOT_STARTED",
  EXPLORING_SKILLS = "EXPLORING_SKILLS",
  LINKING_RANKING = "LINKING_RANKING",
  PROCESSED = "PROCESSED",
}

export interface Experience {
  UUID: string;
  timeline: Timeline;
  experience_title: string;
  company: string;
  location: string;
  work_type: WorkType | null;
  top_skills: Skill[];
  summary: string | null;
  exploration_phase: DiveInPhase;
  deleted: boolean;
}

export interface SkillUpdate {
  UUID: string;
  preferredLabel: string;
}

export interface UpdateExperienceRequest {
  experience_title?: string;
  timeline?: Timeline;
  company?: string;
  location?: string;
  work_type?: WorkType | null;
  summary?: string | null;
  top_skills?: SkillUpdate[];
}

// Field length limits (keep in sync with backend)
export const EXPERIENCE_TITLE_MAX_LENGTH = 100;
export const COMPANY_MAX_LENGTH = 100;
export const LOCATION_MAX_LENGTH = 100;
export const SUMMARY_MAX_LENGTH = 1000;
export const TIMELINE_MAX_LENGTH = 30;
