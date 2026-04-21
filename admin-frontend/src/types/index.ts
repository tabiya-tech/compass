export interface DashboardStatItem {
  id?: string;
  titleKey: string;
  value: string | number;
  subtitleKey?: string;
}

export interface InstitutionRow {
  id: string;
  institution: string;
  students: number | null;
  active7Days: number | null;
  skillsDiscoveryStartedPct: number | null;
  skillsDiscoveryCompletedPct: number | null;
  careerReadinessStartedPct: number | null;
  careerReadinessCompletedPct: number | null;
  careerExplorerStartedPct: number | null;
}

export interface InstructorDashboardStatItem {
  id: string;
  titleKey: string;
  value: string | number;
  subtitleKey?: string;
  subtitleValues?: Record<string, string | number>;
}

export interface InstructorStudentRow {
  id: string;
  studentName: string;
  programme: string;
  year: string;
  gender: string;
  modulesExplored: number;
  careerReady: string;
  skillsInterestsExplored: number;
  lastLogin: string;
  lastActiveModuleId: string;
}

export interface ModuleSummaryRow {
  labelKey: string;
  value: number;
  total: number;
  pct: number;
  showBar: boolean;
}

export interface ModuleBreakdownItem {
  labelKey: string;
  value?: number;
  total?: number;
  completed?: number;
  percentage?: number;
  color?: string;
}

export interface ModuleData {
  id: string;
  titleKey: string;
  totalStudents: number;
  summary: ModuleSummaryRow[];
  breakdownType: "funnel" | "subModules" | "topSectors";
  breakdownTitleKey: string;
  breakdownCaption?: string;
  breakdownItems: ModuleBreakdownItem[];
}

export interface SkillsDemandSupplyData {
  [key: string]: string | number;
  skillName: string;
  supplyPct: number;
  demandPct: number;
}

export interface SkillsGapSectorData {
  sector: string;
  supplyPct: number;
  demandPct: number;
}

export interface JobPostingStats {
  jobsSourced: number;
  sectorsCovered: number;
  sourcePlatformsCount: number;
}

export interface JobPostingRow {
  id: string;
  jobTitle: string | null;
  sector: string | null;
  location: string | null;
  zqfLevel: string;
  platform: string | null;
  skills: string[];
  candidatePool: number;
  jobUrl: string;
}
