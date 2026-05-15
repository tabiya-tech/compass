export interface DashboardStats {
  institutions_active: number;
  total_students: number;
  active_students_7_days: number;
}

export interface InstitutionApiItem {
  id: string;
  name: string;
  active: boolean;
  students: number | null;
  active_7_days: number | null;
  skills_discovery_started_pct: number | null;
  skills_discovery_completed_pct: number | null;
  career_readiness_started_pct: number | null;
  career_readiness_completed_pct: number | null;
  career_explorer_started_pct: number | null;
}

export interface StudentApiItem {
  id: string;
  name: string | null;
  institution: string | null;
  province: string | null;
  programme: string | null;
  year: string | null;
  gender: string | null;
  active: boolean;
  modules_explored: number | null;
  career_readiness_modules_explored: number | null;
  skills_interests_explored: number | null;
  skills_discovery_status: "not_started" | "in_progress" | "completed" | null;
  career_explorer_messages_sent: number | null;
  last_login: string | null;
  last_active_module: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    limit: number;
    next_cursor: string | null;
    has_more: boolean;
    total: number | null;
  };
}

export interface AdoptionTrendPoint {
  date: string;
  new_registrations: number;
  daily_active_users: number;
}

export interface AdoptionTrendsResponse {
  data: AdoptionTrendPoint[];
  meta: {
    start_date: string;
    end_date: string;
    interval: string;
  };
}

export interface SkillGapEntry {
  skill_id: string;
  skill_label: string;
  students_with_gap_count: number;
  avg_job_unlock_count: number;
  avg_proximity_score: number;
}

export interface SkillGapStatsResponse {
  total_students_with_skill_gaps: number;
  top_skill_gaps: SkillGapEntry[];
}

export interface CareerReadinessModuleBreakdown {
  module_id: string;
  module_title: string;
  started_count: number;
  completed_count: number;
}

export interface CareerReadinessStatsResponse {
  total_registered_students: number;
  started: { count: number; percentage: number };
  completed_all_modules: { count: number; percentage_of_started: number };
  avg_modules_completed: number;
  total_modules: number;
  module_breakdown: CareerReadinessModuleBreakdown[];
}

export interface SkillSupplyEntry {
  skill_id: string;
  skill_label: string;
  student_count: number;
  avg_score: number;
}

export interface SkillsSupplyStatsResponse {
  total_students_with_skills: number;
  top_skills: SkillSupplyEntry[];
}

export interface CareerExplorerSectorStat {
  sector_name: string;
  is_priority: boolean;
  unique_users: number;
  total_inquiries: number;
}

export interface CareerExplorerStatsResponse {
  total_registered_students: number;
  started: { count: number; percentage: number };
  returned_2_plus: { count: number; percentage: number };
  priority_sector_users: number;
  non_priority_sector_users: number;
  top_sectors: CareerExplorerSectorStat[];
}

export interface SkillsDiscoveryFunnelStage {
  label: string;
  count: number;
  total: number;
}

export interface SkillsDiscoveryStatsResponse {
  total_registered_students: number;
  started: { count: number; percentage: number };
  completed: { count: number; percentage: number };
  in_progress_count: number;
  funnel: SkillsDiscoveryFunnelStage[];
}

export interface InstitutionFilterOptionsResponse {
  institution_names: string[];
  provinces: string[];
  sectors: string[];
}

export interface JobApiItem {
  title?: string;
  employer?: string;
  category?: string;
  employment_type?: string;
  location?: string;
  posted_date?: string;
  closing_date?: string;
  application_url?: string;
  source_platform?: string;
  skills?: string[];
}

export interface JobStatsResponse {
  total: number;
  sectors: number;
  platforms: number;
}
