import { StatusCodes } from "http-status-codes";
import { customFetch } from "src/utils/customFetch/customFetch";
import { getBackendUrl } from "src/envService";
import { getRestAPIErrorFactory } from "src/error/restAPIError/RestAPIError";
import ErrorConstants from "src/error/restAPIError/RestAPIError.constants";
import type {
  DashboardStats,
  InstitutionApiItem,
  JobApiItem,
  JobStatsResponse,
  StudentApiItem,
  PaginatedResponse,
  AdoptionTrendsResponse,
  SkillGapStatsResponse,
  CareerReadinessStatsResponse,
  CareerExplorerStatsResponse,
  SkillsDiscoveryStatsResponse,
  SkillsSupplyStatsResponse,
} from "./AnalyticsService.types";

export type {
  DashboardStats,
  InstitutionApiItem,
  JobApiItem,
  JobStatsResponse,
  StudentApiItem,
  PaginatedResponse,
  AdoptionTrendsResponse,
  SkillGapStatsResponse,
  CareerReadinessStatsResponse,
  CareerExplorerStatsResponse,
  SkillsDiscoveryStatsResponse,
  SkillsSupplyStatsResponse,
};

const SERVICE_NAME = "AnalyticsService";

export default class AnalyticsService {
  private static instance: AnalyticsService;
  private readonly baseUrl: string;

  private constructor() {
    this.baseUrl = getBackendUrl();
  }

  static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  async getDashboardStats(): Promise<DashboardStats> {
    const url = `${this.baseUrl}/analytics/stats`;
    const errorFactory = getRestAPIErrorFactory(SERVICE_NAME, "getDashboardStats", "GET", url);
    const response = await customFetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      expectedStatusCode: StatusCodes.OK,
      serviceName: SERVICE_NAME,
      serviceFunction: "getDashboardStats",
      failureMessage: "Failed to fetch dashboard stats",
      expectedContentType: "application/json",
    });
    try {
      return (await response.json()) as DashboardStats;
    } catch (e) {
      throw errorFactory(response.status, ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY, "Invalid JSON", {
        error: e,
      });
    }
  }

  async listInstitutions(
    limit = 20,
    cursor?: string,
    sortBy?: string,
    sortDir?: "asc" | "desc",
    options?: { page?: number; includeCount?: boolean }
  ): Promise<PaginatedResponse<InstitutionApiItem>> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set("cursor", cursor);
    if (sortBy) {
      params.set("sort_by", sortBy);
      if (sortDir) params.set("sort_dir", sortDir);
    }
    if (options?.page !== undefined) params.set("page", String(options.page));
    if (options?.includeCount) params.set("include", "count");
    const url = `${this.baseUrl}/analytics/institutions?${params}`;
    const errorFactory = getRestAPIErrorFactory(SERVICE_NAME, "listInstitutions", "GET", url);
    const response = await customFetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      expectedStatusCode: StatusCodes.OK,
      serviceName: SERVICE_NAME,
      serviceFunction: "listInstitutions",
      failureMessage: "Failed to fetch institutions",
      expectedContentType: "application/json",
    });
    try {
      return (await response.json()) as PaginatedResponse<InstitutionApiItem>;
    } catch (e) {
      throw errorFactory(response.status, ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY, "Invalid JSON", {
        error: e,
      });
    }
  }

  async listStudents(filters?: {
    active?: boolean;
    institution?: string;
    province?: string;
    programme?: string;
    year?: string;
    search?: string;
    cursor?: string;
    limit?: number;
    include?: string;
  }): Promise<PaginatedResponse<StudentApiItem>> {
    const params = new URLSearchParams();
    if (filters?.active !== undefined) params.set("active", String(filters.active));
    if (filters?.institution) params.set("institution", filters.institution);
    if (filters?.province) params.set("province", filters.province);
    if (filters?.programme) params.set("programme", filters.programme);
    if (filters?.year) params.set("year", filters.year);
    if (filters?.search) params.set("search", filters.search);
    if (filters?.cursor) params.set("cursor", filters.cursor);
    params.set("limit", String(filters?.limit ?? 20));
    if (filters?.include) params.set("include", filters.include);

    const url = `${this.baseUrl}/students?${params}`;
    const errorFactory = getRestAPIErrorFactory(SERVICE_NAME, "listStudents", "GET", url);
    const response = await customFetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      expectedStatusCode: StatusCodes.OK,
      serviceName: SERVICE_NAME,
      serviceFunction: "listStudents",
      failureMessage: "Failed to fetch students",
      expectedContentType: "application/json",
    });
    try {
      return (await response.json()) as PaginatedResponse<StudentApiItem>;
    } catch (e) {
      throw errorFactory(response.status, ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY, "Invalid JSON", {
        error: e,
      });
    }
  }

  async getSkillGapStats(limit = 10, institution?: string): Promise<SkillGapStatsResponse> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (institution) params.set("institution", institution);
    const url = `${this.baseUrl}/analytics/skill-gap-stats?${params}`;
    const errorFactory = getRestAPIErrorFactory(SERVICE_NAME, "getSkillGapStats", "GET", url);
    const response = await customFetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      expectedStatusCode: StatusCodes.OK,
      serviceName: SERVICE_NAME,
      serviceFunction: "getSkillGapStats",
      failureMessage: "Failed to fetch skill gap stats",
      expectedContentType: "application/json",
    });
    try {
      return (await response.json()) as SkillGapStatsResponse;
    } catch (e) {
      throw errorFactory(response.status, ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY, "Invalid JSON", {
        error: e,
      });
    }
  }

  async getCareerReadinessStats(filters?: {
    institution?: string;
    location?: string;
    program?: string;
    year?: string;
  }): Promise<CareerReadinessStatsResponse> {
    const params = new URLSearchParams();
    if (filters?.institution) params.set("institution", filters.institution);
    if (filters?.location) params.set("location", filters.location);
    if (filters?.program) params.set("program", filters.program);
    if (filters?.year) params.set("year", filters.year);
    const query = params.toString();
    const url = `${this.baseUrl}/analytics/career-readiness-stats${query ? `?${query}` : ""}`;
    const errorFactory = getRestAPIErrorFactory(SERVICE_NAME, "getCareerReadinessStats", "GET", url);
    const response = await customFetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      expectedStatusCode: StatusCodes.OK,
      serviceName: SERVICE_NAME,
      serviceFunction: "getCareerReadinessStats",
      failureMessage: "Failed to fetch career readiness stats",
      expectedContentType: "application/json",
    });
    try {
      return (await response.json()) as CareerReadinessStatsResponse;
    } catch (e) {
      throw errorFactory(response.status, ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY, "Invalid JSON", {
        error: e,
      });
    }
  }

  async getSkillsSupplyStats(limit = 10, institution?: string): Promise<SkillsSupplyStatsResponse> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (institution) params.set("institution", institution);
    const url = `${this.baseUrl}/analytics/skills-supply-stats?${params}`;
    const errorFactory = getRestAPIErrorFactory(SERVICE_NAME, "getSkillsSupplyStats", "GET", url);
    const response = await customFetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      expectedStatusCode: StatusCodes.OK,
      serviceName: SERVICE_NAME,
      serviceFunction: "getSkillsSupplyStats",
      failureMessage: "Failed to fetch skills supply stats",
      expectedContentType: "application/json",
    });
    try {
      return (await response.json()) as SkillsSupplyStatsResponse;
    } catch (e) {
      throw errorFactory(response.status, ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY, "Invalid JSON", {
        error: e,
      });
    }
  }

  async getSkillsDiscoveryStats(filters?: {
    institution?: string;
    location?: string;
    program?: string;
    year?: string;
  }): Promise<SkillsDiscoveryStatsResponse> {
    const params = new URLSearchParams();
    if (filters?.institution) params.set("institution", filters.institution);
    if (filters?.location) params.set("location", filters.location);
    if (filters?.program) params.set("program", filters.program);
    if (filters?.year) params.set("year", filters.year);
    const query = params.toString();
    const url = `${this.baseUrl}/analytics/skills-discovery-stats${query ? `?${query}` : ""}`;
    const errorFactory = getRestAPIErrorFactory(SERVICE_NAME, "getSkillsDiscoveryStats", "GET", url);
    const response = await customFetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      expectedStatusCode: StatusCodes.OK,
      serviceName: SERVICE_NAME,
      serviceFunction: "getSkillsDiscoveryStats",
      failureMessage: "Failed to fetch skills discovery stats",
      expectedContentType: "application/json",
    });
    try {
      return (await response.json()) as SkillsDiscoveryStatsResponse;
    } catch (e) {
      throw errorFactory(response.status, ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY, "Invalid JSON", {
        error: e,
      });
    }
  }

  async getCareerExplorerStats(filters?: {
    institution?: string;
    location?: string;
    program?: string;
    year?: string;
  }): Promise<CareerExplorerStatsResponse> {
    const params = new URLSearchParams();
    if (filters?.institution) params.set("institution", filters.institution);
    if (filters?.location) params.set("location", filters.location);
    if (filters?.program) params.set("program", filters.program);
    if (filters?.year) params.set("year", filters.year);
    const query = params.toString();
    const url = `${this.baseUrl}/analytics/career-explorer-stats${query ? `?${query}` : ""}`;
    const errorFactory = getRestAPIErrorFactory(SERVICE_NAME, "getCareerExplorerStats", "GET", url);
    const response = await customFetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      expectedStatusCode: StatusCodes.OK,
      serviceName: SERVICE_NAME,
      serviceFunction: "getCareerExplorerStats",
      failureMessage: "Failed to fetch career explorer stats",
      expectedContentType: "application/json",
    });
    try {
      return (await response.json()) as CareerExplorerStatsResponse;
    } catch (e) {
      throw errorFactory(response.status, ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY, "Invalid JSON", {
        error: e,
      });
    }
  }

  async getJobStats(): Promise<JobStatsResponse> {
    const url = `${this.baseUrl}/jobs/stats`;
    const errorFactory = getRestAPIErrorFactory(SERVICE_NAME, "getJobStats", "GET", url);
    const response = await customFetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      expectedStatusCode: StatusCodes.OK,
      serviceName: SERVICE_NAME,
      serviceFunction: "getJobStats",
      failureMessage: "Failed to fetch job stats",
      expectedContentType: "application/json",
    });
    try {
      return (await response.json()) as JobStatsResponse;
    } catch (e) {
      throw errorFactory(response.status, ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY, "Invalid JSON", {
        error: e,
      });
    }
  }

  async listJobs(
    params: {
      search?: string;
      category?: string;
      employment_type?: string;
      location?: string;
      cursor?: string;
      limit?: number;
      sort_by?: "title" | "category" | "location" | "source_platform" | "posted_date";
      sort_dir?: "asc" | "desc";
      page?: number;
      include?: string;
    } = {}
  ): Promise<PaginatedResponse<JobApiItem>> {
    const query = new URLSearchParams();
    if (params.search) query.set("search", params.search);
    if (params.category) query.set("category", params.category);
    if (params.employment_type) query.set("employment_type", params.employment_type);
    if (params.location) query.set("location", params.location);
    if (params.cursor) query.set("cursor", params.cursor);
    if (params.sort_by) query.set("sort_by", params.sort_by);
    if (params.sort_dir) query.set("sort_dir", params.sort_dir);
    if (params.page !== undefined) query.set("page", String(params.page));
    if (params.include) query.set("include", params.include);
    query.set("limit", String(params.limit ?? 20));
    const url = `${this.baseUrl}/jobs?${query}`;
    const errorFactory = getRestAPIErrorFactory(SERVICE_NAME, "listJobs", "GET", url);
    const response = await customFetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      expectedStatusCode: StatusCodes.OK,
      serviceName: SERVICE_NAME,
      serviceFunction: "listJobs",
      failureMessage: "Failed to fetch jobs",
      expectedContentType: "application/json",
    });
    try {
      return (await response.json()) as PaginatedResponse<JobApiItem>;
    } catch (e) {
      throw errorFactory(response.status, ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY, "Invalid JSON", {
        error: e,
      });
    }
  }

  async getAdoptionTrends(startDate: string, endDate: string, interval = "day"): Promise<AdoptionTrendsResponse> {
    const params = new URLSearchParams({ start_date: startDate, end_date: endDate, interval });
    const url = `${this.baseUrl}/analytics/adoption-trends?${params}`;
    const errorFactory = getRestAPIErrorFactory(SERVICE_NAME, "getAdoptionTrends", "GET", url);
    const response = await customFetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      expectedStatusCode: StatusCodes.OK,
      serviceName: SERVICE_NAME,
      serviceFunction: "getAdoptionTrends",
      failureMessage: "Failed to fetch adoption trends",
      expectedContentType: "application/json",
    });
    try {
      return (await response.json()) as AdoptionTrendsResponse;
    } catch (e) {
      throw errorFactory(response.status, ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY, "Invalid JSON", {
        error: e,
      });
    }
  }
}
