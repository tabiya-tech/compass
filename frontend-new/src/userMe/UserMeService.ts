import { getBackendUrl } from "src/envService";
import { customFetch } from "src/utils/customFetch/customFetch";
import { StatusCodes } from "http-status-codes";
import { getRestAPIErrorFactory } from "src/error/restAPIError/RestAPIError";
import ErrorConstants from "src/error/restAPIError/RestAPIError.constants";
import type { ModuleSummary } from "src/careerReadiness/types";
import type { UserSectorEngagementItem } from "src/careerExplorer/services/CareerExplorerService";

// ---------------------------------------------------------------------------
// Response types matching backend /users/me/profile
// ---------------------------------------------------------------------------

export interface PersonalDataResponse {
  first_name: string | null;
  last_name: string | null;
  province: string | null;
  institution_name: string | null;
  programme_name: string | null;
  school_year: string | null;
}

export interface UserProfileResponse {
  personal_data: PersonalDataResponse | null;
  programme_skills: string[];
}

// ---------------------------------------------------------------------------
// Response types matching backend /users/me/progress
// ---------------------------------------------------------------------------

export interface UserProgressResponse {
  skills_interests_progress: number;
  career_readiness_modules: ModuleSummary[];
  sector_engagement: UserSectorEngagementItem[];
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export default class UserMeService {
  private static instance: UserMeService;
  private readonly baseUrl: string;

  private constructor() {
    this.baseUrl = `${getBackendUrl()}/users/me`;
  }

  public static getInstance(): UserMeService {
    if (!UserMeService.instance) {
      UserMeService.instance = new UserMeService();
    }
    return UserMeService.instance;
  }

  /**
   * GET /users/me/profile
   * Returns personal data + programme skills in one call.
   */
  async getProfile(): Promise<UserProfileResponse> {
    const serviceName = "UserMeService";
    const serviceFunction = "getProfile";
    const method = "GET";
    const url = `${this.baseUrl}/profile`;
    const errorFactory = getRestAPIErrorFactory(serviceName, serviceFunction, method, url);

    const response = await customFetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      expectedStatusCode: StatusCodes.OK,
      serviceName,
      serviceFunction,
      failureMessage: "Failed to fetch user profile",
      expectedContentType: "application/json",
      retryOnFailedToFetch: true,
    });

    let data: UserProfileResponse;
    try {
      data = JSON.parse(await response.text());
    } catch (error: unknown) {
      throw errorFactory(
        response.status,
        ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY,
        "Response did not contain valid JSON",
        { error }
      );
    }
    return data;
  }

  /**
   * GET /users/me/progress?session_id={sessionId}
   * Returns chat progress %, career readiness modules, and sector engagement in one call.
   */
  async getProgress(sessionId: number | null): Promise<UserProgressResponse> {
    const serviceName = "UserMeService";
    const serviceFunction = "getProgress";
    const method = "GET";
    const params = sessionId != null ? `?session_id=${sessionId}` : "";
    const url = `${this.baseUrl}/progress${params}`;
    const errorFactory = getRestAPIErrorFactory(serviceName, serviceFunction, method, url);

    const response = await customFetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      expectedStatusCode: StatusCodes.OK,
      serviceName,
      serviceFunction,
      failureMessage: "Failed to fetch user progress",
      expectedContentType: "application/json",
      retryOnFailedToFetch: true,
    });

    let data: UserProgressResponse;
    try {
      data = JSON.parse(await response.text());
    } catch (error: unknown) {
      throw errorFactory(
        response.status,
        ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY,
        "Response did not contain valid JSON",
        { error }
      );
    }
    return data;
  }
}
