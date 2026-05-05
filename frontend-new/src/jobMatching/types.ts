// ─── API response shape ───────────────────────────────────────────────────────

/** Raw document returned by GET /jobs. Fields match the Zambia jobs DB. */
export interface JobApiDocument {
  uuid?: string;
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

/**
 * Raw document returned by GET /jobs/matched (inside the envelope's `matches` field).
 * Field names mirror the matching service response shape (opportunity_title / contract_type / URL),
 * enriched with employer/category/posted_date from the local jobs collection when the URL matches.
 */
export interface MatchedJobApiDocument {
  uuid?: string;
  opportunity_title?: string;
  location?: string;
  contract_type?: string;
  URL?: string;
  final_score?: number;
  justification?: string;
  rank?: number;
  // Enriched from the jobs collection
  employer?: string;
  category?: string;
  posted_date?: string;
}

/**
 * Tells the frontend which path produced the matches:
 *  - "s&i": user has S&I-extracted skills (matches reflect their explored experiences)
 *  - "programme": user has a programme on file but no S&I skills yet (matches come from the programme catalog)
 *  - "none": user has neither — `matches` will be empty; the frontend renders an explanatory empty state.
 */
export type SkillsSource = "s&i" | "programme" | "none";

/** Envelope returned by GET /jobs/matched. */
export interface MatchedJobsApiResponse {
  matches: MatchedJobApiDocument[];
  skills_source: SkillsSource;
}

export interface JobsApiMeta {
  limit: number;
  next_cursor: string | null;
  has_more: boolean;
  total: number | null;
}

export interface JobsApiResponse {
  data: JobApiDocument[];
  meta: JobsApiMeta;
}

// ─── UI row shape ─────────────────────────────────────────────────────────────

/** Normalised row used by the table and detail modal. */
export interface JobRow {
  id: string;
  jobTitle: string;
  company: string;
  category: string;
  employmentType: string;
  location: string;
  posted: string;
  jobUrl?: string;
  skills?: string[];
  /** Match score (0–100), only set for the Matched For You tab */
  matchScore?: number;
}

// ─── Filter state ─────────────────────────────────────────────────────────────

export interface JobFilters {
  search: string;
  category: string;
  employmentType: string;
  location: string;
}

export type JobSortKey = "jobTitle" | "category" | "location" | "posted";
export type JobSortDir = "asc" | "desc";
