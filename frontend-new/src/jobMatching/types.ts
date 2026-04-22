// ─── API response shape ───────────────────────────────────────────────────────

/** Raw document returned by GET /jobs. Fields match the Zambia jobs DB. */
export interface JobApiDocument {
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
