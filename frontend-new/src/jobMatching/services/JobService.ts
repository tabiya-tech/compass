import { getRestAPIErrorFactory, type RestAPIErrorFactory } from "src/error/restAPIError/RestAPIError";
import { StatusCodes } from "http-status-codes";
import ErrorConstants from "src/error/restAPIError/RestAPIError.constants";
import { customFetch } from "src/utils/customFetch/customFetch";
import { getBackendUrl } from "src/envService";
import type { JobsApiResponse } from "src/jobMatching/types";

const SERVICE_NAME = "JobService";

function parseJson<T>(responseBody: string, errorFactory: RestAPIErrorFactory): T {
  try {
    return JSON.parse(responseBody) as T;
  } catch (e: unknown) {
    throw errorFactory(0, ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY, "Response did not contain valid JSON", {
      responseBody,
      error: e,
    });
  }
}

export interface ListJobsParams {
  search?: string;
  category?: string;
  employment_type?: string;
  location?: string;
  cursor?: string;
  page?: number;
  include?: string;
  limit?: number;
  sort_by?: "title" | "category" | "location" | "posted_date";
  sort_dir?: "asc" | "desc";
}

export default class JobService {
  private static instance: JobService;
  private readonly baseUrl: string;

  private constructor() {
    this.baseUrl = `${getBackendUrl()}/jobs`;
  }

  static getInstance(): JobService {
    if (!JobService.instance) {
      JobService.instance = new JobService();
    }
    return JobService.instance;
  }

  async listJobs(params: ListJobsParams = {}): Promise<JobsApiResponse> {
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

    const url = `${this.baseUrl}?${query.toString()}`;
    const errorFactory = getRestAPIErrorFactory(SERVICE_NAME, "listJobs", "GET", url);
    const response = await customFetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      expectedStatusCode: StatusCodes.OK,
      serviceName: SERVICE_NAME,
      serviceFunction: "listJobs",
      failureMessage: "Failed to fetch jobs",
      expectedContentType: "application/json",
      retryOnFailedToFetch: true,
    });
    const body = await response.text();
    return parseJson<JobsApiResponse>(body, errorFactory);
  }
}
