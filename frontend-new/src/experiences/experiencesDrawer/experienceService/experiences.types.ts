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

export interface Experience {
  UUID: string;
  start_date: string;
  end_date: string;
  experience_title: string;
  company: string;
  location: string;
  work_type: WorkType;
  top_skills: Skill[];
}

export interface StoredPersonalInfo {
  name: string;
  phone: string;
  email: string;
  address: string;
}
